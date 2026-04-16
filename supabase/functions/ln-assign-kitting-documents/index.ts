import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      console.error("[ln-assign-kitting-documents] invalid json body");
      return json({ ok: false, error: { message: "invalid_json" } }, 200);
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

    if (!orderOrigin) {
      console.warn("[ln-assign-kitting-documents] missing orderOrigin");
      return json({ ok: false, error: { message: "missing_order_origin" } }, 200);
    }

    if (!order) {
      console.warn("[ln-assign-kitting-documents] missing order");
      return json({ ok: false, error: { message: "missing_order" } }, 200);
    }

    if (!Number.isFinite(set)) {
      console.warn("[ln-assign-kitting-documents] invalid set", { set: body.set });
      return json({ ok: false, error: { message: "invalid_set" } }, 200);
    }

    if (!builder) {
      console.warn("[ln-assign-kitting-documents] missing builder");
      return json({ ok: false, error: { message: "missing_builder" } }, 200);
    }

    if (!employee) {
      console.warn("[ln-assign-kitting-documents] missing employee");
      return json({ ok: false, error: { message: "missing_employee" } }, 200);
    }

    if (!login) {
      console.warn("[ln-assign-kitting-documents] missing login");
      return json({ ok: false, error: { message: "missing_login" } }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-assign-kitting-documents] missing env");
      return json({ ok: false, error: { message: "env_missing" } }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
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
      return json({ ok: false, error: { message, details } }, 200);
    }

    console.info("[ln-assign-kitting-documents] completed", { order, set, builder });
    return json({ ok: true, data: payload }, 200);
  } catch (error) {
    console.error("[ln-assign-kitting-documents] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
