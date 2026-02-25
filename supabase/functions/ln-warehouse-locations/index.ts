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

    let body: { warehouse?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const wh = (body.warehouse || "").trim();
    const language = body.language || "en-US";
    const company = await (async () => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) throw new Error("env_missing");
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      return await getCompanyFromParams(supabase);
    })();
    if (!wh) return json({ ok: false, error: "missing_warehouse" }, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "env_missing" }, 200);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Decrypted OAuth
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);
    const { ci, cs, pu, ot, grant_type } = cfg as { ci: string; cs: string; pu: string; ot: string; grant_type: string };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // iu/ti
    const { data: activeRow } = await supabase.from("ionapi_oauth2").select("iu, ti").eq("active", true).limit(1).maybeSingle();
    if (!activeRow) return json({ ok: false, error: "no_active_config_row" }, 200);
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    // Token
    const basic = btoa(`${ci}:${cs}`);
    const paramsToken = new URLSearchParams();
    paramsToken.set("grant_type", grantType);
    const { saak, sask } = cfg as { saak: string; sask: string };
    paramsToken.set("username", saak);
    paramsToken.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: paramsToken.toString(),
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // OData request
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const escapedWh = wh.replace(/'/g, "''");
    const qp = new URLSearchParams();
    qp.set("$filter", "not startswith(Description,'old') and not startswith(Description,'OLD')");
    qp.set("$select", "*");
    qp.set("$expand", "*");
    qp.set("$count", "true");

    const path = `/${ti}/LN/lnapi/odata/whapi.wmdWarehouse/Warehouses(Warehouse='${escapedWh}')/LocationRefs`;
    const url = `${base}${path}?${qp.toString()}`;

    const odataRes = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        Authorization: `Bearer ${accessToken}`,
      },
    }).catch(() => null as unknown as Response);
    if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      const top = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: top, details } }, 200);
    }

    const rows = Array.isArray(odataJson.value)
      ? odataJson.value
          .map((v: any) => ({
            Location: typeof v?.Location === "string" ? v.Location : "",
            Description: typeof v?.Description === "string" ? v.Description : undefined,
            BlockedForInbound: Boolean(v?.BlockedForInbound),
            BlockedForOutbound: Boolean(v?.BlockedForOutbound),
            BlockedForTransferReceipt: Boolean(v?.BlockedForTransferReceipt),
            BlockedForTransferIssue: Boolean(v?.BlockedForTransferIssue),
            BlockedForAssembly: Boolean(v?.BlockedForAssembly),
            LocationOccupied: Boolean(v?.LocationOccupied),
            LocationFull: Boolean(v?.LocationFull),
            InfiniteCapacity: Boolean(v?.InfiniteCapacity),
            FixedLocation: Boolean(v?.FixedLocation),
          }))
          .filter((r: any) => r.Location)
      : [];
    const count = typeof odataJson?.["@odata.count"] === "number" ? odataJson["@odata.count"] : rows.length;

    return json({ ok: true, count, rows }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});