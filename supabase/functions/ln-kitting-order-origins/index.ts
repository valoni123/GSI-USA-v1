import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUEST_TIMEOUT_MS = 15000;
const COMPANY = "0000";

type EnumerateRow = {
  ConstantName?: string;
  DescriptionLabel?: string;
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

function toText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-kitting-order-origins] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    console.info("[ln-kitting-order-origins] start");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;

    const params = new URLSearchParams();
    params.set("$filter", "Package eq 'wh' and Domain eq 'inh.oorg'");
    params.set("$select", "ConstantName,DescriptionLabel");

    let nextUrl = `${base}/${cfg.ti}/LN/lnapi/odata/txgwi.Domains/EnumeratesAndSets?${params.toString()}`;
    const deduped = new Map<string, { constantName: string; descriptionLabel: string }>();
    let pageCount = 0;

    while (nextUrl) {
      pageCount += 1;
      console.info("[ln-kitting-order-origins] requesting upstream", { pageCount, nextUrl });

      const response = await fetchWithTimeout(
        nextUrl,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "Content-Language": "en-US",
            "X-Infor-LnCompany": COMPANY,
            Authorization: `Bearer ${accessToken}`,
          },
        },
        REQUEST_TIMEOUT_MS,
      );

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok || !payload) {
        console.error("[ln-kitting-order-origins] upstream error", {
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

      const rows = Array.isArray(payload.value) ? (payload.value as EnumerateRow[]) : [];
      for (const row of rows) {
        const constantName = toText(row?.ConstantName);
        const descriptionLabel = toText(row?.DescriptionLabel);
        if (!constantName || !descriptionLabel || deduped.has(constantName)) continue;
        deduped.set(constantName, { constantName, descriptionLabel });
      }

      nextUrl = toText(payload?.["@odata.nextLink"]);
    }

    const rows = Array.from(deduped.values());
    console.info("[ln-kitting-order-origins] completed", { pageCount, count: rows.length });
    return json({ ok: true, rows }, 200);
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error("[ln-kitting-order-origins] unhandled error", {
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: isTimeout ? "odata_timeout" : "unhandled" }, 200);
  }
});
