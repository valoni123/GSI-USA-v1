import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

async function getAccessToken(supabase: any): Promise<string> {
  console.log("[ln-warehouse-inspections] fetching active ionapi config")
  const { data, error } = await supabase.rpc('get_active_ionapi')
  if (error) {
    console.error("[ln-warehouse-inspections] get_active_ionapi error", { error })
    throw new Error("Unable to load Infor OAuth configuration")
  }
  const cfg = (Array.isArray(data) && data.length > 0 ? data[0] : null) as ActiveIonapi | null
  if (!cfg || !cfg.ot || !cfg.pu) {
    console.error("[ln-warehouse-inspections] missing OAuth endpoints", { cfg })
    throw new Error("OAuth endpoints not configured")
  }

  console.log("[ln-warehouse-inspections] requesting token")
  const form = new URLSearchParams({
    grant_type: cfg.grant_type || 'client_credentials',
    client_id: cfg.saak || '',
    client_secret: cfg.sask || '',
  })

  const tokenResp = await fetch(cfg.ot, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: form.toString(),
  })

  if (!tokenResp.ok) {
    const body = await tokenResp.text()
    console.error("[ln-warehouse-inspections] token request failed", { status: tokenResp.status, body })
    throw new Error("Failed to obtain access token")
  }

  const tokenJson = await tokenResp.json()
  const accessToken = tokenJson.access_token as string
  if (!accessToken) {
    console.error("[ln-warehouse-inspections] no access_token in response", { tokenJson })
    throw new Error("No access token returned")
  }

  return accessToken
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    // Input value to search against Order, Inspection or HandlingUnit
    const q = url.searchParams.get('q') || ''
    // Company header; default to 1100 if not provided
    const company = url.searchParams.get('company') || '1100'

    if (!q) {
      console.error("[ln-warehouse-inspections] missing q parameter")
      return new Response(JSON.stringify({ error: "Missing q parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const accessToken = await getAccessToken(supabase)
    // Also load config once to get base URL (pu)
    const { data: confData, error: confErr } = await supabase.rpc('get_active_ionapi')
    if (confErr) {
      console.error("[ln-warehouse-inspections] get_active_ionapi error", { confErr })
      return new Response(JSON.stringify({ error: "Unable to load Infor OAuth configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const cfg = (Array.isArray(confData) && confData.length > 0 ? confData[0] : null) as ActiveIonapi | null
    if (!cfg?.pu) {
      console.error("[ln-warehouse-inspections] missing pu base URL", { cfg })
      return new Response(JSON.stringify({ error: "OData base URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Build OData query as specified with correct precedence:
    // (InspectionStatus ne ...Processed) and (Order eq 'q' or Inspection eq 'q' or HandlingUnit eq 'q')
    const filter = `(InspectionStatus ne txgsi.WarehouseInspections.WarehouseInspectionStatus'Processed') and (Order eq '${q}' or Inspection eq '${q}' or HandlingUnit eq '${q}')`
    const params = new URLSearchParams({
      "$filter": filter,
      "$count": "true",
      "$select": "*",
    })

    const base = new URL('/LN/lnapi/odata/txgsi.WarehouseInspections/WarehouseInspections', cfg.pu!)
    const fullUrl = `${base.toString()}?${params.toString()}`

    console.log("[ln-warehouse-inspections] calling OData", { fullUrl, company })

    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Content-Language": "en-US",
        "X-Infor-LnCompany": company,
        "Authorization": `Bearer ${accessToken}`,
      },
    })

    const text = await resp.text()
    let payload: any = null
    try {
      payload = JSON.parse(text)
    } catch {
      console.error("[ln-warehouse-inspections] non-JSON response", { text })
      return new Response(JSON.stringify({ error: "Invalid JSON from OData" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!resp.ok) {
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