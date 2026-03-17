import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUEST_TIMEOUT_MS = 15000;
const SELECT_FIELDS = "HandlingUnit,Status,Unit,QuantityInInventoryUnit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  item?: string;
  warehouse?: string;
  location?: string;
  language?: string;
  company?: string;
};

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      console.error("[ln-handling-unit-stock] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const item = (body.item || "").trim();
    const warehouse = (body.warehouse || "").trim();
    const location = (body.location || "").trim();
    const language = (body.language || "en-US").trim() || "en-US";

    if (!item || !warehouse || !location) {
      console.warn("[ln-handling-unit-stock] missing params", { item, warehouse, location });
      return json({ ok: false, error: "missing_params" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-handling-unit-stock] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    console.info("[ln-handling-unit-stock] start", { item, warehouse, location, language });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;

    const paddedItem = `${" ".repeat(9)}${item}`;
    const escapedItem = paddedItem.replace(/'/g, "''");
    const escapedWarehouse = warehouse.replace(/'/g, "''");
    const escapedLocation = location.replace(/'/g, "''");

    const params = new URLSearchParams();
    params.set(
      "$filter",
      `Item eq '${escapedItem}' and Warehouse eq '${escapedWarehouse}' and Location eq '${escapedLocation}' and Status ne whapi.wmdHandlingUnit.HandlingUnitStatus'Closed'`,
    );
    params.set("$count", "true");
    params.set("$select", SELECT_FIELDS);

    const url = `${base}/${cfg.ti}/LN/lnapi/odata/whapi.wmdHandlingUnit/HandlingUnits?${params.toString()}`;
    console.info("[ln-handling-unit-stock] requesting upstream", {
      paddedItem,
      warehouse,
      location,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    try {
      const response = await fetchWithTimeout(
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
        REQUEST_TIMEOUT_MS,
      );

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok || !payload) {
        console.error("[ln-handling-unit-stock] upstream error", {
          status: response.status,
          error: payload?.error?.message || "odata_error",
        });
        return json(
          {
            ok: false,
            error: payload?.error?.message || "odata_error",
            details: Array.isArray(payload?.error?.details) ? payload.error.details : [],
          },
          200,
        );
      }

      const rows = Array.isArray(payload.value)
        ? payload.value.map((row: any) => ({
            HandlingUnit: String(row?.HandlingUnit || ""),
            Status: row?.Status == null ? null : String(row.Status),
            Unit: row?.Unit == null ? null : String(row.Unit),
            QuantityInInventoryUnit: toNumber(row?.QuantityInInventoryUnit),
          }))
        : [];

      console.info("[ln-handling-unit-stock] completed", {
        item,
        warehouse,
        location,
        count: typeof payload?.["@odata.count"] === "number" ? payload["@odata.count"] : rows.length,
        rows: rows.length,
      });

      return json(
        {
          ok: true,
          count: typeof payload?.["@odata.count"] === "number" ? payload["@odata.count"] : rows.length,
          rows,
        },
        200,
      );
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.error("[ln-handling-unit-stock] upstream request failed", {
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ ok: false, error: isTimeout ? "odata_timeout" : "odata_network_error", details: [] }, 200);
    }
  } catch (error) {
    console.error("[ln-handling-unit-stock] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
