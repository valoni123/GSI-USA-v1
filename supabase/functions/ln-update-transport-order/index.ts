import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCompanyFromParams } from "../_shared/company.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession, requirePermissions } from "../_shared/auth.ts";

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : `${pu}/`;
  return base + ot.replace(/^\//, "");
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

    const permissionResponse = requirePermissions(req, auth.user, ["trans", "trlo", "trul", "load"]);
    if (permissionResponse) {
      return permissionResponse;
    }

    let body: {
      transportId?: string;
      etag?: string;
      vehicleId?: string;
      locationDevice?: string;
      completed?: string;
      language?: string;
      runNumber?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return json(req, { ok: false, error: "invalid_json" }, 200);
    }

    const transportId = (body.transportId || "").trim();
    const runNumber = (body.runNumber || "").trim();
    const etag = (body.etag || "").trim();
    const vehicleId = body.vehicleId === undefined ? undefined : (body.vehicleId || "").trim();
    const locationDevice = body.locationDevice === undefined ? undefined : (body.locationDevice || "").trim();
    const completed = (body.completed || "").trim();
    const language = body.language || "de-DE";

    if (!transportId || !etag) {
      return json(req, { ok: false, error: { message: "missing_fields" } }, 200);
    }

    const company = await getCompanyFromParams(supabase);

    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-update-transport-order] get_active_ionapi error", cfgErr);
      return json(req, { ok: false, error: { message: "config_error" } }, 200);
    }
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      return json(req, { ok: false, error: { message: "no_active_config" } }, 200);
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
      console.error("[ln-update-transport-order] active row error", activeErr);
      return json(req, { ok: false, error: { message: "config_lookup_error" } }, 200);
    }
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    if (!ci || !cs || !pu || !ot || !iu || !ti || !saak || !sask || !grantType) {
      return json(req, { ok: false, error: { message: "config_incomplete" } }, 200);
    }

    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    }).catch((e) => {
      console.error("[ln-update-transport-order] token network", e);
      return null as unknown as Response;
    });
    if (!tokenRes) return json(req, { ok: false, error: { message: "token_network_error" } }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json(req, { ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const encodedId = transportId.replace(/'/g, "''");
    const encodedRun = runNumber.replace(/'/g, "''");
    const keyPart = runNumber
      ? `TransportID='${encodedId}',RunNumber='${encodedRun}'`
      : `TransportID='${encodedId}'`;
    const path = `/${ti}/LN/lnapi/odata/txgwi.TransportOrders/TransportOrders(${keyPart})?$select=*`;
    const url = `${base}${path}`;

    const patchBody: Record<string, unknown> = {};
    if (completed.toLowerCase() === "yes") {
      patchBody.Completed = "Yes";
    }
    if (vehicleId !== undefined) {
      patchBody.VehicleID = vehicleId;
    }
    if (locationDevice !== undefined) {
      patchBody.LocationDevice = locationDevice;
    } else if (vehicleId !== undefined) {
      patchBody.LocationDevice = vehicleId;
    }

    const patchRes = await fetch(url, {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "If-Match": etag,
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(patchBody),
    }).catch((e) => {
      console.error("[ln-update-transport-order] patch network", e);
      return null as unknown as Response;
    });

    if (!patchRes) return json(req, { ok: false, error: { message: "patch_network_error" } }, 200);
    const resJson = await patchRes.json().catch(() => null) as any;

    if (!patchRes.ok) {
      const errObj = resJson?.error || resJson || {};
      const topMessage =
        typeof errObj?.message === "string"
          ? errObj.message
          : typeof resJson === "string"
            ? resJson
            : "Unbekannter Fehler";
      const details = Array.isArray(errObj?.details) ? errObj.details : [];
      return json(req, { ok: false, error: { message: topMessage, details } }, 200);
    }

    return json(req, { ok: true, data: resJson }, 200);
  } catch (e) {
    console.error("[ln-update-transport-order] unhandled", e);
    return json(req, { ok: false, error: { message: "unhandled" } }, 200);
  }
});
