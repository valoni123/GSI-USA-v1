import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, if-match",
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

    let body: { transactionId?: string; etag?: string; language?: string; company?: string; origin?: string; order?: string; position?: number; sequence?: number; set?: number; packingSlip?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const transactionId = (body.transactionId || "").toString();
    let etag = (body.etag || "").toString();
    const language = body.language || "en-US";
    const company = body.company || "4000";

    const origin = (body.origin || "").toString();
    const order = (body.order || "").toString();
    const position = typeof body.position === "number" ? body.position : NaN;
    const sequence = typeof body.sequence === "number" ? body.sequence : NaN;
    const setNum = typeof body.set === "number" ? body.set : NaN;
    const packingSlip = (body.packingSlip || "").toString();

    if (!transactionId || !etag) {
      return json({ ok: false, error: "missing_inputs" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Decrypted credentials
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // iu and ti
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

    // If transactionId/etag are missing, look up by fields
    let txIdToUse = transactionId;
    if (!txIdToUse || !etag) {
      if (!origin || !order || !Number.isFinite(position) || !Number.isFinite(sequence) || !Number.isFinite(setNum) || !packingSlip) {
        return json({ ok: false, error: "missing_inputs" }, 200);
      }

      const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
      const gsiQs = new URLSearchParams();
      gsiQs.set("$filter", [
        `Confirm eq 'No'`,
        `OrderOrigin eq '${origin.replace(/'/g, "''")}'`,
        `Order eq '${order.replace(/'/g, "''")}'`,
        `Position eq ${position}`,
        `Sequence eq ${sequence}`,
        `Set eq ${setNum}`,
        `PackingSlip eq '${packingSlip.replace(/'/g, "''")}'`,
      ].join(" and "));
      gsiQs.set("$select", "*");
      gsiQs.set("$top", "1");
      const gsiUrl = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseReceipts/GSIReceipts?${gsiQs.toString()}`;

      const lookupRes = await fetch(gsiUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);
      if (!lookupRes) return json({ ok: false, error: "lookup_network_error" }, 200);
      const lookupJson = await lookupRes.json().catch(() => null) as any;
      if (!lookupRes.ok || !lookupJson || !Array.isArray(lookupJson?.value) || lookupJson.value.length === 0) {
        return json({ ok: false, error: "receipt_not_found" }, 200);
      }
      const rec = lookupJson.value[0];
      txIdToUse = String(rec?.TransactionID || "");
      etag = String(rec?.["@odata.etag"] || "");
      if (!txIdToUse || !etag) {
        return json({ ok: false, error: "missing_tx_or_etag" }, 200);
      }
    }

    // PATCH GSIReceipts Confirm='Yes'
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const escaped = txIdToUse.replace(/'/g, "''");
    const url = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseReceipts/GSIReceipts(TransactionID='${escaped}')?$select=*`;

    const patchRes = await fetch(url, {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        "If-Match": etag,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ Confirm: "Yes" }),
    }).catch(() => null as unknown as Response);

    if (!patchRes) return json({ ok: false, error: "patch_network_error" }, 200);

    const contentType = patchRes.headers.get("Content-Type") || "";
    const responseBody = contentType.includes("application/json")
      ? await patchRes.json().catch(() => null)
      : await patchRes.text().catch(() => null);

    if (!patchRes.ok) {
      const topMessage = (responseBody as any)?.error?.message || "patch_error";
      const details = Array.isArray((responseBody as any)?.error?.details) ? (responseBody as any).error.details : [];
      return json({ ok: false, error: { message: topMessage, details }, status: patchRes.status, body: responseBody }, 200);
    }

    return json({ ok: true, status: patchRes.status, body: responseBody }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});