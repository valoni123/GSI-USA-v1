import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession, requirePermissions } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createServiceRoleClient();
    const auth = await requireGsiSession(req, supabase);
    if (!auth.ok) {
      return auth.response;
    }

    const permissionResponse = requirePermissions(req, auth.user, ["corr"]);
    if (permissionResponse) {
      return permissionResponse;
    }

    const body = (await req.json().catch(() => ({}))) as {
      language?: string;
      company?: string;
      handlingUnit?: string;
      warehouse?: string;
      location?: string;
      item?: string;
      deviation?: number;
      reason?: string;
      loginCode?: string;
      employee?: string;
      scan1?: string;
      transactionId?: string;
      sequenceNumber?: number;
      fromWebservice?: string;
    };

    const language = body.language || "en-US";
    const companyOverride = (body.company || "").toString().trim();

    const handlingUnit = (body.handlingUnit || "").toString().trim();
    const warehouse = (body.warehouse || "").toString().trim();
    const location = (body.location || "").toString().trim();
    const rawItem = (body.item || "").toString();
    const trimmedItem = rawItem.trim();
    const item = trimmedItem
      ? rawItem === trimmedItem
        ? `         ${trimmedItem}`
        : rawItem
      : "";
    const reason = (body.reason || "").toString().trim();
    const loginCode = (body.loginCode || "").toString().trim();
    const employee = (body.employee || "").toString().trim();
    const deviation = Number(body.deviation);
    const transactionId = (body.transactionId || "").toString();
    const sequenceNumber = Number.isFinite(Number(body.sequenceNumber)) ? Number(body.sequenceNumber) : 0;
    const fromWebservice = (body.fromWebservice || "Yes").toString() || "Yes";
    const isHuAdjustment = Boolean(handlingUnit);

    if (!reason || !loginCode || !employee || !Number.isFinite(deviation)) {
      return json(req, { ok: false, error: "invalid_payload" }, 200);
    }

    if (isHuAdjustment) {
      if (!handlingUnit) {
        return json(req, { ok: false, error: "invalid_payload" }, 200);
      }
    } else if (!warehouse || !location || !trimmedItem) {
      return json(req, { ok: false, error: "invalid_payload" }, 200);
    }

    let company = companyOverride;
    if (!company) {
      try {
        company = await getCompanyFromParams(supabase);
      } catch (e) {
        console.error("[ln-inventory-adjustment] no_company_config", { error: String(e) });
        return json(req, { ok: false, error: "no_company_config" }, 200);
      }
    }

    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);

    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const qs = new URLSearchParams();
    qs.set("$select", "*");

    const url = `${base}/${cfg.ti}/LN/lnapi/odata/txgsi.Adjustments/GSIAdjustments?${qs.toString()}`;

    const payload = isHuAdjustment
      ? {
          TransactionID: transactionId,
          SequenceNumber: sequenceNumber,
          HandlingUnit: handlingUnit,
          Deviation: deviation,
          ReasonForStockCorrection: reason,
          Scan1: (body.scan1 || "").toString(),
          LoginCode: loginCode,
          Employee: employee,
          FromWebservice: fromWebservice,
        }
      : {
          TransactionID: transactionId,
          SequenceNumber: sequenceNumber,
          HandlingUnit: "",
          Warehouse: warehouse,
          Location: location,
          Item: item,
          Deviation: deviation,
          ReasonForStockCorrection: reason,
          LoginCode: loginCode,
          Employee: employee,
          FromWebservice: fromWebservice,
        };

    console.log("[ln-inventory-adjustment] posting adjustment", {
      company,
      language,
      mode: isHuAdjustment ? "HU" : "ITEM",
      handlingUnit,
      warehouse,
      location,
      item,
      deviation,
      reason,
      sessionUser: auth.gsiUserId,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    }).catch((e) => {
      console.error("[ln-inventory-adjustment] odata_network_error", { error: String(e) });
      return null as unknown as Response;
    });

    if (!res) return json(req, { ok: false, error: "odata_network_error" }, 200);

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok || !data) {
      console.error("[ln-inventory-adjustment] odata_error", {
        status: res.status,
        body: data,
      });
      const topMessage = data?.error?.message || "odata_error";
      const details = Array.isArray(data?.error?.details) ? data.error.details : [];
      return json(req, { ok: false, error: { message: topMessage, details } }, 200);
    }

    return json(req, { ok: true, value: data }, 200);
  } catch (e) {
    console.error("[ln-inventory-adjustment] unhandled", { error: String(e) });
    return json(req, { ok: false, error: { message: "unhandled" } }, 200);
  }
});
