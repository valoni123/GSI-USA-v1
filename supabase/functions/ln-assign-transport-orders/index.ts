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
  plannedVehicle?: string;
  language?: string;
  company?: string;
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
      console.error("[ln-assign-transport-orders] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const plannedVehicle = (body.plannedVehicle || "").trim();
    const language = (body.language || "en-US").trim() || "en-US";

    if (!plannedVehicle) {
      console.warn("[ln-assign-transport-orders] missing plannedVehicle");
      return json({ ok: false, error: "missing_planned_vehicle" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-assign-transport-orders] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const url = `${base}/${cfg.ti}/LN/lnapi/odata/txgwi.TransportAssignments/AssignTransportOrderToVehilces?$select=*`;

    console.info("[ln-assign-transport-orders] start", { plannedVehicle, language, company });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ PlannedVehicle: plannedVehicle }),
    });

    const payload = (await response.json().catch(() => null)) as any;

    if (!response.ok || !payload) {
      const top = payload?.error?.message || "assignment_failed";
      const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
      console.error("[ln-assign-transport-orders] upstream error", {
        status: response.status,
        message: top,
        details,
      });
      return json({ ok: false, error: { message: top, details } }, 200);
    }

    console.info("[ln-assign-transport-orders] completed", { plannedVehicle });
    return json({ ok: true, data: payload }, 200);
  } catch (error) {
    console.error("[ln-assign-transport-orders] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
