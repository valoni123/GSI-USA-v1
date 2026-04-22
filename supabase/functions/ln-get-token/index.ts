import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createServiceRoleClient, getCorsHeaders, json, requireGsiSession } from "../_shared/auth.ts";

const TOKEN_TIMEOUT_MS = 15000;

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : `${pu}/`;
  return base + ot.replace(/^\//, "");
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
  const corsHeaders = getCorsHeaders(req);

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const supabase = createServiceRoleClient();
    const auth = await requireGsiSession(req, supabase);
    if (!auth.ok) {
      return auth.response;
    }

    console.info("[ln-get-token] start", { gsiUserId: auth.gsiUserId });

    const { data: rpcData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
    if (cfgErr) {
      console.error("[ln-get-token] get_active_ionapi error", { error: cfgErr });
      return json(req, { ok: false, error: "config_error" }, 500);
    }

    const cfg = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!cfg) {
      console.warn("[ln-get-token] no active config");
      return json(req, { ok: false, error: "no_active_config" }, 200);
    }

    const { ci, cs, pu, ot, grant_type, saak, sask } = cfg as {
      ci: string;
      cs: string;
      pu: string;
      ot: string;
      grant_type: string;
      saak: string;
      sask: string;
    };

    if (!ci || !cs || !pu || !ot || !grant_type || !saak || !sask) {
      console.warn("[ln-get-token] config incomplete");
      return json(req, { ok: false, error: "config_incomplete" }, 400);
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
            Authorization: `Basic ${basic}`,
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
      return json(req, { ok: false, error: isTimeout ? "token_timeout" : "network_error" }, 502);
    }

    const contentType = tokenRes.headers.get("Content-Type") || "";
    const responseBody = contentType.includes("application/json")
      ? await tokenRes.json()
      : await tokenRes.text();

    if (!tokenRes.ok) {
      console.error("[ln-get-token] upstream token error", { status: tokenRes.status });
      return json(req, { ok: false, error: "token_error", details: responseBody }, tokenRes.status);
    }

    const tokenText = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
    const { error: setErr } = await supabase.rpc("set_current_ln_token", {
      p_id: auth.gsiUserId,
      p_token: tokenText,
    });

    if (setErr) {
      console.error("[ln-get-token] failed to store current_ln_token", { error: setErr, gsiUserId: auth.gsiUserId });
      return json(req, { ok: false, error: "token_store_failed" }, 500);
    }

    console.info("[ln-get-token] success", { stored: true, gsiUserId: auth.gsiUserId });
    return json(req, { ok: true, stored: true }, 200);
  } catch (e) {
    console.error("[ln-get-token] unhandled error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return json(req, { ok: false, error: "unhandled" }, 500);
  }
});
