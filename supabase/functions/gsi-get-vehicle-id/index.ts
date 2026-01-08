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
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { gsi_id?: string; username?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "env_missing" }, 200);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let query = supabase.from("gsi_users").select("vhid").limit(1);
    if (body.gsi_id) {
      query = query.eq("id", body.gsi_id);
    } else if (body.username) {
      query = query.eq("username", body.username);
    } else {
      return json({ ok: false, error: "missing_identifier" }, 200);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return json({ ok: false, error: "query_error" }, 200);
    }

    return json({ ok: true, vehicleId: (data?.vhid as string) || null }, 200);
  } catch (e) {
    return json({ ok: false, error: "unhandled" }, 200);
  }
});