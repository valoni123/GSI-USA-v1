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

const escOdataString = (s: string) => s.replace(/'/g, "''");

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { inspection?: string; sequence?: number | string; language?: string; company?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const inspection = (body.inspection || "").toString().trim();
    const seqRaw = body.sequence;
    const sequence = typeof seqRaw === "number"
      ? seqRaw
      : (typeof seqRaw === "string" ? Number(seqRaw.trim()) : NaN);
    const language = body.language || "en-US";
    const companyOverride = (body.company || "").toString().trim();

    if (!inspection || !Number.isFinite(sequence)) {
      return json({ ok: false, error: "missing_inputs" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Company: use override if provided, else read from params
    let company = companyOverride;
    if (!company) {
      try {
        company = await getCompanyFromParams(supabase);
      } catch {
        return json({ ok: false, error: "no_company_config" }, 200);
      }
    }

    // Decrypted config
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

    // OData query: InspectionLines by inspection + sequence
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const escapedInspection = escOdataString(inspection);
    const filter = [
      `Inspection eq '${escapedInspection}'`,
      `InspectionSequence eq ${sequence}`
    ].join(" and ");

    const qs = new URLSearchParams();
    qs.set("$filter", filter);
    qs.set("$count", "true");
    qs.set("$select", "*");
    qs.set("$orderby", "Position");

    const url = `${base}/${ti}/LN/lnapi/odata/txgsi.InspectionLines/InspectionLines?${qs.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
      },
    }).catch(() => null as unknown as Response);
    if (!res) return json({ ok: false, error: "odata_network_error" }, 200);
    const ojson = await res.json().catch(() => null) as any;
    if (!res.ok || !ojson) {
      const topMessage = ojson?.error?.message || "odata_error";
      const details = Array.isArray(ojson?.error?.details) ? ojson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const value = Array.isArray(ojson?.value) ? ojson.value : [];
    const count =
      typeof ojson?.["@odata.count"] === "number"
        ? ojson["@odata.count"]
        : value.length;

    return json({ ok: true, count, value }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});