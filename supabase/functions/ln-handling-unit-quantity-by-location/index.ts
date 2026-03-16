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
  item?: string;
  warehouse?: string;
  locations?: string[];
  language?: string;
  company?: string;
};

function sumQuantity(rows: any[]) {
  return rows.reduce((sum, row) => {
    const value = Number(row?.QuantityInInventoryUnit ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const item = (body.item || "").trim();
    const warehouse = (body.warehouse || "").trim();
    const locations = Array.isArray(body.locations)
      ? body.locations.map((location) => String(location || "").trim()).filter(Boolean)
      : [];
    const language = (body.language || "en-US").trim() || "en-US";

    if (!item || !warehouse || locations.length === 0) {
      return json({ ok: false, error: "missing_params" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const paddedItem = `${" ".repeat(9)}${item}`;
    const escapedItem = paddedItem.replace(/'/g, "''");
    const escapedWarehouse = warehouse.replace(/'/g, "''");

    const fetchForLocation = async (location: string) => {
      const escapedLocation = location.replace(/'/g, "''");
      const params = new URLSearchParams();
      params.set(
        "$filter",
        `Item eq '${escapedItem}' and Warehouse eq '${escapedWarehouse}' and Location eq '${escapedLocation}' and Status eq whapi.wmdHandlingUnit.HandlingUnitStatus'InStock'`,
      );
      params.set("$count", "true");
      params.set("$select", "Unit,QuantityInInventoryUnit");
      params.set("$expand", "ItemRef");

      const url = `${base}/${cfg.ti}/LN/lnapi/odata/whapi.wmdHandlingUnit/HandlingUnits?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);

      if (!response) {
        return { Location: location, QuantityInInventoryUnit: 0, Unit: null, ok: false as const };
      }

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok || !payload) {
        return { Location: location, QuantityInInventoryUnit: 0, Unit: null, ok: false as const };
      }

      const rows = Array.isArray(payload.value) ? payload.value : [];
      const first = rows[0] || {};

      return {
        Location: location,
        QuantityInInventoryUnit: sumQuantity(rows),
        Unit: typeof first?.Unit === "string"
          ? first.Unit
          : typeof first?.ItemRef?.InventoryUnit === "string"
            ? first.ItemRef.InventoryUnit
            : null,
        ok: true as const,
      };
    };

    const results = await Promise.all(locations.map(fetchForLocation));
    return json({ ok: true, rows: results.map(({ ok: _ok, ...row }) => row) }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
