import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Supabase admin client (service role) to read config and decrypt
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get the active ionapi record with decrypted fields
  const { data: cfg, error: cfgErr } = await supabase.rpc("get_active_ionapi");
  if (cfgErr) {
    console.error("get_active_ionapi error:", cfgErr);
    return new Response(JSON.stringify({ ok: false, error: "config_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!cfg) {
    return new Response(JSON.stringify({ ok: false, error: "no_active_config" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
    ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
  };

  const tokenUrl = buildTokenUrl(pu, ot);

  // Basic auth header with client id/secret
  const basic = btoa(`${ci}:${cs}`);

  // Prepare x-www-form-urlencoded body
  const params = new URLSearchParams();
  params.set("grant_type", grant_type);
  params.set("username", saak);
  params.set("password", sask);

  let tokenRes: Response;
  try {
    tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (e) {
    console.error("Token request failed:", e);
    return new Response(JSON.stringify({ ok: false, error: "network_error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contentType = tokenRes.headers.get("Content-Type") || "";
  const responseBody = contentType.includes("application/json")
    ? await tokenRes.json()
    : await tokenRes.text();

  if (!tokenRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "token_error", details: responseBody }), {
      status: tokenRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, token: responseBody }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});