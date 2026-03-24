import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : `${pu}/`;
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

    let body: { vehicleId?: string; language?: string } = {};
    try {
      body = await req.json();
    } catch {
      console.warn("[ln-transport-planning-count] invalid json");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const vehicleId = (body.vehicleId || "").trim();
    if (!vehicleId) {
      console.warn("[ln-transport-planning-count] missing vehicle");
      return json({ ok: false, error: "missing_vehicle" }, 200);
    }
    const language = body.language || "en-US";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-transport-planning-count] env missing");
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);

    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-transport-planning-count] get_active_ionapi error", cfgErr);
      return json({ ok: false, error: "config_error" }, 200);
    }
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      console.warn("[ln-transport-planning-count] no active config");
      return json({ ok: false, error: "no_active_config" }, 200);
    }

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string;
      cs: string;
      pu: string;
      ot: string;
      grant_type: string;
      saak: string;
      sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    const { data: activeRow, error: activeErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (activeErr || !activeRow) {
      console.error("[ln-transport-planning-count] active config lookup error", activeErr);
      return json({ ok: false, error: "config_lookup_error" }, 200);
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
    }).catch((error) => {
      console.error("[ln-transport-planning-count] token network error", error);
      return null as unknown as Response;
    });
    if (!tokenRes) {
      return json({ ok: false, error: "token_network_error" }, 200);
    }

    const tokenJson = (await tokenRes.json().catch(() => null)) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      console.error("[ln-transport-planning-count] token error", { status: tokenRes.status });
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }

    const base = activeRow.iu.endsWith("/") ? activeRow.iu.slice(0, -1) : activeRow.iu;
    const path = `/${activeRow.ti}/LN/lnapi/odata/txgwi.TransportPlanning/GWITransportPlannings`;
    const filter = `PlannedVehicle eq '${vehicleId.replace(/'/g, "''")}'`;
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=PlannedVehicle`;

    const odataRes = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
    }).catch((error) => {
      console.error("[ln-transport-planning-count] odata network error", error);
      return null as unknown as Response;
    });
    if (!odataRes) {
      return json({ ok: false, error: "odata_network_error" }, 200);
    }

    const odataJson = (await odataRes.json().catch(() => null)) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      console.error("[ln-transport-planning-count] odata error", { status: odataRes.status, topMessage, details });
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const count = Number(odataJson["@odata.count"] ?? 0);
    console.info("[ln-transport-planning-count] success", { vehicleId, count });
    return json({ ok: true, count }, 200);
  } catch (error) {
    console.error("[ln-transport-planning-count] unhandled error", error);
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
