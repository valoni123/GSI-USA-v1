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

    let body: { handlingUnit?: string; item?: string; code?: string; language?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const codeRawInput = typeof body.code === "string"
      ? body.code
      : (typeof body.handlingUnit === "string"
          ? body.handlingUnit
          : (typeof body.item === "string" ? body.item : ""));
    const codeRaw = (codeRawInput ?? "");
    const codeTrim = codeRaw.trim();
    const language = body.language || "de-DE";
    const company = await (async () => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("env_missing");
      }
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      return await getCompanyFromParams(supabase);
    })();
    if (!codeTrim) {
      return json({ ok: false, error: "missing_code" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-transport-orders] missing env");
      return json({ ok: false, error: "env_missing" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get decrypted credentials via RPC
    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-transport-orders] get_active_ionapi error", cfgErr);
      return json({ ok: false, error: "config_error" }, 500);
    }
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) {
      return json({ ok: false, error: "no_active_config" }, 200);
    }
    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;

    // Get iu and ti from the active row (unencrypted fields)
    const { data: activeRow, error: activeErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (activeErr) {
      console.error("[ln-transport-orders] active row error", activeErr);
      return json({ ok: false, error: "config_lookup_error" }, 500);
    }
    if (!activeRow) {
      return json({ ok: false, error: "no_active_config_row" }, 200);
    }
    const iu: string = activeRow.iu;
    const ti: string = activeRow.ti;

    if (!ci || !cs || !pu || !ot || !iu || !ti || !saak || !sask || !grantType) {
      return json({ ok: false, error: "config_incomplete" }, 400);
    }

    // Request a token
    const basic = btoa(`${ci}:${cs}`);
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", grantType);
    tokenParams.set("username", saak);
    tokenParams.set("password", sask);

    let tokenRes: Response;
    try {
      tokenRes = await fetch(buildTokenUrl(pu, ot), {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      });
    } catch (e) {
      console.error("[ln-transport-orders] token network error", e);
      return json({ ok: false, error: "token_network_error" }, 502);
    }
    const tokenJson = await tokenRes.json().catch(() => null) as Record<string, unknown> | null;
    if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      console.error("[ln-transport-orders] token_error", tokenJson);
      return json({ ok: false, error: "token_error", details: tokenJson }, tokenRes.status || 500);
    }
    const accessToken = tokenJson.access_token as string;

    // Build LN OData URL
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/txgwi.TransportOrders/TransportOrders`;
    const escRaw = codeRaw.replace(/'/g, "''");
    const escTrim = codeTrim.replace(/'/g, "''");
    // Try exact raw, exact trimmed, and padded values via endswith()
    const filter =
      `(HandlingUnit eq '${escRaw}' or Item eq '${escRaw}'` +
      ` or HandlingUnit eq '${escTrim}' or Item eq '${escTrim}'` +
      ` or endswith(HandlingUnit,'${escTrim}') or endswith(Item,'${escTrim}'))`;
    const url = `${base}${path}?$filter=${encodeURIComponent(filter)}&$count=true&$select=*`;

    // Call OData
    let odataRes: Response;
    try {
      odataRes = await fetch(url, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          "Authorization": `Bearer ${accessToken}`,
        },
      });
    } catch (e) {
      console.error("[ln-transport-orders] odata network error", e);
      return json({ ok: false, error: "odata_network_error" }, 502);
    }

    const odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      console.error("[ln-transport-orders] odata_error", odataJson);
      return json({ ok: false, error: "odata_error", details: odataJson }, odataRes.status || 500);
    }

    const count = odataJson["@odata.count"] ?? (Array.isArray(odataJson.value) ? odataJson.value.length : 0);
    const arr = Array.isArray(odataJson.value) ? odataJson.value : [];
    const first = arr.length > 0 ? arr[0] : null;

    return json({
      ok: true,
      count,
      first: first
        ? {
            TransportID: first.TransportID,
            RunNumber: first.RunNumber,
            Item: first.Item,
            HandlingUnit: first.HandlingUnit ?? "",
            Warehouse: first.Warehouse,
            LocationFrom: first.LocationFrom,
            LocationTo: first.LocationTo,
            ETag: first["@odata.etag"],
            OrderedQuantity: typeof first?.OrderedQuantity === "number" ? first.OrderedQuantity : null,
          }
        : null,
      items: arr.map((v: any) => ({
        TransportID: v?.TransportID ?? "",
        RunNumber: v?.RunNumber ?? "",
        Item: v?.Item ?? "",
        HandlingUnit: v?.HandlingUnit ?? "",
        Warehouse: v?.Warehouse ?? "",
        LocationFrom: v?.LocationFrom ?? "",
        LocationTo: v?.LocationTo ?? "",
        ETag: v?.["@odata.etag"] ?? "",
        OrderedQuantity: typeof v?.OrderedQuantity === "number" ? v.OrderedQuantity : null,
      })),
      raw: odataJson,
    }, 200);
  } catch (e) {
    console.error("[ln-transport-orders] unhandled", e);
    return json({ ok: false, error: "unhandled" }, 500);
  }
});