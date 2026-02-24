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

    let body: {
      handlingUnit?: string;
      item?: string;
      code?: string;
      vehicleId?: string;
      language?: string;
      company?: string;
      lnToken?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const language = body.language || "en-US";
    const supabase = getSupabaseAdmin();
    const company = body.company || (await getCompanyFromParams(supabase));
    const cfg = await getActiveConfig(supabase);
    const lnToken = (body.lnToken || "").trim() || undefined;

    const rawCodeSource =
      typeof body.code === "string"
        ? body.code
        : typeof body.handlingUnit === "string"
          ? body.handlingUnit
          : typeof body.item === "string"
            ? body.item
            : "";

    const codeRaw = String(rawCodeSource || "");
    const codeTrim = codeRaw.trim();
    if (!codeTrim) {
      return json({ ok: false, error: "missing_code" }, 200);
    }

    // Transport order lookup: exact-first, fallback to endswith()
    const escRaw = codeRaw.replace(/'/g, "''");
    const escTrim = codeTrim.replace(/'/g, "''");

    const basePath = "/txgwi.TransportOrders/TransportOrders";
    const selectCols = "TransportID,RunNumber,Item,HandlingUnit,Warehouse,LocationFrom,LocationTo,OrderedQuantity";
    const exactFilter = `(HandlingUnit eq '${escTrim}' or Item eq '${escTrim}' or HandlingUnit eq '${escRaw}' or Item eq '${escRaw}')`;
    const fallbackFilter = `(${exactFilter} or endswith(HandlingUnit,'${escTrim}') or endswith(Item,'${escTrim}'))`;

    const exactUrl = `${basePath}?$filter=${encodeURIComponent(exactFilter)}&$select=${selectCols}&$top=10`;
    let odataRes = await fetchOData(cfg, company, exactUrl, language, lnToken);
    let odataJson: any = await odataRes.json().catch(() => null);

    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    let ordersCount = Array.isArray(odataJson?.value) ? odataJson.value.length : 0;
    let ordersArray = Array.isArray(odataJson?.value) ? odataJson.value : [];

    if (!ordersCount || ordersArray.length === 0) {
      const fbUrl = `${basePath}?$filter=${encodeURIComponent(fallbackFilter)}&$select=${selectCols}&$top=10`;
      odataRes = await fetchOData(cfg, company, fbUrl, language, lnToken);
      odataJson = await odataRes.json().catch(() => null);
      if (!odataRes.ok || !odataJson) {
        const topMessage = odataJson?.error?.message || "odata_error";
        const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
        return json({ ok: false, error: { message: topMessage, details } }, 200);
      }
      ordersCount = Array.isArray(odataJson?.value) ? odataJson.value.length : 0;
      ordersArray = Array.isArray(odataJson?.value) ? odataJson.value : [];
    }

    const first = ordersArray.length > 0 ? ordersArray[0] : null;

    const orders = {
      count: Number(ordersCount || 0),
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
      items: ordersArray.map((v: any) => ({
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
    };

    const chosenHU = ((orders.first?.HandlingUnit || "") as string).trim();

    // Loaded check if HU and vehicleId provided
    let loadedCount = 0;
    const vehicleId = (body.vehicleId || "").trim();
    if (chosenHU && vehicleId) {
      const lcFilter = `HandlingUnit eq '${chosenHU.replace(/'/g, "''")}' and VehicleID eq '${vehicleId.replace(/'/g, "''")}'`;
      const lcUrl = `${basePath}?$filter=${encodeURIComponent(lcFilter)}&$count=true&$select=TransportID`;
      const lcRes = await fetchOData(cfg, company, lcUrl, language, lnToken);
      const lcJson: any = await lcRes.json().catch(() => null);
      if (lcRes.ok && lcJson) {
        loadedCount = Number(lcJson["@odata.count"] ?? 0);
      }
    }

    return json({ ok: true, orders, loadedCount }, 200);
  } catch (_e) {
    return json({ ok: false, error: "unhandled" }, 200);
  }
});