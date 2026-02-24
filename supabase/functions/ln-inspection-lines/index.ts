import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseAdmin, getActiveConfig, fetchOData } from "../_shared/ionapi.ts";
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
    const sequence = typeof seqRaw === "number" ? seqRaw : (typeof seqRaw === "string" ? Number(seqRaw.trim()) : NaN);
    const language = body.language || "en-US";
    const companyOverride = (body.company || "").toString().trim();

    if (!inspection || !Number.isFinite(sequence)) {
      return json({ ok: false, error: "missing_inputs" }, 200);
    }

    const supabase = getSupabaseAdmin();
    let company = companyOverride;
    if (!company) {
      try {
        company = await getCompanyFromParams(supabase);
      } catch {
        return json({ ok: false, error: "no_company_config" }, 200);
      }
    }

    const cfg = await getActiveConfig(supabase);

    const escInspection = inspection.replace(/'/g, "''");
    const filter = `Inspection eq '${escInspection}' and InspectionSequence eq ${sequence}`;

    const qs = new URLSearchParams();
    qs.set("$filter", filter);
    qs.set("$count", "true");
    qs.set("$select", [
      "Inspection",
      "InspectionSequence",
      "InspectionLine",
      "Item",
      "ItemRef/Item",
      "ItemRef/Description",
      "QuantityToBeInspectedInStorageUnit",
      "StorageUnit",
    ].join(","));
    qs.set("$expand", "ItemRef");

    const res = await fetchOData(cfg, company, `/txgsi.InspectionLines/InspectionLines?${qs.toString()}`, language);
    if (!res) return json({ ok: false, error: "odata_network_error" }, 200);
    const ojson = await res.json().catch(() => null) as any;
    if (!res.ok || !ojson) {
      const topMessage = ojson?.error?.message || "odata_error";
      const details = Array.isArray(ojson?.error?.details) ? ojson.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    const value = Array.isArray(ojson?.value) ? ojson.value : [];
    const count = typeof ojson?.["@odata.count"] === "number" ? ojson["@odata.count"] : value.length;

    return json({ ok: true, count, value }, 200);
  } catch {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});