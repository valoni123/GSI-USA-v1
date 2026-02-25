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

    let body: { warehouse?: string; location?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const warehouse = (body.warehouse || "").trim();
    const location = (body.location || "").trim();
    const language = body.language || "en-US";
    if (!warehouse || !location) return json({ ok: false, error: "missing_params" }, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "env_missing" }, 200);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);

    // OAuth config
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type } = cfg as { ci: string; cs: string; pu: string; ot: string; grant_type: string };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // iu, ti
    const { data: activeRow } = await supabase.from("ionapi_oauth2").select("iu, ti").eq("active", true).limit(1).maybeSingle();
    if (!activeRow) return json({ ok: false, error: "no_active_config_row" }, 200);
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    // Token
    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    const { saak, sask } = cfg as { saak: string; sask: string };
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // OData request to validate location existence
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const escapedWh = warehouse.replace(/'/g, "''");
    const escapedLoc = location.replace(/'/g, "''");

    const qp = new URLSearchParams();
    qp.set("$filter", `Location eq '${escapedLoc}'`);
    qp.set("$count", "true");

    const path = `/${ti}/LN/lnapi/odata/whapi.wmdWarehouse/Warehouses(Warehouse='${escapedWh}')/LocationRefs`;
    const url = `${base}${path}?${qp.toString()}`;

    const headers = {
      accept: "application/json",
      "Content-Language": language,
      "X-Infor-LnCompany": company,
      Authorization: `Bearer ${accessToken}`,
    } as const;

    const res = await fetch(url, { method: "GET", headers }).catch(() => null as unknown as Response);
    if (!res) return json({ ok: false, error: "odata_network_error" }, 200);
    const ojson = await res.json().catch(() => null) as any;
    if (!res.ok || !ojson) {
      const top = ojson?.error?.message || "odata_error";
      const details = Array.isArray(ojson?.error?.details) ? ojson.error.details : [];
      return json({ ok: false, error: { message: top, details } }, 200);
    }

    const count = typeof ojson?.["@odata.count"] === "number" ? ojson["@odata.count"] : Array.isArray(ojson?.value) ? ojson.value.length : 0;
    return json({ ok: true, exists: count > 0, count }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});