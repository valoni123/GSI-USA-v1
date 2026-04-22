import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession } from "../_shared/auth.ts";

type RequestBody = {
  orderOrigin?: string;
  order?: string;
  set?: string | number;
  remark?: string;
  builder?: string;
  employee?: string;
  login?: string;
  language?: string;
  company?: string;
  kittingLocation?: string;
};

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

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      console.error("[ln-assign-kitting-documents] invalid json body");
      return json(req, { ok: false, error: { message: "invalid_json" } }, 200);
    }

    const orderOrigin = (body.orderOrigin || "").trim();
    const order = (body.order || "").trim();
    const set = Number(body.set);
    const remark = (body.remark || "").trim();
    const builder = (body.builder || "").trim();
    const employee = (body.employee || "").trim();
    const login = (body.login || "").trim();
    const language = (body.language || "en-US").trim() || "en-US";
    const kittingLocation = (body.kittingLocation || "").trim();

    if (!orderOrigin) return json(req, { ok: false, error: { message: "missing_order_origin" } }, 200);
    if (!order) return json(req, { ok: false, error: { message: "missing_order" } }, 200);
    if (!Number.isFinite(set)) return json(req, { ok: false, error: { message: "invalid_set" } }, 200);
    if (!builder) return json(req, { ok: false, error: { message: "missing_builder" } }, 200);
    if (!employee) return json(req, { ok: false, error: { message: "missing_employee" } }, 200);
    if (!login) return json(req, { ok: false, error: { message: "missing_login" } }, 200);

    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const url = `${base}/${cfg.ti}/LN/lnapi/odata/txgwi.KittingDocumentsTransactions/AssignKittingDocuments?$select=*`;

    const requestBody = {
      OrderOrigin: orderOrigin,
      Order: order,
      Set: set,
      Remark: remark,
      Printed: "Yes",
      KittingLocation: kittingLocation,
      Employee: employee,
      Builder: builder,
      Login: login,
    };

    console.info("[ln-assign-kitting-documents] start", {
      orderOrigin,
      order,
      set,
      builder,
      employee,
      login,
      company,
      sessionUser: auth.gsiUserId,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let payload: any = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = responseText;
    }

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || "assign_kitting_documents_failed";
      const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
      console.error("[ln-assign-kitting-documents] upstream error", {
        status: response.status,
        message,
        details,
      });
      return json(req, { ok: false, error: { message, details } }, 200);
    }

    console.info("[ln-assign-kitting-documents] completed", { order, set, builder });
    return json(req, { ok: true, data: payload }, 200);
  } catch (error) {
    console.error("[ln-assign-kitting-documents] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json(req, { ok: false, error: { message: "unhandled" } }, 200);
  }
});
