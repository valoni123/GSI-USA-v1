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

    // Supabase admin client (service role) to read config and decrypt
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ ok: false, error: "env_missing" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the active ionapi record with decrypted saak/sask
    const { data: rpcData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("get_active_ionapi error:", cfgErr);
      return json({ ok: false, error: "config_error" }, 500);
    }

    const cfg = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!cfg) {
      return json({ ok: false, error: "no_active_config" }, 200);
    }

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };

    if (!ci || !cs || !pu || !ot || !grant_type || !saak || !sask) {
      return json({ ok: false, error: "config_incomplete" }, 400);
    }

    const tokenUrl = buildTokenUrl(pu, ot);

    // Basic auth header with client id/secret
    const basic = btoa(`${ci}:${cs}`);

    // Prepare x-www-form-urlencoded body
    const params = new URLSearchParams();
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;
    params.set("grant_type", grantType);
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
      return json({ ok: false, error: "network_error" }, 502);
    }

    const contentType = tokenRes.headers.get("Content-Type") || "";
    const responseBody = contentType.includes("application/json")
      ? await tokenRes.json()
      : await tokenRes.text();

    if (!tokenRes.ok) {
      return json({ ok: false, error: "token_error", details: responseBody }, tokenRes.status);
    }

    return json({ ok: true, token: responseBody }, 200);
  } catch (e) {
    console.error("Unhandled error:", e);
    return json({ ok: false, error: "unhandled" }, 500);
  }
});