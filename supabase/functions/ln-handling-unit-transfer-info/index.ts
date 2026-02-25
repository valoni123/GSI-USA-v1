import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCompanyFromParams } from "../_shared/company.ts";
import { getIonApiAccessTokenInfo, getIonApiConfigInfo } from "../_shared/ionapi.ts";

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

const itemSelect = "Item,Description,ItemDescription";

serve(async (req) => {
  const rid = crypto.randomUUID();
  const t0 = performance.now();

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { handlingUnit?: string; language?: string; company?: string; debug?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const handlingUnit = (body.handlingUnit || "").trim();
    const language = body.language || "en-US";
    const debug = !!body.debug;

    if (!handlingUnit) {
      return json({ ok: false, error: "missing_handling_unit" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tCompany0 = performance.now();
    const company = (body.company || "").trim() || (await getCompanyFromParams(supabase));
    const companyMs = performance.now() - tCompany0;

    const tCfg0 = performance.now();
    const cfgInfo = await getIonApiConfigInfo(supabase);
    const cfgMs = performance.now() - tCfg0;

    const tTok0 = performance.now();
    const tokInfo = await getIonApiAccessTokenInfo(supabase);
    const tokenMs = performance.now() - tTok0;

    const base = cfgInfo.config.iu.endsWith("/") ? cfgInfo.config.iu.slice(0, -1) : cfgInfo.config.iu;

    // HU OData
    // NOTE: do not use $select here; LN field sets differ per installation and strict $select can break.
    const escapedHu = handlingUnit.replace(/'/g, "''");
    const huPath = `/${cfgInfo.config.ti}/LN/lnapi/odata/whapi.wmdHandlingUnit/HandlingUnits(HandlingUnit='${escapedHu}')`;
    const huUrl = `${base}${huPath}`;

    const tHu0 = performance.now();
    const huRes = await fetch(huUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        Authorization: `Bearer ${tokInfo.token}`,
      },
    }).catch(() => null as unknown as Response);
    const odataHuMs = performance.now() - tHu0;

    if (!huRes) return json({ ok: false, error: "odata_network_error" }, 200);
    const huJson = (await huRes.json().catch(() => null)) as any;
    if (!huRes.ok || !huJson) {
      const topMessage = huJson?.error?.message || "odata_error";
      const details = Array.isArray(huJson?.error?.details) ? huJson.error.details : [];
      const totalMs = performance.now() - t0;
      if (debug) {
        console.log("[ln-handling-unit-transfer-info] error", {
          rid,
          handlingUnit,
          totalMs,
          companyMs,
          cfgMs,
          cfgCached: cfgInfo.cached,
          tokenMs,
          tokenCached: tokInfo.cached,
          odataHuMs,
          status: huRes.status,
          message: topMessage,
        });
      }
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const entity =
      huJson && typeof huJson === "object" && !Array.isArray(huJson)
        ? huJson
        : Array.isArray(huJson?.value) && huJson.value.length > 0
          ? huJson.value[0]
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

    // Item description is best-effort: do NOT fail the HU scan if Items cannot be read.
    let itemDescription: string | null = null;
    let odataItemMs = 0;

    const rawItem = (item || "").toString();
    const trimmed = rawItem.trim();
    const candidates = [rawItem, trimmed]
      .filter((v, i, arr) => v && arr.indexOf(v) === i);

    // Optional: some LN installations require 9 leading spaces for item keys.
    if (trimmed && rawItem === trimmed) {
      candidates.push(`         ${trimmed}`);
    }

    for (const candidate of candidates) {
      const escaped = candidate.replace(/'/g, "''");
      const itemPath = `/${cfgInfo.config.ti}/LN/lnapi/odata/tcapi.ibdItem/Items(Item='${escaped}')`;
      const itemUrl = `${base}${itemPath}?$select=${encodeURIComponent(itemSelect)}`;

      const tItem0 = performance.now();
      const res = await fetch(itemUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${tokInfo.token}`,
        },
      }).catch(() => null as unknown as Response);
      odataItemMs += performance.now() - tItem0;

      if (!res) continue;
      const resBody = (await res.json().catch(() => null)) as any;
      if (!res.ok || !resBody) {
        const msg = resBody?.error?.message;
        if (typeof msg === "string" && msg.toLowerCase().includes("cannot be read from table items")) {
          // Permission issue on Items: stop trying and just omit description.
          break;
        }
        continue;
      }

      const itemEntity =
        resBody && typeof resBody === "object" && !Array.isArray(resBody)
          ? resBody
          : Array.isArray(resBody?.value) && resBody.value.length > 0
            ? resBody.value[0]
            : null;

      if (itemEntity) {
        itemDescription = (itemEntity.Description ?? itemEntity.ItemDescription ?? null) as string | null;
        break;
      }
    }

    const totalMs = performance.now() - t0;
    const perf = debug
      ? {
          rid,
          totalMs,
          companyMs,
          cfgMs,
          cfgCached: cfgInfo.cached,
          tokenMs,
          tokenCached: tokInfo.cached,
          odataMs: odataHuMs + odataItemMs,
          odataHuMs,
          odataItemMs,
        }
      : undefined;

    if (debug) {
      console.log("[ln-handling-unit-transfer-info] ok", perf);
    }

    return json(
      {
        ok: true,
        handlingUnit,
        quantity,
        unit,
        item,
        itemDescription,
        warehouse,
        location,
        lot,
        status,
        fullyBlocked,
        blockedForOutbound,
        blockedForTransferIssue,
        blockedForCycleCounting,
        blockedForAssembly,
        ...(perf ? { perf } : {}),
      },
      200,
    );
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});