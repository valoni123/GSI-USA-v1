import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCompanyFromParams } from "../_shared/company.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ActiveIonapi = {
  ci: string | null
  cs: string | null
  pu: string | null
  ot: string | null
  grant_type: string | null
  saak: string | null
  sask: string | null
}

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || ''

    if (!q) {
      console.error("[ln-warehouse-inspections] missing q parameter")
      return new Response(JSON.stringify({ error: "Missing q parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-warehouse-inspections] env missing")
      return new Response(JSON.stringify({ error: "env_missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Company from params (server-side)
    let company: string
    try {
      company = await getCompanyFromParams(supabase)
    } catch (e) {
      console.error("[ln-warehouse-inspections] company config error", { error: String(e) })
      return new Response(JSON.stringify({ error: "no_company_config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Active ionapi config (decrypted)
    const { data: cfgData, error: cfgErr } = await supabase.rpc('get_active_ionapi')
    if (cfgErr) {
      console.error("[ln-warehouse-inspections] get_active_ionapi error", { error: cfgErr })
      return new Response(JSON.stringify({ error: "config_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const cfg = (Array.isArray(cfgData) && cfgData.length > 0 ? cfgData[0] : cfgData) as ActiveIonapi | null
    if (!cfg || !cfg.pu || !cfg.ot || !cfg.ci || !cfg.cs || !cfg.saak || !cfg.sask) {
      console.error("[ln-warehouse-inspections] incomplete ionapi config", { cfg })
      return new Response(JSON.stringify({ error: "config_incomplete" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // iu and ti from active row
    const { data: activeRow, error: rowErr } = await supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle()
    if (rowErr || !activeRow) {
      console.error("[ln-warehouse-inspections] missing active row", { error: rowErr })
      return new Response(JSON.stringify({ error: "no_active_config_row" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const iu: string = String(activeRow.iu || "")
    const ti: string = String(activeRow.ti || "")

    // Token using Basic and username/password
    const basic = btoa(`${cfg.ci}:${cfg.cs}`)
    const grantType = cfg.grant_type === "password_credentials" ? "password" : (cfg.grant_type || "password")
    const form = new URLSearchParams()
    form.set("grant_type", grantType)
    form.set("username", cfg.saak)
    form.set("password", cfg.sask)

    const tokenResp = await fetch(buildTokenUrl(cfg.pu, cfg.ot), {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }).catch(() => null as unknown as Response)
    if (!tokenResp) {
      console.error("[ln-warehouse-inspections] token network error")
      return new Response(JSON.stringify({ error: "token_network_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const tokenJson = await tokenResp.json().catch(() => null) as any
    if (!tokenResp.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
      console.error("[ln-warehouse-inspections] token error", { status: tokenResp.status, body: tokenJson })
      return new Response(JSON.stringify({ error: "token_error", details: tokenJson }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const accessToken = tokenJson.access_token as string

    // OData call: WarehouseInspections filtered by Order/Inspection/HandlingUnit and not Processed
    const base = iu.endsWith("/") ? iu.slice(0, -1) : iu
    const escaped = q.replace(/'/g, "''")
    const filter = `(InspectionStatus ne txgsi.WarehouseInspections.WarehouseInspectionStatus'Processed') and (Order eq '${escaped}' or Inspection eq '${escaped}' or HandlingUnit eq '${escaped}')`

    const params = new URLSearchParams({
      "$filter": filter,
      "$count": "true",
      "$select": "*",
    })
    params.set("$orderby", "Line")

    const fullUrl = `${base}/${ti}/LN/lnapi/odata/txgsi.WarehouseInspections/WarehouseInspections?${params.toString()}`

    console.log("[ln-warehouse-inspections] calling OData", { fullUrl, company })

    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": "en-US",
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
      },
    }).catch(() => null as unknown as Response)

    if (!resp) {
      console.error("[ln-warehouse-inspections] OData network error")
      return new Response(JSON.stringify({ error: "odata_network_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const payload = await resp.json().catch(async () => {
      const txt = await resp.text().catch(() => "")
      console.error("[ln-warehouse-inspections] non-JSON response", { text: txt })
      return null
    })

    if (!resp.ok || !payload) {
      console.error("[ln-warehouse-inspections] OData error", { status: resp.status, payload })
      return new Response(JSON.stringify({ error: "OData request failed", details: payload }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("[ln-warehouse-inspections] success", { count: payload?.['@odata.count'] })
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    console.error("[ln-warehouse-inspections] unexpected error", { error: String(e) })
    return new Response(JSON.stringify({ error: "Server error", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})