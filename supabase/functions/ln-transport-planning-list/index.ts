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

function toAbsoluteUrl(base: string, maybeUrl: string) {
  const u = (maybeUrl || "").toString();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base}${u}`;
  // If LN returns a relative URL without a leading slash, just append with slash.
  return `${base}/${u}`;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { planningGroup?: string; language?: string; company?: string; showAll?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const planningGroup = (body.planningGroup || "").trim();
    const language = body.language || "en-US";
    const company = await (async () => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("env_missing");
      }
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      return await getCompanyFromParams(supabase);
    })();
    const showAll = Boolean(body.showAll);
    // Only require planningGroup when not in showAll mode
    if (!showAll && !planningGroup) {
      return json({ ok: false, error: "missing_group" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get decrypted credentials
    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) return json({ ok: false, error: "config_error" }, 200);
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

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
    if (activeErr || !activeRow) return json({ ok: false, error: "config_lookup_error" }, 200);
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    // Token
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
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = (await tokenRes.json().catch(() => null)) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // OData call (with paging support)
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/txgwi.TransportPlanning/TransportPlannings`;
    const filter = `PlanningGroupTransport eq '${planningGroup.replace(/'/g, "''")}'`;

    const firstUrl = showAll
      ? `${base}${path}?$count=true&$select=*&$orderby=PlanningGroupTransport`
      : `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=*`;

    const headers = {
      accept: "application/json",
      "Content-Language": language,
      "X-Infor-LnCompany": company,
      Authorization: `Bearer ${accessToken}`,
    } as const;

    let count = 0;
    const all: any[] = [];
    let nextUrl = firstUrl;

    // LN OData typically pages results. Follow @odata.nextLink until exhausted.
    // Cap iterations to avoid infinite loops if the upstream behaves unexpectedly.
    for (let i = 0; i < 50 && nextUrl; i++) {
      const odataRes = await fetch(nextUrl, { method: "GET", headers }).catch(() => null as unknown as Response);
      if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
      const odataJson = (await odataRes.json().catch(() => null)) as any;
      if (!odataRes.ok || !odataJson) {
        const top = odataJson?.error?.message || "odata_error";
        const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
        return json({ ok: false, error: { message: top, details } }, 200);
      }

      if (i === 0) {
        count = odataJson["@odata.count"] ?? 0;
      }

      const pageItems = Array.isArray(odataJson.value) ? odataJson.value : [];
      all.push(...pageItems);

      const maybeNext = (odataJson["@odata.nextLink"] || odataJson["odata.nextLink"] || "") as string;
      nextUrl = maybeNext ? toAbsoluteUrl(base, maybeNext) : "";

      if (count && all.length >= count) break;
    }

    const items = all.map((v: any) => ({
      TransportID: v?.TransportID ?? "",
      TransportType: v?.TransportType ?? "",
      Item: v?.Item ?? "",
      HandlingUnit: v?.HandlingUnit ?? "",
      Warehouse: v?.Warehouse ?? "",
      LocationFrom: v?.LocationFrom ?? "",
      LocationTo: v?.LocationTo ?? "",
      VehicleID: v?.VehicleID ?? "",
      PlannedDeliveryDate: v?.PlannedDeliveryDate ?? "",
      PlanningGroupTransport: v?.PlanningGroupTransport ?? "",
      Description: v?.Description ?? "",
    }));

    return json({ ok: true, count, items }, 200);
  } catch {
    return json({ ok: false, error: "unhandled" }, 200);
  }
});