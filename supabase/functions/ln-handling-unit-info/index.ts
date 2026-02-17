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

    let body: { handlingUnit?: string; language?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const handlingUnit = (body.handlingUnit || "").trim();
    const language = body.language || "en-US";
    if (!handlingUnit) {
      return json({ ok: false, error: "missing_handling_unit" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const company = await getCompanyFromParams(supabase);

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

    // Build LN OData URL for Handling Units → single entity by key
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu;
    const escaped = handlingUnit.replace(/'/g, "''");
    const path = `/${ti}/LN/lnapi/odata/whapi.wmdHandlingUnit/HandlingUnits(HandlingUnit='${escaped}')`;
    const url = `${base}${path}?$select=%2A&$expand=%2A`;

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

    const entity = (odataJson && typeof odataJson === "object" && !Array.isArray(odataJson))
      ? odataJson
      : (Array.isArray(odataJson?.value) && odataJson.value.length > 0 ? odataJson.value[0] : null);

    if (!entity) {
      return json({ ok: false, error: { message: "not_found" } }, 200);
    }

    const pick = (keys: string[]) => {
      for (const k of keys) {
        if (k in entity && entity[k] != null) return entity[k];
      }
      return null;
    };

    const quantity = pick(["QuantityInInventoryUnit", "Quantity", "QuantityBase"]);
    const unit = pick(["Unit", "InventoryUnit", "BaseUnit"]);
    const item = pick(["Item", "ItemID", "ItemCode"]);
    const warehouse = pick(["Warehouse", "WarehouseCode"]);
    const location = pick(["Location", "LocationFrom", "LocationTo"]);
    const lot = pick(["Lot", "LotNumber", "Batch"]);
    const status = pick(["Status", "StatusDesc", "HandlingUnitStatus"]);

    const toBool = (v: any) => {
      if (typeof v === "boolean") return v;
      if (v == null) return false;
      const s = String(v).toLowerCase();
      return s === "yes" || s === "true" || s === "1";
    };

    const fullyBlocked = toBool(pick(["FullyBlocked"]));
    const blockedForOutbound = toBool(pick(["BlockedForOutbound"]));
    const blockedForTransferIssue = toBool(pick(["BlockedForTransferIssue"]));
    const blockedForCycleCounting = toBool(pick(["BlockedForCycleCounting"]));
    const blockedForAssembly = toBool(pick(["BlockedForAssembly"]));

    return json({
      ok: true,
      handlingUnit,
      quantity,
      unit,
      item,
      warehouse,
      location,
      lot,
      status,
      fullyBlocked,
      blockedForOutbound,
      blockedForTransferIssue,
      blockedForCycleCounting,
      blockedForAssembly,
    }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});