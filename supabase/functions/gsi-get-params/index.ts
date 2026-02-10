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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { company?: string };
    const company = (body.company || "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Prefer a row for the requested company (if provided), then fallback to latest
    let row: any = null;

    if (company) {
      const byComp = await supabase
        .from("gsi000_params")
        .select("*")
        .eq("txgsi000_compnr", company)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byComp.data) row = byComp.data;
    }

    if (!row) {
      const latest = await supabase
        .from("gsi000_params")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest.data) row = latest.data;
    }

    if (!row) {
      return json({ ok: true, params: null }, 200);
    }

    // Return only what's needed now; keep extensible
    const params = {
      compnr: row.txgsi000_compnr ?? null,
      aure: typeof row.txgsi000_aure === "boolean"
        ? row.txgsi000_aure
        : String(row.txgsi000_aure ?? "").toLowerCase() === "true",
    };

    return json({ ok: true, params }, 200);
  } catch (e) {
    return json({ ok: false, error: { message: "unhandled" } }, 200);
  }
});