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

type RequestBody = {
  item?: string;
  warehouse?: string;
  location?: string;
  language?: string;
  company?: string;
};

const SELECT_FIELDS = [
  "HandlingUnit",
  "ParentHandlingUnit",
  "Status",
  "Lot",
  "Location",
  "MultiItemHandlingUnit",
  "FullyBlocked",
  "BlockedForOutbound",
  "BlockedForTransferIssue",
  "BlockedForCycleCounting",
  "BlockedForAssembly",
  "Unit",
  "QuantityInInventoryUnit",
  "GrossWeight",
  "NetWeight",
  "WeightUnit",
  "Height",
  "Width",
  "Length",
  "DimensionUnit",
].join(",");

function toBool(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function toNumberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const item = (body.item || "").trim();
    const warehouse = (body.warehouse || "").trim();
    const location = (body.location || "").trim();
    const language = (body.language || "en-US").trim() || "en-US";

    if (!item || !warehouse || !location) {
      return json({ ok: false, error: "missing_params" }, 200);
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
    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;

    const fetchForItemKey = async (itemKey: string) => {
      const path = `/${cfg.ti}/LN/lnapi/odata/whapi.wmdHandlingUnit/Items(Item='${encodeURIComponent(itemKey)}')/HandlingUnitRefs`;
      const params = new URLSearchParams();
      params.set(
        "$filter",
        `Warehouse eq '${warehouse.replace(/'/g, "''")}' and Status ne whapi.wmdHandlingUnit.HandlingUnitStatus'Closed' and Location eq '${location.replace(/'/g, "''")}'`,
      );
      params.set("$count", "true");
      params.set("$select", SELECT_FIELDS);

      const url = `${base}${path}?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Language": language,
          "X-Infor-LnCompany": company,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null as unknown as Response);

      if (!response) {
        return { ok: false as const, error: "odata_network_error" };
      }

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok || !payload) {
        return {
          ok: false as const,
          error: payload?.error?.message || "odata_error",
          details: Array.isArray(payload?.error?.details) ? payload.error.details : [],
        };
      }

      const rows = Array.isArray(payload.value)
        ? payload.value.map((row: any) => ({
            HandlingUnit: String(row?.HandlingUnit || ""),
            ParentHandlingUnit: row?.ParentHandlingUnit ? String(row.ParentHandlingUnit) : null,
            Status: row?.Status == null ? null : String(row.Status),
            Lot: row?.Lot == null ? null : String(row.Lot),
            Location: row?.Location == null ? null : String(row.Location),
            MultiItemHandlingUnit: toBool(row?.MultiItemHandlingUnit),
            FullyBlocked: toBool(row?.FullyBlocked),
            BlockedForOutbound: toBool(row?.BlockedForOutbound),
            BlockedForTransferIssue: toBool(row?.BlockedForTransferIssue),
            BlockedForCycleCounting: toBool(row?.BlockedForCycleCounting),
            BlockedForAssembly: toBool(row?.BlockedForAssembly),
            Unit: row?.Unit == null ? null : String(row.Unit),
            QuantityInInventoryUnit: toNumberOrNull(row?.QuantityInInventoryUnit) ?? 0,
            GrossWeight: toNumberOrNull(row?.GrossWeight),
            NetWeight: toNumberOrNull(row?.NetWeight),
            WeightUnit: row?.WeightUnit == null ? null : String(row.WeightUnit),
            Height: toNumberOrNull(row?.Height),
            Width: toNumberOrNull(row?.Width),
            Length: toNumberOrNull(row?.Length),
            DimensionUnit: row?.DimensionUnit == null ? null : String(row.DimensionUnit),
          }))
        : [];

      return {
        ok: true as const,
        count: typeof payload?.["@odata.count"] === "number" ? payload["@odata.count"] : rows.length,
        rows,
      };
    };

    const candidates = Array.from(new Set([`${" ".repeat(9)}${item}`, item]));

    let firstError: { error: unknown; details?: unknown } | null = null;
    for (const candidate of candidates) {
      const result = await fetchForItemKey(candidate);
      if (result.ok) {
        if (result.rows.length > 0 || candidate === candidates[candidates.length - 1]) {
          return json({ ok: true, count: result.count, rows: result.rows }, 200);
        }
      } else if (!firstError) {
        firstError = { error: result.error, details: result.details };
      }
    }

    return json({ ok: false, error: firstError?.error || "odata_error", details: firstError?.details || [] }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
