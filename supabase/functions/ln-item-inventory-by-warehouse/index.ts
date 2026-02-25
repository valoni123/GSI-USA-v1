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

    let body: { item?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const item = (body.item || "").trim();
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

    if (!item) return json({ ok: false, error: "missing_item" }, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Decrypted OAuth config
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // Active iu/ti
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

    // Build OData request
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const escapedItem = item.replace(/'/g, "''");

    const params = new URLSearchParams();
    params.set("$filter", `Item eq '${escapedItem}' and InventoryOnHand ge 0`);
    params.set("$count", "true");
    params.set("$select", "*");
    params.set("$orderby", "InventoryOnHand");
    params.set("$expand", "WarehouseRef");

    const path = `/${ti}/LN/lnapi/odata/whapi.wmdInventory/ItemInventoryByWarehouses`;
    const url = `${base}${path}?${params.toString()}`;

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
      ? odataJson.value.map((v: any) => {
          const wh = typeof v?.Warehouse === "string" ? v.Warehouse : (typeof v?.WarehouseRef?.Warehouse === "string" ? v.WarehouseRef.Warehouse : "");
          const whName = typeof v?.WarehouseRef?.Description === "string" ? v.WarehouseRef.Description : undefined;
          const unit = typeof v?.InventoryUnit === "string" ? v.InventoryUnit : (typeof v?.Unit === "string" ? v.Unit : undefined);
          const onHand = Number(v?.InventoryOnHand ?? v?.OnHand ?? 0);
          const allocated = Number(v?.Allocated ?? 0);
          const available = Number(v?.Available ?? (onHand - allocated));
          return {
            Warehouse: wh,
            WarehouseName: whName,
            Unit: unit,
            OnHand: onHand,
            Allocated: allocated,
            Available: available,
          };
        })
      : [];

    const count = typeof odataJson?.["@odata.count"] === "number"
      ? odataJson["@odata.count"]
      : rows.length;

    return json({ ok: true, count, rows }, 200);
  } catch (e) {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});