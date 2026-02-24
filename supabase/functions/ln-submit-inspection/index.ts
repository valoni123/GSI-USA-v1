import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseAdmin, getActiveConfig, getAccessTokenCached, buildODataBase } from "../_shared/ionapi.ts";
import { getCompanyFromParams } from "../_shared/company.ts";

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

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: {
      language?: string;
      company?: string;
      payload: Record<string, unknown>;
    } = {} as any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const language = body.language || "en-US";
    const companyOverride = (body.company || "").toString().trim();
    const payload = body.payload;
    if (!payload || typeof payload !== "object") {
      return json({ ok: false, error: "missing_payload" }, 200);
    }

    const supabase = getSupabaseAdmin();
    let company = companyOverride;
    if (!company) {
      try {
        company = await getCompanyFromParams(supabase);
      } catch {
        return json({ ok: false, error: "no_company_config" }, 200);
      }
    }

    const cfg = await getActiveConfig(supabase);
    const token = await getAccessTokenCached(cfg);
    const base = buildODataBase(cfg);
    const url = `${base}/txgsi.GSIInspection/GSIInspections?$select=*`;

    const postRes = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Connection": "keep-alive",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => null as unknown as Response);

    if (!postRes) return json({ ok: false, error: "post_network_error" }, 200);

    const ct = postRes.headers.get("Content-Type") || "";
    const responseBody = ct.includes("application/json")
      ? await postRes.json().catch(() => null)
      : await postRes.text().catch(() => null);

    if (!postRes.ok) {
      const topMessage = (responseBody as any)?.error?.message || "post_error";
      const details = Array.isArray((responseBody as any)?.error?.details) ? (responseBody as any).error.details : [];
      return json({ ok: false, error: { message: topMessage, details }, status: postRes.status, body: responseBody }, 200);
    }

    return json({ ok: true, status: postRes.status, body: responseBody }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});