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

    let body: {
      language?: string;
      company?: string;
      TransferID?: string;
      VonLager?: string;
      VonLagerplatz?: string;
      InLager?: string;
      AufLagerplatz?: string;
      Ladeeinheit?: string;
      Menge?: number;
      LoginCode?: string;
      Mitarbeiter?: string;
      FromWebserver?: string;
      Artikel?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      console.error("[ln-transfer-handling-unit] invalid json body");
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const language = body.language || "en-US";
    console.info("[ln-transfer-handling-unit] request received", {
      language,
      hasHandlingUnit: Boolean((body.Ladeeinheit || "").toString().trim()),
      hasArtikel: Boolean((body.Artikel || "").toString().trim()),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-transfer-handling-unit] missing env");
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: compRes, error: compErr } = await supabase
      .from("gsi000_params")
      .select("txgsi000_compnr, created_at")
      .not("txgsi000_compnr", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (compErr || !Array.isArray(compRes) || compRes.length === 0) {
      console.error("[ln-transfer-handling-unit] missing company config", { compErr });
      return json({ ok: false, error: "no_company_config" }, 200);
    }
    const company = (compRes[0]?.txgsi000_compnr || "").toString().trim();

    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      console.error("[ln-transfer-handling-unit] no active ionapi config");
      return json({ ok: false, error: "no_active_config" }, 200);
    }

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    const { data: activeRow } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!activeRow) {
      console.error("[ln-transfer-handling-unit] no active ionapi row");
      return json({ ok: false, error: "no_active_config_row" }, 200);
    }
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

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
    if (!tokenRes) {
      console.error("[ln-transfer-handling-unit] token network error");
      return json({ ok: false, error: "token_network_error" }, 200);
    }
    const tokenJson = (await tokenRes.json().catch(() => null)) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      console.error("[ln-transfer-handling-unit] token error", { status: tokenRes.status, tokenJson });
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/txgsi.WarehouseMovement/Transfers`;
    const url = `${base}${path}?$select=*`;
    console.info("[ln-transfer-handling-unit] posting to ln", { url, path, company, language });

    const lnPayload: Record<string, unknown> = {
      FromWarehouse: (body.VonLager || "").trim(),
      FromLocation: (body.VonLagerplatz || "").trim(),
      ToWarehouse: (body.InLager || "").trim(),
      ToLocation: (body.AufLagerplatz || "").trim(),
      Quantity: Number(body.Menge || 0),
      LoginCode: (body.LoginCode || "").trim(),
      Employee: (body.Mitarbeiter || "").trim(),
      FromWebserver: "Yes",
      Automatisch: "No",
    };

    const artikelRaw = (body.Artikel || "").toString();
    const artikelTrim = artikelRaw.trim();
    if (artikelRaw || artikelTrim) {
      lnPayload.Item = artikelRaw || artikelTrim;
    } else {
      lnPayload.HandlingUnit = (body.Ladeeinheit || "").toString().trim();
    }

    const lnRes = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(lnPayload),
    }).catch(() => null as unknown as Response);

    if (!lnRes) {
      console.error("[ln-transfer-handling-unit] ln network error");
      return json({ ok: false, error: "ln_network_error" }, 200);
    }
    const lnJson = (await lnRes.json().catch(() => null)) as any;
    if (!lnRes.ok || !lnJson) {
      const top = lnJson?.error?.message || "ln_error";
      const details = Array.isArray(lnJson?.error?.details) ? lnJson.error.details : [];
      console.error("[ln-transfer-handling-unit] ln error", { status: lnRes.status, top, details, lnJson });
      return json({ ok: false, error: { message: top, details } }, 200);
    }

    const transferId = typeof lnJson?.TransferID === "string" ? lnJson.TransferID : null;
    console.info("[ln-transfer-handling-unit] success", { transferId });
    return json({ ok: true, transferId, raw: lnJson }, 200);
  } catch (error) {
    console.error("[ln-transfer-handling-unit] unhandled", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});