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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      language?: string;
      company?: string;
      transportOrder?: string;
    };

    const language = (body.language || "en-US").toString();
    const companyOverride = (body.company || "").toString().trim();
    const transportOrder = (body.transportOrder || "").toString().trim();

    if (!transportOrder) {
      return json({ ok: false, error: "missing_transport_order" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-assign-alternative-to-transport-orders] env missing");
      return json({ ok: false, error: "env_missing" }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let company = companyOverride;
    if (!company) {
      try {
        company = await getCompanyFromParams(supabase);
      } catch (error) {
        console.error("[ln-assign-alternative-to-transport-orders] no_company_config", { error: String(error) });
        return json({ ok: false, error: "no_company_config" }, 200);
      }
    }

    const cfg = await getIonApiConfig(supabase);
    const accessToken = await getIonApiAccessToken(supabase);

    const base = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
    const qs = new URLSearchParams();
    qs.set("$select", "TransportOrder,NewQuantity,Unit,AlternativeLocation,Remark");

    const url = `${base}/${cfg.ti}/LN/lnapi/odata/txgwi.AlternativeInventoryTransport/AssignAlternativeToTransportOrders?${qs.toString()}`;
    const payload = {
      TransportOrder: transportOrder,
    };

    console.log("[ln-assign-alternative-to-transport-orders] posting assign alternative request", {
      company,
      language,
      transportOrder,
      url,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Language": language,
        "X-Infor-LnCompany": company,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error("[ln-assign-alternative-to-transport-orders] odata_network_error", { error: String(error) });
      return null as unknown as Response;
    });

    if (!res) {
      return json({ ok: false, error: "odata_network_error" }, 200);
    }

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok || !data) {
      console.error("[ln-assign-alternative-to-transport-orders] odata_error", {
        status: res.status,
        body: data,
      });
      const topMessage = data?.error?.message || "odata_error";
      const details = Array.isArray(data?.error?.details) ? data.error.details : [];
      return json({ ok: false, error: { message: topMessage, details } }, 200);
    }

    return json(
      {
        ok: true,
        value: {
          TransportOrder: data?.TransportOrder ?? "",
          NewQuantity: data?.NewQuantity ?? null,
          Unit: data?.Unit ?? "",
          AlternativeLocation: data?.AlternativeLocation ?? "",
          Remark: data?.Remark ?? null,
        },
      },
      200,
    );
  } catch (error) {
    console.error("[ln-assign-alternative-to-transport-orders] unhandled", { error: String(error) });
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});
