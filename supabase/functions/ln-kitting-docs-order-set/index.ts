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

type RequestBody = {
  order?: string;
  set?: string | number;
  language?: string;
  company?: string;
};

type GroupedComponent = {
  orderOrigin: string;
  order: string;
  line: number;
  sequence: number;
  set: number;
  bomLine: number;
  component: string;
  warehouse: string;
  quantity: number;
  orderedQuantity: number;
  originallyOrderedQuantity: number;
};

type GroupedLine = {
  orderOrigin: string;
  order: string;
  set: number;
  line: number;
  sequence: number;
  item: string;
  shippingWarehouse: string;
  orderUnit: string;
  orderedQuantity: number;
  originallyOrderedQuantity: number;
  lineStatus: string;
  components: GroupedComponent[];
};

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

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function lineKey(row: any) {
  return [
    toText(row?.OrderOrigin),
    toText(row?.Order),
    toNumber(row?.Line),
    toNumber(row?.Sequence),
    toNumber(row?.Set),
  ].join("|");
}

function componentKey(row: any) {
  return [
    toText(row?.OrderOrigin),
    toText(row?.Order),
    toNumber(row?.Line),
    toNumber(row?.Sequence),
    toNumber(row?.Set),
    toNumber(row?.BOMLine),
    toText(row?.Component),
  ].join("|");
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
      console.error("[ln-kitting-docs-order-set] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const order = toText(body.order);
    const setValue = toNumber(body.set);
    const language = toText(body.language) || "en-US";

    if (!order) {
      console.warn("[ln-kitting-docs-order-set] missing order");
      return json({ ok: false, error: "missing_order" }, 200);
    }
    if (!Number.isInteger(setValue)) {
      console.warn("[ln-kitting-docs-order-set] invalid set", { set: body.set });
      return json({ ok: false, error: "invalid_set" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-kitting-docs-order-set] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    console.info("[ln-kitting-docs-order-set] start", { order, set: setValue, language });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = toText(body.company) || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const escapedOrder = order.replace(/'/g, "''");

    const params = new URLSearchParams();
    params.set("$filter", "OutboundOrderLines/Order eq OutboundOrderLineBOMs/Order");
    params.set(
      "$expand",
      `OutboundOrderLines($select=*;$filter=Order eq '${escapedOrder}' and Set eq ${setValue}),OutboundOrderLineBOMs($select=*)`,
    );

    const url = `${base}/${cfg.ti}/LN/lnapi/odata/txgwi.OutboundOrderLines/$crossjoin(OutboundOrderLines,OutboundOrderLineBOMs)?${params.toString()}`;
    console.info("[ln-kitting-docs-order-set] requesting upstream", { order, set: setValue, timeoutMs: REQUEST_TIMEOUT_MS });

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
        console.error("[ln-kitting-docs-order-set] upstream error", {
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

      const lineMap = new Map<string, GroupedLine & { componentMap: Map<string, GroupedComponent> }>();
      const rows = Array.isArray(payload.value) ? payload.value : [];

      for (const row of rows) {
        const line = row?.OutboundOrderLines;
        if (!line) continue;

        const key = lineKey(line);
        let grouped = lineMap.get(key);
        if (!grouped) {
          grouped = {
            orderOrigin: toText(line?.OrderOrigin),
            order: toText(line?.Order),
            set: toNumber(line?.Set),
            line: toNumber(line?.Line),
            sequence: toNumber(line?.Sequence),
            item: toText(line?.Item),
            shippingWarehouse: toText(line?.ShippingWarehouse),
            orderUnit: toText(line?.OrderUnit),
            orderedQuantity: toNumber(line?.OrderedQuantity),
            originallyOrderedQuantity: toNumber(line?.OriginallyOrderedQuantity),
            lineStatus: toText(line?.LineStatus),
            components: [],
            componentMap: new Map<string, GroupedComponent>(),
          };
          lineMap.set(key, grouped);
        }

        const bom = row?.OutboundOrderLineBOMs;
        if (!bom) continue;
        if (lineKey(bom) !== key) continue;

        const bomKey = componentKey(bom);
        if (grouped.componentMap.has(bomKey)) continue;

        grouped.componentMap.set(bomKey, {
          orderOrigin: toText(bom?.OrderOrigin),
          order: toText(bom?.Order),
          line: toNumber(bom?.Line),
          sequence: toNumber(bom?.Sequence),
          set: toNumber(bom?.Set),
          bomLine: toNumber(bom?.BOMLine),
          component: toText(bom?.Component),
          warehouse: toText(bom?.Warehouse),
          quantity: toNumber(bom?.Quantity),
          orderedQuantity: toNumber(bom?.OrderedQuantity),
          originallyOrderedQuantity: toNumber(bom?.OriginallyOrderedQuantity),
        });
      }

      const lines = Array.from(lineMap.values())
        .map(({ componentMap, ...line }) => ({
          ...line,
          components: Array.from(componentMap.values()).sort((a, b) => a.bomLine - b.bomLine),
        }))
        .sort((a, b) => a.line - b.line || a.sequence - b.sequence || a.set - b.set);

      console.info("[ln-kitting-docs-order-set] completed", {
        order,
        set: setValue,
        rawRows: rows.length,
        lineCount: lines.length,
      });

      return json({ ok: true, count: lines.length, lines }, 200);
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.error("[ln-kitting-docs-order-set] upstream request failed", {
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ ok: false, error: isTimeout ? "odata_timeout" : "odata_network_error", details: [] }, 200);
    }
  } catch (error) {
    console.error("[ln-kitting-docs-order-set] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
