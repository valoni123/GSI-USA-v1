import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ODATA_TIMEOUT_MS = 20_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { handlingUnit?: string; vehicleId?: string; language?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const handlingUnit = (body.handlingUnit || "").trim();
    const vehicleId = (body.vehicleId || "").trim();
    const language = body.language || "en-US";

    if (!handlingUnit || !vehicleId) {
      return json({ ok: false, error: "missing_fields" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);

    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const path = `/${cfg.ti}/LN/lnapi/odata/txgwi.TransportOrders/TransportOrders`;
    const filter = `HandlingUnit eq '${handlingUnit.replace(/'/g, "''")}' and VehicleID eq '${vehicleId.replace(/'/g, "''")}'`;
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=TransportID`;

    let odataRes: Response;
    try {
      odataRes = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "Content-Language": language,
            "X-Infor-LnCompany": company,
            Authorization: `Bearer ${accessToken}`,
          },
        },
        ODATA_TIMEOUT_MS,
      );
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      return json({ ok: false, error: { message: isTimeout ? "odata_timeout" : "odata_network_error" } }, 200);
    }

    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const count = odataJson["@odata.count"] ?? 0;
    return json({ ok: true, count }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
