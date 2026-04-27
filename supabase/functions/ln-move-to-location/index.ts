import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCompanyFromParams } from "../_shared/company.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession, requirePermissions } from "../_shared/auth.ts";

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : `${pu}/`;
  return base + ot.replace(/^\//, "");
}

function readTransferId(payload: any): string {
  const pick = (value: any) => {
    if (!value || typeof value !== "object") return "";

    const direct = value.TransferID ?? value.TransferId ?? value.trid;
    if (direct === null || direct === undefined) return "";
    return String(direct).trim();
  };

  const direct = pick(payload);
  if (direct) return direct;

  if (Array.isArray(payload?.value) && payload.value.length > 0) {
    const nested = pick(payload.value[0]);
    if (nested) return nested;
  }

  if (payload?.d) {
    const nested = pick(payload.d);
    if (nested) return nested;
  }

  return "";
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const supabase = createServiceRoleClient();
    const auth = await requireGsiSession(req, supabase);
    if (!auth.ok) {
      return auth.response;
    }

    const permissionResponse = requirePermissions(req, auth.user, ["trans", "cntg", "trlo", "trul"]);
    if (permissionResponse) {
      return permissionResponse;
    }

    let body: {
      handlingUnit?: string;
      item?: string;
      quantity?: number | string;
      fromWarehouse?: string;
      fromLocation?: string;
      toWarehouse?: string;
      toLocation?: string;
      employee?: string;
      language?: string;
      transportId?: string;
      scan1?: string;
      loaded?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return json(req, { ok: false, error: "invalid_json" }, 400);
    }

    const handlingUnit = (body.handlingUnit || "").trim();
    const itemRaw = typeof body.item === "string" ? body.item : "";
    const itemTrim = itemRaw.trim();
    const quantityNum =
      typeof body.quantity === "number"
        ? body.quantity
        : (typeof body.quantity === "string" && body.quantity.trim() ? Number(body.quantity) : undefined);
    const fromWarehouse = (body.fromWarehouse || "").trim();
    const fromLocation = (body.fromLocation || "").trim();
    const toWarehouse = (body.toWarehouse || "").trim();
    const toLocation = (body.toLocation || "").trim();
    const employee = (body.employee || "").trim();
    const language = body.language || "de-DE";
    const transportId = ((body.transportId || body.scan1 || "") as string).trim();
    const loaded = (body.loaded || "").trim();

    const hasCommon =
      Boolean(fromWarehouse) &&
      Boolean(fromLocation) &&
      Boolean(toWarehouse) &&
      Boolean(toLocation) &&
      Boolean(employee);
    const isHuMove = Boolean(handlingUnit);
    const isItemMove = !isHuMove && Boolean(itemTrim) && typeof quantityNum === "number" && !Number.isNaN(quantityNum);
    if (!hasCommon || (!isHuMove && !isItemMove)) {
      return json(req, { ok: false, error: "missing_fields" }, 400);
    }

    const company = await getCompanyFromParams(supabase);

    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-move-to-location] get_active_ionapi error", cfgErr);
      return json(req, { ok: false, error: "config_error" }, 500);
    }
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      return json(req, { ok: false, error: "no_active_config" }, 200);
    }
    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    const { data: activeRow, error: activeErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (activeErr || !activeRow) {
      console.error("[ln-move-to-location] active row error", activeErr);
      return json(req, { ok: false, error: "config_lookup_error" }, 500);
    }
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    if (!ci || !cs || !pu || !ot || !iu || !ti || !saak || !sask || !grantType) {
      return json(req, { ok: false, error: "config_incomplete" }, 400);
    }

    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    let tokenRes: Response;
    try {
      tokenRes = await fetch(buildTokenUrl(pu, ot), {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      });
    } catch (e) {
      console.error("[ln-move-to-location] token network error", e);
      return json(req, { ok: false, error: "token_network_error" }, 502);
    }
    const tokenJson = await tokenRes.json().catch(() => null) as Record<string, unknown> | null;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      console.error("[ln-move-to-location] token_error", tokenJson);
      return json(req, { ok: false, error: "token_error", details: tokenJson }, tokenRes.status || 500);
    }
    const accessToken = tokenJson.access_token as string;

    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const transferUrl = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseMovement/Transfers?$select=*`;
    const afterCommitUrl = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseMovement/AfterCommit`;

    const movementBody: Record<string, unknown> = {
      FromWarehouse: fromWarehouse,
      FromLocation: fromLocation,
      ToWarehouse: toWarehouse,
      ToLocation: toLocation,
      LoginCode: "",
      Employee: employee,
      FromWebserver: "Yes",
      Automatisch: "No",
    };
    if (loaded === "Yes") {
      movementBody.Loaded = "Yes";
    }
    if (transportId) {
      movementBody.TransportID = transportId;
    }
    if (handlingUnit) {
      movementBody.HandlingUnit = handlingUnit;
    } else if (itemTrim) {
      movementBody.Item = itemRaw;
      if (typeof quantityNum === "number" && !Number.isNaN(quantityNum)) {
        movementBody.Quantity = quantityNum;
      }
    }

    let moveRes: Response;
    try {
      moveRes = await fetch(transferUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(movementBody),
      });
    } catch (e) {
      console.error("[ln-move-to-location] move network error", e);
      return json(req, { ok: false, error: "move_network_error" }, 502);
    }

    const moveJson = await moveRes.json().catch(() => null) as any;
    if (!moveRes.ok) {
      const errObj = moveJson?.error || moveJson || {};
      const topMessage =
        typeof errObj?.message === "string"
          ? errObj.message
          : typeof moveJson === "string"
            ? moveJson
            : "Unbekannter Fehler";
      const details = Array.isArray(errObj?.details) ? errObj.details : [];
      return json(req, { ok: false, error: { message: topMessage, details } }, 200);
    }

    const transferId = readTransferId(moveJson);
    if (!transferId) {
      return json(req, {
        ok: false,
        error: {
          message: "Transfer not processed.",
          details: [],
        },
      }, 200);
    }

    let afterCommitRes: Response;
    try {
      afterCommitRes = await fetch(afterCommitUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ trid: transferId }),
      });
    } catch (e) {
      console.error("[ln-move-to-location] after commit network error", e);
      return json(req, { ok: false, error: { message: "AfterCommit network error", details: [] } }, 200);
    }

    const afterCommitJson = await afterCommitRes.json().catch(() => null) as any;
    if (!afterCommitRes.ok || !afterCommitJson) {
      const errObj = afterCommitJson?.error || afterCommitJson || {};
      const topMessage =
        typeof errObj?.message === "string"
          ? errObj.message
          : typeof afterCommitJson === "string"
            ? afterCommitJson
            : "AfterCommit failed";
      const details = Array.isArray(errObj?.details) ? errObj.details : [];
      return json(req, { ok: false, error: { message: topMessage, details } }, 200);
    }

    if (afterCommitJson.errorMessage !== null) {
      return json(req, {
        ok: false,
        error: {
          message: typeof afterCommitJson.errorMessage === "string" && afterCommitJson.errorMessage.trim()
            ? afterCommitJson.errorMessage
            : "AfterCommit failed",
          details: [],
        },
      }, 200);
    }

    return json(req, {
      ok: true,
      data: moveJson,
      transferId,
      afterCommit: afterCommitJson,
    }, 200);
  } catch (e) {
    console.error("[ln-move-to-location] unhandled", e);
    return json(req, { ok: false, error: "unhandled" }, 500);
  }
});