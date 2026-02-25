import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessTokenInfo, getIonApiConfigInfo } from "../_shared/ionapi.ts";

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

const itemSelect = [
  "Item",
  "Description",
  "ItemDescription",
  "InventoryUnit",
  "Unit",
].join(",");

serve(async (req) => {
  const rid = crypto.randomUUID();
  const t0 = performance.now();

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { item?: string; language?: string; company?: string; debug?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const itemCode = (body.item || "").trim();
    const language = body.language || "en-US";
    const debug = !!body.debug;

    if (!itemCode) {
      return json({ ok: false, error: "missing_item" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tCompany0 = performance.now();
    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const companyMs = performance.now() - tCompany0;

    const tCfg0 = performance.now();
    const cfgInfo = await getIonApiConfigInfo(supabase);
    const cfgMs = performance.now() - tCfg0;

    const tTok0 = performance.now();
    const tokInfo = await getIonApiAccessTokenInfo(supabase);
    const tokenMs = performance.now() - tTok0;

    // Build LN OData base URL
    const base = cfgInfo.config.iu.endsWith("/") ? cfgInfo.config.iu.slice(0, -1) : cfgInfo.config.iu;
    // LN project items may require 9 leading spaces before the item code.
    const trimmed = (itemCode || "").trim();
    const nineSpaced = `         ${trimmed}`; // exactly 9 leading spaces
    const candidates = [trimmed, nineSpaced]
      .filter((v, i, arr) => typeof v === "string" && v.length > 0 && arr.indexOf(v) === i);

    let entity: any = null;
    let lastError: any = null;
    let odataMs = 0;

    for (const candidate of candidates) {
      const escaped = candidate.replace(/'/g, "''");
      const path = `/${cfgInfo.config.ti}/LN/lnapi/odata/tcapi.ibdItem/Items(Item='${escaped}')`;
      const url = `${base}${path}?$select=${encodeURIComponent(itemSelect)}`;

      const tOdata0 = performance.now();
      const res = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${tokInfo.token}`,
        },
      }).catch(() => null as unknown as Response);
      odataMs += performance.now() - tOdata0;

      if (!res) {
        lastError = { error: "odata_network_error" };
        continue;
      }
      const resBody = (await res.json().catch(() => null)) as any;
      if (!res.ok || !resBody) {
        lastError = resBody;
        continue;
      }
      entity =
        resBody && typeof resBody === "object" && !Array.isArray(resBody)
          ? resBody
          : Array.isArray(resBody?.value) && resBody.value.length > 0
            ? resBody.value[0]
            : null;
      if (entity) break;
    }

    if (!entity) {
      const rawTopMessage = lastError?.error?.message || "odata_error";
      const topMessage =
        typeof rawTopMessage === "string" && rawTopMessage.toLowerCase().includes("cannot be read from table items")
          ? "not_found"
          : rawTopMessage;
      const details = Array.isArray(lastError?.error?.details) ? lastError.error.details : [];
      const totalMs = performance.now() - t0;
      if (debug) {
        console.log("[ln-item-info] error", {
          rid,
          item: itemCode,
          totalMs,
          companyMs,
          cfgMs,
          cfgCached: cfgInfo.cached,
          tokenMs,
          tokenCached: tokInfo.cached,
          odataMs,
        });
      }
      return json({ ok: false, error: topMessage, details }, 404);
    }

    const item = entity.Item ?? entity.ItemCode ?? itemCode;
    const description = entity.Description ?? entity.ItemDescription ?? null;
    const unit = entity.InventoryUnit ?? entity.Unit ?? null;

    const totalMs = performance.now() - t0;
    const perf = debug
      ? {
          rid,
          totalMs,
          companyMs,
          cfgMs,
          cfgCached: cfgInfo.cached,
          tokenMs,
          tokenCached: tokInfo.cached,
          odataMs,
        }
      : undefined;

    if (debug) {
      console.log("[ln-item-info] ok", perf);
    }

    return json({ ok: true, item, description, unit, ...(perf ? { perf } : {}) }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});