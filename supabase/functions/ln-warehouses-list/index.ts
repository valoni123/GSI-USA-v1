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

    let body: { language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const language = body.language || "en-US";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));

    // OAuth config
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type } = cfg as { ci: string; cs: string; pu: string; ot: string; grant_type: string };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // active iu/ti
    const { data: activeRow } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
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
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // OData call: list warehouses with Locations = Yes
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const params = new URLSearchParams();
    params.set("$filter", "Locations eq whapi.wmdWarehouse.AnswerOnQuestionYn'Yes'");
    params.set("$select", "*");
    params.set("$expand", "*");
    params.set("$count", "true");

    const path = `/${ti}/LN/lnapi/odata/whapi.wmdWarehouse/Warehouses`;
    const url = `${base}${path}?${params.toString()}`;

    const baseHeaders = {
      accept: "application/json",
      "Content-Language": language,
      "X-Infor-LnCompany": company,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "odata.maxpagesize=200",
    } as const;

    // Fetch all pages (LN often paginates small)
    const allRows: any[] = [];
    let nextUrl: string | null = url;
    let firstCount: number | null = null;

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        method: "GET",
        headers: baseHeaders,
      }).catch(() => null as unknown as Response);

      if (!res) return json({ ok: false, error: "odata_network_error" }, 200);
      const body = (await res.json().catch(() => null)) as any;

      if (!res.ok || !body) {
        const top = body?.error?.message || "odata_error";
        const details = Array.isArray(body?.error?.details) ? body.error.details : [];
        return json({ ok: false, error: { message: top, details } }, 200);
      }

      if (firstCount === null && typeof body?.["@odata.count"] === "number") {
        firstCount = body["@odata.count"];
      }

      const page = Array.isArray(body?.value) ? body.value : [];
      allRows.push(...page);

      const maybeNext = (body?.["@odata.nextLink"] || body?.["odata.nextLink"] || "") as string;
      nextUrl = maybeNext ? (maybeNext.startsWith("http") ? maybeNext : `${base}${maybeNext}`) : null;
    }

    const rows = allRows
      .map((v: any) => {
        const typeCandidate =
          (typeof v?.WarehouseType === "string" && v.WarehouseType) ||
          (typeof v?.Type === "string" && v.Type) ||
          (typeof v?.WarehouseMasterDataRef?.WarehouseType === "string" && v.WarehouseMasterDataRef.WarehouseType) ||
          (typeof v?.WarehouseMasterDataRef?.Type === "string" && v.WarehouseMasterDataRef.Type) ||
          (typeof v?.WarehouseMasterDataRef?.WarehouseTypeRef?.Description === "string" &&
            v.WarehouseMasterDataRef.WarehouseTypeRef.Description) ||
          (typeof v?.WarehouseMasterDataRef?.WarehouseTypeRef?.Type === "string" && v.WarehouseMasterDataRef.WarehouseTypeRef.Type) ||
          undefined;
        return {
          Warehouse: typeof v?.Warehouse === "string" ? v.Warehouse : "",
          Description:
            (typeof v?.WarehouseMasterDataRef?.Description === "string" && v.WarehouseMasterDataRef.Description) ||
            (typeof v?.Description === "string" && v.Description) ||
            undefined,
          Type: typeCandidate,
        };
      })
      .filter((r: any) => r.Warehouse);

    const count = firstCount != null ? firstCount : rows.length;

    return json({ ok: true, count, rows }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});