import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";

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
      language?: string;
      company?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const language = body.language || "en-US";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "env_missing" }, 200);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);

    // OAuth config
    const { data: cfgData } = await supabase.rpc("get_active_ionapi");
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type } = cfg as { ci: string; cs: string; pu: string; ot: string; grant_type: string };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // IU/TI
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
    const paramsToken = new URLSearchParams();
    paramsToken.set("grant_type", grantType);
    const { saak, sask } = cfg as { saak: string; sask: string };
    paramsToken.set("username", saak);
    paramsToken.set("password", sask);

    const tokenRes = await fetch(buildTokenUrl(pu, ot), {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: paramsToken.toString(),
    }).catch(() => null as unknown as Response);
    if (!tokenRes) return json({ ok: false, error: "token_network_error" }, 200);
    const tokenJson = await tokenRes.json().catch(() => null) as any;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      return json({ ok: false, error: { message: tokenJson?.error_description || "token_error" } }, 200);
    }
    const accessToken = tokenJson.access_token as string;

    // Build LN POST
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/txgsi.apiTRANSFER/GSITransfers`;
    const url = `${base}${path}?$select=TransferID`;

    const postPayload = {
      TransferID: "",
      VonLager: (body.VonLager || "").trim(),
      VonLagerplatz: (body.VonLagerplatz || "").trim(),
      InLager: (body.InLager || "").trim(),
      AufLagerplatz: (body.AufLagerplatz || "").trim(),
      Ladeeinheit: (body.Ladeeinheit || "").trim(),
      Menge: Number(body.Menge || 0),
      LoginCode: (body.LoginCode || "").trim(),
      Mitarbeiter: (body.Mitarbeiter || "").trim(),
      FromWebserver: "Yes",
    };

    const lnRes = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(postPayload),
    }).catch(() => null as unknown as Response);
    if (!lnRes) return json({ ok: false, error: "odata_network_error" }, 200);
    const lnJson = await lnRes.json().catch(() => null) as any;
    if (!lnRes.ok || !lnJson) {
      const top = lnJson?.error?.message || "odata_error";
      const details = Array.isArray(lnJson?.error?.details) ? lnJson.error.details : [];
      return json({ ok: false, error: { message: top, details } }, 200);
    }

    const transferId = typeof lnJson?.TransferID === "string" ? lnJson.TransferID : null;
    return json({ ok: true, transferId, raw: lnJson }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});