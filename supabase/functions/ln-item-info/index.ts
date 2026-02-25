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

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { item?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const itemCode = (body.item || "").trim();
    const language = body.language || "en-US";
    if (!itemCode) {
      return json({ ok: false, error: "missing_item" }, 200);
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

    // Build LN OData base URL
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    // LN project items may require 9 leading spaces before the item code.
    const trimmed = (itemCode || "").trim();
    const nineSpaced = `         ${trimmed}`; // exactly 9 leading spaces
    const candidates = [trimmed, nineSpaced]
      .filter((v, i, arr) => typeof v === "string" && v.length > 0 && arr.indexOf(v) === i);

    let entity: any = null;
    let lastError: any = null;
    for (const candidate of candidates) {
      const escaped = candidate.replace(/'/g, "''");
      const path = `/${cfg.ti}/LN/lnapi/odata/tcapi.ibdItem/Items(Item='${escaped}')`;
      const url = `${base}${path}?$select=%2A&$expand=InventoryUnitRef`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);
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
      const topMessage = lastError?.error?.message || "odata_error";
      const details = Array.isArray(lastError?.error?.details) ? lastError.error.details : [];
      return json({ ok: false, error: topMessage, details }, 404);
    }

    const item = entity.Item ?? entity.ItemCode ?? itemCode;
    const description = entity.Description ?? entity.ItemDescription ?? null;
    const unit = entity.InventoryUnit ?? entity?.InventoryUnitRef?.Unit ?? entity.Unit ?? null;

    return json({ ok: true, item, description, unit }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});