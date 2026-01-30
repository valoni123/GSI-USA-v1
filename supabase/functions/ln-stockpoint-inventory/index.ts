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

    let body: { item?: string; warehouse?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const rawItem = body.item || "";
    const trimmedItem = rawItem.trim();
    const paddedItem = `${" ".repeat(9)}${trimmedItem}`;
    const warehouse = (body.warehouse || "").trim();
    const location = (body as any).location ? String((body as any).location).trim() : "";
    const language = body.language || "en-US";
    const company = body.company || "1100";

    if (!trimmedItem || !warehouse) {
      return json({ ok: false, error: "missing_params" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get decrypted config
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // Get iu & ti
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
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
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

    // OData GET: StockPointInventory for item & warehouse, order by Location
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const encodedItem = paddedItem.replace(/'/g, "''");
    const encodedWh = warehouse.replace(/'/g, "''");
    const encodedLoc = location.replace(/'/g, "''");
    const path = `/${ti}/LN/lnapi/odata/whapi.inrStockPointInventory/Items(Item='${encodedItem}')/InventoryRefs`;
    const filterBase = `Warehouse eq '${encodedWh}'`;
    const filter =
      location
        ? `${filterBase} and Location eq '${encodedLoc}'`
        : filterBase;
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$select=*&$orderby=Location&$expand=*`;

    const odataRes = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
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
          const loc = v?.Location ?? v?.StockPoint ?? v?.LocationRef?.Location ?? "";
          const lot = v?.Lot ?? v?.Batch ?? v?.LotCode ?? "";
          const onHand = Number(v?.InventoryOnHand ?? 0);
          const allocated = Number(v?.InventoryAllocated ?? 0);
          const blocked = Number(v?.InventoryBlocked ?? 0);
          const available = onHand - allocated - blocked;
          const unit = v?.ItemRef?.InventoryUnit ?? v?.InventoryUnit ?? "";
          return {
            Location: String(loc || ""),
            Lot: String(lot || ""),
            Unit: String(unit || ""),
            OnHand: isNaN(onHand) ? 0 : onHand,
            Allocated: isNaN(allocated) ? 0 : allocated,
            Available: isNaN(available) ? 0 : available,
          };
        })
      : [];

    return json({ ok: true, rows }, 200);
  } catch {
    return json({ ok: false, error: "unhandled" }, 200);
  }
});