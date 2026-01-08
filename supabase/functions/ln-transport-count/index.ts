import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
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
    const company = body.company || "1000";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-transport-count] env missing");
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get decrypted credentials via RPC
    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-transport-count] get_active_ionapi error", cfgErr);
      return json({ ok: false, error: "config_error" }, 200);
    }
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      return json({ ok: false, error: "no_active_config" }, 200);
    }
    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // Get iu and ti from active row
    const { data: activeRow, error: activeErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (activeErr || !activeRow) {
      console.error("[ln-transport-count] active row error", activeErr);
      return json({ ok: false, error: "config_lookup_error" }, 200);
    }
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    if (!ci || !cs || !pu || !ot || !iu || !ti || !saak || !sask || !grantType) {
      return json({ ok: false, error: "config_incomplete" }, 200);
    }

    // Token
    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    }).catch((e) => {
      console.error("[ln-transport-count] token network", e);
      return null as unknown as Response;
    });
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // OData URL
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/txgwi.TransportOrders/TransportOrders`;
    const filter = `VehicleID eq '${vehicleId.replace(/'/g, "''")}'`;
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=TransportID`;

    const odataRes = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
      },
    }).catch((e) => {
      console.error("[ln-transport-count] odata network", e);
      return null as unknown as Response;
    });
    if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
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