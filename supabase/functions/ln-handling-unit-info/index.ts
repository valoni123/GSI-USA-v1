import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessToken, getIonApiConfig } from "../_shared/ionapi.ts";

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

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { handlingUnit?: string; language?: string; company?: string } = {};
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

    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));

    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);

    // Build LN OData URL for Handling Units → single entity by key
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const escaped = handlingUnit.replace(/'/g, "''");
    const path = `/${cfg.ti}/LN/lnapi/odata/whapi.wmdHandlingUnit/HandlingUnits(HandlingUnit='${escaped}')`;
    const url = `${base}${path}?$select=%2A`;

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
    const odataJson = (await odataRes.json().catch(() => null)) as any;
    if (!odataRes.ok || !odataJson) {
      const topMessage = odataJson?.error?.message || "odata_error";
      const details = Array.isArray(odataJson?.error?.details) ? odataJson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const entity =
      odataJson && typeof odataJson === "object" && !Array.isArray(odataJson)
        ? odataJson
        : Array.isArray(odataJson?.value) && odataJson.value.length > 0
          ? odataJson.value[0]
          : null;

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

    return json(
      {
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
      },
      200,
    );
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
