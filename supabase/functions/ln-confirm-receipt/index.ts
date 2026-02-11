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

const escOdataString = (s: string) => s.replace(/'/g, "''");

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: {
      transactionId?: string;
      etag?: string;
      receiptNumber?: string;
      receiptLine?: number;
      language?: string;
      company?: string;
      // legacy fallback fields
      origin?: string;
      order?: string;
      position?: number;
      sequence?: number;
      set?: number;
      packingSlip?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    let transactionId = (body.transactionId || "").toString();
    let etag = (body.etag || "").toString();
    const receiptNumber = (body.receiptNumber || "").toString();
    const receiptLine = typeof body.receiptLine === "number" ? body.receiptLine : NaN;

    const language = body.language || "en-US";
    const company = body.company || "4000";

    const origin = (body.origin || "").toString();
    const order = (body.order || "").toString();
    const position = typeof body.position === "number" ? body.position : NaN;
    const sequence = typeof body.sequence === "number" ? body.sequence : NaN;
    const setNum = typeof body.set === "number" ? body.set : NaN;
    const packingSlip = (body.packingSlip || "").toString();

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
      ci: string;
      cs: string;
      pu: string;
      ot: string;
      grant_type: string;
      saak: string;
      sask: string;
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
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    }).catch(() => null as unknown as Response);

    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = (await tokenRes.json().catch(() => null)) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;

    // If txId/etag are missing, look up by ReceiptNumber + ReceiptLine (preferred)
    if (!transactionId || !etag) {
      if (receiptNumber && Number.isFinite(receiptLine)) {
        const qs = new URLSearchParams();
        qs.set(
          "$filter",
          `ReceiptNumber eq '${escOdataString(receiptNumber)}' and ReceiptLine eq ${receiptLine}`,
        );
        qs.set("$select", "TransactionID");
        qs.set("$top", "1");
        const lookupUrl = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseReceipts/GSIReceipts?${qs.toString()}`;

        const lookupRes = await fetch(lookupUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
            "Content-Language": language,
            "X-Infor-LnCompany": company,
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => null as unknown as Response);

        if (!lookupRes) return json({ ok: false, error: "lookup_network_error" }, 200);
        const lookupJson = (await lookupRes.json().catch(() => null)) as any;
        if (!lookupRes.ok || !lookupJson || !Array.isArray(lookupJson?.value) || lookupJson.value.length === 0) {
          return json({ ok: false, error: "receipt_not_found" }, 200);
        }
        const rec = lookupJson.value[0];
        transactionId = String(rec?.TransactionID || "");
        etag = String(rec?.["@odata.etag"] || "");
      } else if (
        // legacy fallback (kept for compatibility)
        origin &&
        order &&
        Number.isFinite(position) &&
        Number.isFinite(sequence) &&
        Number.isFinite(setNum) &&
        packingSlip
      ) {
        const gsiQs = new URLSearchParams();
        gsiQs.set(
          "$filter",
          [
            `Confirm eq 'No'`,
            `OrderOrigin eq '${escOdataString(origin)}'`,
            `Order eq '${escOdataString(order)}'`,
            `Position eq ${position}`,
            `Sequence eq ${sequence}`,
            `Set eq ${setNum}`,
            `PackingSlip eq '${escOdataString(packingSlip)}'`,
          ].join(" and "),
        );
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
        const lookupJson = (await lookupRes.json().catch(() => null)) as any;
        if (!lookupRes.ok || !lookupJson || !Array.isArray(lookupJson?.value) || lookupJson.value.length === 0) {
          return json({ ok: false, error: "receipt_not_found" }, 200);
        }
        const rec = lookupJson.value[0];
        transactionId = String(rec?.TransactionID || "");
        etag = String(rec?.["@odata.etag"] || "");
      }
    }

    if (!transactionId || !etag) {
      return json({ ok: false, error: "missing_tx_or_etag" }, 200);
    }

    // PATCH GSIReceipts Confirm='Yes'
    const escapedTx = transactionId.replace(/'/g, "''");
    const url = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseReceipts/GSIReceipts(TransactionID='${escapedTx}')?$select=*`;

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
      return json(
        { ok: false, error: { message: topMessage, details }, status: patchRes.status, body: responseBody },
        200,
      );
    }

    return json({ ok: true, status: patchRes.status, body: responseBody }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});