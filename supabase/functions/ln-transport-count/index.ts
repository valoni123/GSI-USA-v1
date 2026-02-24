import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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

    let body: { vehicleId?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const vehicleId = (body.vehicleId || "").trim();
    if (!vehicleId) {
      return json({ ok: false, error: "missing_vehicle" }, 200);
    }
    const language = body.language || "en-US";

    const supabase = getSupabaseAdmin();
    const company = await getCompanyFromParams(supabase);
    const cfg = await getActiveConfig(supabase);

    const path = `/txgwi.TransportOrders/TransportOrders`;
    const filter = `VehicleID eq '${vehicleId.replace(/'/g, "''")}'`;
    const urlPath = `${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=TransportID`;
    const odataRes = await fetchOData(cfg, company, urlPath, language);

    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const count = odataJson["@odata.count"] ?? 0;
    return json({ ok: true, count }, 200);
  } catch (e) {
    console.error("[ln-transport-count] unhandled", e);
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});