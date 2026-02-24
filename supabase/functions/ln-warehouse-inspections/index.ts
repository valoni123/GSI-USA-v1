import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { getSupabaseAdmin, getActiveConfig, fetchOData } from "../_shared/ionapi.ts";
import { getCompanyFromParams } from "../_shared/company.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const companyOverride = url.searchParams.get('company') || '';

    if (!q) {
      return new Response(JSON.stringify({ error: "Missing q parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();
    let company = companyOverride.trim();
    if (!company) {
      try {
        company = await getCompanyFromParams(supabase);
      } catch {
        return new Response(JSON.stringify({ error: "no_company_config" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const cfg = await getActiveConfig(supabase);
    const escaped = q.replace(/'/g, "''");
    const filter = `(InspectionStatus ne txgsi.WarehouseInspections.WarehouseInspectionStatus'Processed') and (Order eq '${escaped}' or Inspection eq '${escaped}' or HandlingUnit eq '${escaped}')`;

    const qs = new URLSearchParams();
    qs.set("$filter", filter);
    qs.set("$count", "true");
    // Only select fields the UI uses
    qs.set("$select", [
      "Order",
      "OrderOrigin",
      "HandlingUnit",
      "Inspection",
      "InspectionStatus",
      "Line",
      "InspectionSequence",
      "Item",
      "QuantityToBeInspectedInStorageUnit",
      "StorageUnit",
      "ItemRef/Item",
      "ItemRef/Description",
    ].join(","));
    qs.set("$expand", "ItemRef");
    qs.set("$orderby", "Line");

    const res = await fetchOData(cfg, company, `/txgsi.WarehouseInspections/WarehouseInspections?${qs.toString()}`, "en-US");
    if (!res) {
      return new Response(JSON.stringify({ error: "odata_network_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = await res.json().catch(async () => {
      const txt = await res.text().catch(() => "");
      return { parse_error: true, text: txt };
    });
    if (!res.ok || (payload && payload.parse_error)) {
      return new Response(JSON.stringify({ error: "OData request failed", details: payload }), {
        status: res.ok ? 500 : res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
})