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
      item?: string;
      origin?: string;
      buyFromBusinessPartner?: string;
      lot?: string;
      language?: string;
      company?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const item = (body.item || "").toString();
    const origin = (body.origin || "").toString();
    const bp = (body.buyFromBusinessPartner || "").toString();
    const lot = (body.lot || "").toString();
    const language = body.language || "en-US";
    const company = body.company || "4000";

    if (!item) {
      return json({ ok: false, error: "missing_item" }, 200);
    }
    if (!origin) {
      return json({ ok: false, error: "missing_origin" }, 200);
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

    // Compose OData filter for Lots
    const escapedItem = item.replace(/'/g, "''");
    const originRaw = origin.toString();
    const originLower = originRaw.toLowerCase();
    let originName = "Purchase";
    if (originLower.includes("production")) originName = "Production";
    else if (originLower.includes("purchase")) originName = "Purchase";

    let filter = `Item eq '${escapedItem}' and LotType eq whapi.ltcLot.LotOrigin'${originName}'`;
    if (originName === "Purchase" && bp) {
      const escapedBp = bp.replace(/'/g, "''");
      filter += ` and BuyfromBusinessPartner eq '${escapedBp}'`;
    }

    const lotTrim = lot.trim();
    if (lotTrim) {
      const escapedLot = lotTrim.replace(/'/g, "''");
      filter += ` and Lot eq '${escapedLot}'`;
    }

    const qs = new URLSearchParams();
    qs.set("$filter", filter);
    qs.set("$count", "true");
    qs.set("$select", "*");
    qs.set("$orderby", "Item");
    qs.set("$expand", "LotByWarehouseRef");

    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;

    // If a specific lot is provided, we only need to check existence (avoid paging)
    if (lotTrim) {
      qs.set("$top", "1");
      const url = `${base}/${ti}/LN/lnapi/odata/whapi.ltcLot/Lots?${qs.toString()}`;

      const odataRes = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);
      if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
      const odataJson = await odataRes.json().catch(() => null) as any;
      if (!odataRes.ok || !odataJson) {
        const topMessage = odataJson?.error?.message || "odata_error";
        const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
        return json({ ok: false, error: { message: topMessage, details } }, 200);
      }

      const value = Array.isArray(odataJson?.value) ? odataJson.value : [];
      const count =
        typeof odataJson?.["@odata.count"] === "number"
          ? odataJson["@odata.count"]
          : value.length;

      return json({ ok: true, count, value }, 200);
    }

    // Request more items per page (server may cap, but try a higher top)
    qs.set("$top", "200");

    const initialUrl = `${base}/${ti}/LN/lnapi/odata/whapi.ltcLot/Lots?${qs.toString()}`;

    // Fetch all pages
    const items: any[] = [];
    let totalCount: number | null = null;
    let nextUrl: string | null = initialUrl;

    for (let i = 0; i < 20 && nextUrl; i++) {
      const odataRes = await fetch(nextUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);
      if (!odataRes) return json({ ok: false, error: "odata_network_error" }, 200);
      const odataJson = await odataRes.json().catch(() => null) as any;
      if (!odataRes.ok || !odataJson) {
        const topMessage = odataJson?.error?.message || "odata_error";
        const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
        return json({ ok: false, error: { message: topMessage, details } }, 200);
      }

      if (totalCount === null && typeof odataJson?.["@odata.count"] === "number") {
        totalCount = odataJson["@odata.count"];
      }

      const page = Array.isArray(odataJson?.value) ? odataJson.value : [];
      if (page.length) items.push(...page);

      const rawNext =
        (odataJson?.["@odata.nextLink"] as string | undefined) ||
        (odataJson?.["odata.nextLink"] as string | undefined) ||
        null;

      if (!rawNext) {
        nextUrl = null;
      } else if (rawNext.startsWith("http")) {
        nextUrl = rawNext;
      } else if (rawNext.startsWith("/")) {
        nextUrl = `${base}${rawNext}`;
      } else {
        nextUrl = `${base}/${rawNext}`;
      }
    }

    const count = totalCount !== null ? totalCount : items.length;

    return json({ ok: true, count, value: items }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});