import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let payload: { username?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const loginValue = (payload.username || "").trim();
  if (!loginValue) {
    return new Response(JSON.stringify({ ok: false, error: "missing_username" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: "env_missing" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const fields = "username,full_name,admin";

  const usernameResult = await supabase
    .from("gsi_users")
    .select(fields)
    .ilike("username", loginValue)
    .limit(1)
    .maybeSingle();

  if (usernameResult.error) {
    return new Response(JSON.stringify({ ok: false, error: "query_error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (usernameResult.data?.full_name) {
    return new Response(JSON.stringify({
      ok: true,
      full_name: usernameResult.data.full_name,
      username: usernameResult.data.username ?? null,
      admin: usernameResult.data.admin === true || String(usernameResult.data.admin ?? "").toLowerCase() === "true",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mailResult = await supabase
    .from("gsi_users")
    .select(fields)
    .ilike("mail", loginValue)
    .limit(1)
    .maybeSingle();

  if (mailResult.error) {
    return new Response(JSON.stringify({ ok: false, error: "query_error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    full_name: mailResult.data?.full_name || null,
    username: mailResult.data?.username || null,
    admin: mailResult.data?.admin === true || String(mailResult.data?.admin ?? "").toLowerCase() === "true",
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});