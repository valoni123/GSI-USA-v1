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
const SELECT_FIELDS = "OrderOrigin,Order,Set,Line,Sequence,Item,Lot,Warehouse,Location,LocationTo,Unit,AdvisedQuantityInInventoryUnit,Picked";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  run?: string;
  language?: string;
  company?: string;
};

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
      console.error("[ln-outbound-advices-by-run] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const run = (body.run || "").trim();
    const language = (body.language || "en-US").trim() || "en-US";
    if (!run) {
      console.warn("[ln-outbound-advices-by-run] missing run");
      return json({ ok: false, error: "missing_run" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-outbound-advices-by-run] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    console.info("[ln-outbound-advices-by-run] start", { run, language });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;

    const escapedRun = run.replace(/'/g, "''");
    const params = new URLSearchParams();
    params.set(
      "$filter",
      `Run eq '${escapedRun}' and Released eq whapi.inhOutboundAdvice.AnswerOnQuestionYn'Yes'`,
    );
    params.set("$count", "true");
    params.set("$select", SELECT_FIELDS);
    params.set("$expand", "ItemRef");

    const url = `${base}/${cfg.ti}/LN/lnapi/odata/whapi.inhOutboundAdvice/OutboundAdvices?${params.toString()}`;
    console.info("[ln-outbound-advices-by-run] requesting upstream", { run, timeoutMs: REQUEST_TIMEOUT_MS });

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
        console.error("[ln-outbound-advices-by-run] upstream error", {
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
            OrderOrigin: row?.OrderOrigin == null ? "" : String(row.OrderOrigin),
            Order: row?.Order == null ? "" : String(row.Order),
            Set: row?.Set == null ? "" : String(row.Set),
            Line: row?.Line == null ? "" : String(row.Line),
            Sequence: row?.Sequence == null ? "" : String(row.Sequence),
            Item: row?.Item == null ? "" : String(row.Item),
            ItemDescription:
              typeof row?.ItemRef?.Description === "string"
                ? row.ItemRef.Description
                : typeof row?.ItemRef?.ItemDescription === "string"
                  ? row.ItemRef.ItemDescription
                  : "",
            Lot: row?.Lot == null ? "" : String(row.Lot),
            Warehouse: row?.Warehouse == null ? "" : String(row.Warehouse),
            Location: row?.Location == null ? "" : String(row.Location),
            LocationTo: row?.LocationTo == null ? "" : String(row.LocationTo),
            Unit: row?.Unit == null ? "" : String(row.Unit),
            AdvisedQuantityInInventoryUnit: toNumber(row?.AdvisedQuantityInInventoryUnit),
            Picked: row?.Picked == null ? "" : String(row.Picked),
            Run: run,
          }))
        : [];

      const count = typeof payload?.["@odata.count"] === "number" ? payload["@odata.count"] : rows.length;
      console.info("[ln-outbound-advices-by-run] completed", { run, count, rows: rows.length });
      return json({ ok: true, count, rows }, 200);
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.error("[ln-outbound-advices-by-run] upstream request failed", {
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ ok: false, error: isTimeout ? "odata_timeout" : "odata_network_error", details: [] }, 200);
    }
  } catch (error) {
    console.error("[ln-outbound-advices-by-run] unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
