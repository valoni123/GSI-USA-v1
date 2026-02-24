import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseAdmin, getActiveConfig, fetchOData } from "../_shared/ionapi.ts";
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

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { handlingUnit?: string; item?: string; code?: string; language?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const codeRawInput = typeof body.code === "string"
      ? body.code
      : (typeof body.handlingUnit === "string"
          ? body.handlingUnit
          : (typeof body.item === "string" ? body.item : ""));
    const codeRaw = (codeRawInput ?? "");
    const codeTrim = codeRaw.trim();
    const language = body.language || "de-DE";
    const supabase = getSupabaseAdmin();
    const company = await getCompanyFromParams(supabase);
    if (!codeTrim) {
      return json({ ok: false, error: "missing_code" }, 400);
    }

    const cfg = await getActiveConfig(supabase);

    // Build LN OData URL via shared helper
    const escRaw = codeRaw.replace(/'/g, "''");
    const escTrim = codeTrim.replace(/'/g, "''");
    const filter =
      `(HandlingUnit eq '${escRaw}' or Item eq '${escRaw}'` +
      ` or HandlingUnit eq '${escTrim}' or Item eq '${escTrim}'` +
      ` or endswith(HandlingUnit,'${escTrim}') or endswith(Item,'${escTrim}'))`;

    const path = `/txgwi.TransportOrders/TransportOrders?$filter=${encodeURIComponent(filter)}&$count=true&$select=TransportID,RunNumber,Item,HandlingUnit,Warehouse,LocationFrom,LocationTo,OrderedQuantity`;
    const odataRes = await fetchOData(cfg, company, path, language);

    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      console.error("[ln-transport-orders] odata_error", odataJson);
      return json({ ok: false, error: "odata_error", details: odataJson }, odataRes.status || 500);
    }

    const count = odataJson["@odata.count"] ?? (Array.isArray(odataJson.value) ? odataJson.value.length : 0);
    const arr = Array.isArray(odataJson.value) ? odataJson.value : [];
    const first = arr.length > 0 ? arr[0] : null;

    return json({
      ok: true,
      count,
      first: first
        ? {
            TransportID: first.TransportID,
            RunNumber: first.RunNumber,
            Item: first.Item,
            HandlingUnit: first.HandlingUnit ?? "",
            Warehouse: first.Warehouse,
            LocationFrom: first.LocationFrom,
            LocationTo: first.LocationTo,
            ETag: first["@odata.etag"],
            OrderedQuantity: typeof first?.OrderedQuantity === "number" ? first.OrderedQuantity : null,
          }
        : null,
      items: arr.map((v: any) => ({
        TransportID: v?.TransportID ?? "",
        RunNumber: v?.RunNumber ?? "",
        Item: v?.Item ?? "",
        HandlingUnit: v?.HandlingUnit ?? "",
        Warehouse: v?.Warehouse ?? "",
        LocationFrom: v?.LocationFrom ?? "",
        LocationTo: v?.LocationTo ?? "",
        ETag: v?.["@odata.etag"] ?? "",
        OrderedQuantity: typeof v?.OrderedQuantity === "number" ? v.OrderedQuantity : null,
      })),
      raw: odataJson,
    }, 200);
  } catch (e) {
    console.error("[ln-transport-orders] unhandled", e);
    return json({ ok: false, error: "unhandled" }, 500);
  }
});