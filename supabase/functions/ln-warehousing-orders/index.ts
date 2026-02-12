import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { orderNumber?: string; line?: number | string; orderOrigin?: string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const orderNumber = (body.orderNumber || "").trim();
    const originRaw = (body.orderOrigin || "").trim();
    const lineRaw = typeof body.line === "number" ? body.line : (typeof body.line === "string" ? body.line.trim() : "");
    const line = lineRaw !== "" && !Number.isNaN(Number(lineRaw)) ? Number(lineRaw) : null;
    const language = body.language || "en-US";
    const company = body.company || "4000";
    if (!orderNumber) {
      return json({ ok: false, error: "missing_order_number" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get decrypted credentials via RPC
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // Get iu and ti from active row
    const { data: activeRow } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!activeRow) return json({ ok: false, error: "no_active_config_row" }, 200);
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    // Token
    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // Build OData URL for Warehousing InboundLines filtered by Order
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/whapi.inhWarehousingOrder/InboundLines`;
    const escaped = orderNumber.replace(/'/g, "''");
    const filterParts = [`Order eq '${escaped}'`];
    if (originRaw) {
      // OData enum literal format: Namespace.EnumType'Value'
      filterParts.unshift(`OrderOrigin eq whapi.inhWarehousingOrder.OrderOrigin'${originRaw.replace(/'/g, "''")}'`);
    }
    if (line !== null) {
      filterParts.push(`Line eq ${line}`);
    }
    // Always require lines with a positive 'ToBeReceivedQuantity'
    filterParts.push(`ToBeReceivedQuantity gt 0`);
    // Optional LineStatus filter only when provided explicitly
    const lineStatusValue = (body as any)?.lineStatus ? String((body as any).lineStatus).trim() : "";
    if (lineStatusValue) {
      filterParts.push(`LineStatus eq whapi.inhWarehousingOrder.InboundOrderLineStatus'${lineStatusValue.replace(/'/g, "''")}'`);
    }
    const filter = filterParts.join(" and ");
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=%2A&$orderby=OrderOrigin&$expand=%2A`;

    const odataRes = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
      },
    }).catch(() => null as unknown as Response);
    if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const count = typeof odataJson?.["@odata.count"] === "number"
      ? odataJson["@odata.count"]
      : (Array.isArray(odataJson?.value) ? odataJson.value.length : 0);

    const first = Array.isArray(odataJson?.value) && odataJson.value.length > 0 ? odataJson.value[0] : null;
    const origin = first?.OrderOrigin ?? null;

    return json({ ok: true, count, origin, raw: odataJson }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});