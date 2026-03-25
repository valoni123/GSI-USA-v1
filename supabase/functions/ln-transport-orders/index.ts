import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ODATA_TIMEOUT_MS = 25_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
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
    const codeRaw = codeRawInput ?? "";
    const codeTrim = codeRaw.trim();
    const language = body.language || "de-DE";
    if (!codeTrim) {
      return json({ ok: false, error: "missing_code" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-transport-orders] missing env");
      return json({ ok: false, error: "env_missing" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);

    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const path = `/${cfg.ti}/LN/lnapi/odata/txgwi.TransportOrders/TransportOrders`;
    const escRaw = codeRaw.replace(/'/g, "''");
    const escTrim = codeTrim.replace(/'/g, "''");
    const filter =
      `(HandlingUnit eq '${escRaw}' or Item eq '${escRaw}'` +
      ` or HandlingUnit eq '${escTrim}' or Item eq '${escTrim}'` +
      ` or endswith(HandlingUnit,'${escTrim}') or endswith(Item,'${escTrim}'))`;
    const selectFields = [
      "TransportID",
      "RunNumber",
      "Item",
      "HandlingUnit",
      "Warehouse",
      "LocationFrom",
      "LocationTo",
      "OrderedQuantity",
    ].join(",");
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=${encodeURIComponent(selectFields)}`;

    let odataRes: Response;
    try {
      odataRes = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "Content-Language": language,
            "X-Infor-LnCompany": company,
            Authorization: `Bearer ${accessToken}`,
          },
        },
        ODATA_TIMEOUT_MS,
      );
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.error("[ln-transport-orders] odata request failed", {
        code: codeTrim,
        reason: isTimeout ? "timeout" : error instanceof Error ? error.message : String(error),
      });
      return json({ ok: false, error: isTimeout ? "odata_timeout" : "odata_network_error" }, 502);
    }

    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      console.error("[ln-transport-orders] odata_error", odataJson);
      return json({ ok: false, error: "odata_error", details: odataJson }, odataRes.status || 500);
    }

    const arr = Array.isArray(odataJson.value) ? odataJson.value : [];
    const count = odataJson["@odata.count"] ?? arr.length;
    const mapItem = (v: any) => ({
      TransportID: v?.TransportID ?? "",
      RunNumber: v?.RunNumber ?? "",
      Item: v?.Item ?? "",
      HandlingUnit: v?.HandlingUnit ?? "",
      Warehouse: v?.Warehouse ?? "",
      LocationFrom: v?.LocationFrom ?? "",
      LocationTo: v?.LocationTo ?? "",
      ETag: v?.["@odata.etag"] ?? "",
      OrderedQuantity: typeof v?.OrderedQuantity === "number" ? v.OrderedQuantity : null,
    });

    return json(
      {
        ok: true,
        count,
        first: arr.length > 0 ? mapItem(arr[0]) : null,
        items: arr.map(mapItem),
      },
      200,
    );
  } catch (e) {
    console.error("[ln-transport-orders] unhandled", e);
    return json({ ok: false, error: "unhandled" }, 500);
  }
});
