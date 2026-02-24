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
      handlingUnit?: string;
      item?: string;
      code?: string;
      vehicleId?: string;
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
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = body.company || (await getCompanyFromParams(supabase));

    // Active ionapi config (decrypted)
    const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) return json({ ok: false, error: "config_error" }, 200);
    const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
    if (!cfg) return json({ ok: false, error: "no_active_config" }, 200);

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };
    const grantType = grant_type === "password_credentials" ? "password" : (grant_type || "password");

    // Get iu and ti from active row
    const { data: activeRow, error: rowErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (rowErr || !activeRow) return json({ ok: false, error: "no_active_config_row" }, 200);
    const iu: string = String(activeRow.iu || "");
    const ti: string = String(activeRow.ti || "");

    // Mint a token
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

    // Prepare code to lookup
    const codeRawInput =
      typeof body.code === "string" ? body.code :
      (typeof body.handlingUnit === "string" ? body.handlingUnit :
      (typeof body.item === "string" ? body.item : ""));
    const codeRaw = String(codeRawInput || "");
    const codeTrim = codeRaw.trim();
    if (!codeTrim) return json({ ok: false, error: "missing_code" }, 200);

    // OData base
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const path = `/${ti}/LN/lnapi/odata/txgwi.TransportOrders/TransportOrders`;
    const escRaw = codeRaw.replace(/'/g, "''");
    const escTrim = codeTrim.replace(/'/g, "''");

    // Exact-first, then fallback with endswith(); use broader select and include count
    const selectClause = "$select=*";
    const exactFilter = `(HandlingUnit eq '${escTrim}' or Item eq '${escTrim}' or HandlingUnit eq '${escRaw}' or Item eq '${escRaw}')`;
    const fallbackFilter = `(${exactFilter} or endswith(HandlingUnit,'${escTrim}') or endswith(Item,'${escTrim}'))`;

    const exactUrl = `${base}${path}?$filter=${encodeURIComponent(exactFilter)}&$count=true&${selectClause}`;
    let odataRes = await fetch(exactUrl, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
      },
    }).catch(() => null as unknown as Response);
    if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
    let odataJson = await odataRes.json().catch(() => null) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    let ordersCount = odataJson["@odata.count"] ?? 0;
    let ordersArray = Array.isArray(odataJson.value) ? odataJson.value : [];

    if (!ordersCount || ordersArray.length === 0) {
      const fbUrl = `${base}${path}?$filter=${encodeURIComponent(fallbackFilter)}&$count=true&${selectClause}`;
      odataRes = await fetch(fbUrl, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          "Authorization": `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);
      if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
      odataJson = await odataRes.json().catch(() => null) as any;
      if (!odataRes.ok || !odataJson) {
        const topMessage = odataJson?.error?.message || "odata_error";
        const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
        return json({ ok: false, error: { message: topMessage, details } }, 200);
      }
      ordersCount = odataJson["@odata.count"] ?? 0;
      ordersArray = Array.isArray(odataJson.value) ? odataJson.value : [];
    }

    const first = ordersArray.length > 0 ? ordersArray[0] : null;

    const orders = {
      count: Number(ordersCount || 0),
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
      items: ordersArray.map((v: any) => ({
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
    };

    // Loaded check if HU and vehicleId provided
    let loadedCount = 0;
    const vehicleId = (body.vehicleId || "").trim();
    const chosenHU = (orders.first?.HandlingUnit || "").trim();
    if (chosenHU && vehicleId) {
      const lcFilter = `HandlingUnit eq '${chosenHU.replace(/'/g, "''")}' and VehicleID eq '${vehicleId.replace(/'/g, "''")}'`;
      const lcUrl = `${base}${path}?$filter=${encodeURIComponent(lcFilter)}&$count=true&$select=TransportID`;
      const lcRes = await fetch(lcUrl, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          "Authorization": `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);
      const lcJson = lcRes ? await lcRes.json().catch(() => null as any) : null;
      if (lcRes && lcRes.ok && lcJson) {
        loadedCount = Number(lcJson["@odata.count"] ?? 0);
      }
    }

    return json({ ok: true, orders, loadedCount }, 200);
  } catch (_e) {
    return json({ ok: false, error: "unhandled" }, 200);
  }
});