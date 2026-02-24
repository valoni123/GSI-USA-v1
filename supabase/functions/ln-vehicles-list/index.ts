import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseAdmin, getActiveConfig, fetchOData } from "../_shared/ionapi.ts";
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

    let body: { language?: string } = {};
    try {
      body = await req.json();
    } catch {
      // optional body
    }

    const language = body.language || "en-US";

    const supabase = getSupabaseAdmin();
    const company = await getCompanyFromParams(supabase);
    const cfg = await getActiveConfig(supabase);

    const path = `/txgwi.Vehicles/Vehicles?$select=VehicleID,Description&$orderby=VehicleID&$top=1000`;
    const odataRes = await fetchOData(cfg, company, path, language);
    if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const items = Array.isArray(odataJson.value)
      ? odataJson.value.map((v: any) => ({
          VehicleID: v?.VehicleID ?? "",
          Description: v?.Description ?? "",
        }))
      : [];

    return json({ ok: true, items }, 200);
  } catch {
    return json({ ok: false, error: "unhandled" }, 200);
  }
});