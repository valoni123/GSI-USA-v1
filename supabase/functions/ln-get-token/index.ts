import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TIMEOUT_MS = 15000;

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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body: { gsi_id?: string } = {};
    try {
      body = await req.json();
    } catch {}
    const gsiId = body?.gsi_id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ln-get-token] missing env");
      return json({ ok: false, error: "env_missing" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.info("[ln-get-token] start", { gsiId: gsiId || null });

    const { data: rpcData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-get-token] get_active_ionapi error", { error: cfgErr });
      return json({ ok: false, error: "config_error" }, 500);
    }

    const cfg = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!cfg) {
      console.warn("[ln-get-token] no active config");
      return json({ ok: false, error: "no_active_config" }, 200);
    }

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string; cs: string; pu: string; ot: string; grant_type: string; saak: string; sask: string;
    };

    if (!ci || !cs || !pu || !ot || !grant_type || !saak || !sask) {
      console.warn("[ln-get-token] config incomplete");
      return json({ ok: false, error: "config_incomplete" }, 400);
    }

    const tokenUrl = buildTokenUrl(pu, ot);
    const basic = btoa(`${ci}:${cs}`);
    const params = new URLSearchParams();
    const grantType = grant_type === "password_credentials" ? "password" : grant_type;
    params.set("grant_type", grantType);
    params.set("username", saak);
    params.set("password", sask);

    let tokenRes: Response;
    try {
      console.info("[ln-get-token] requesting upstream token", { timeoutMs: TOKEN_TIMEOUT_MS });
      tokenRes = await fetchWithTimeout(
        tokenUrl,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
        TOKEN_TIMEOUT_MS,
      );
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.error("[ln-get-token] token request failed", {
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ ok: false, error: isTimeout ? "token_timeout" : "network_error" }, 502);
    }

    const contentType = tokenRes.headers.get("Content-Type") || "";
    const responseBody = contentType.includes("application/json")
      ? await tokenRes.json()
      : await tokenRes.text();

    if (!tokenRes.ok) {
      console.error("[ln-get-token] upstream token error", { status: tokenRes.status });
      return json({ ok: false, error: "token_error", details: responseBody }, tokenRes.status);
    }

    if (gsiId) {
      const tokenText = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
      const { error: setErr } = await supabase.rpc("set_current_ln_token", {
        p_id: gsiId,
        p_token: tokenText,
      });
      if (setErr) {
        console.error("[ln-get-token] failed to store current_ln_token", { error: setErr });
        return json({ ok: true, token: responseBody, stored: false }, 200);
      }
    }

    console.info("[ln-get-token] success", { stored: !!gsiId });
    return json({ ok: true, token: responseBody, stored: !!gsiId }, 200);
  } catch (e) {
    console.error("[ln-get-token] unhandled error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return json({ ok: false, error: "unhandled" }, 500);
  }
});
