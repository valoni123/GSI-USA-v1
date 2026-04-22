import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createServiceRoleClient, getCorsHeaders, json } from "../_shared/auth.ts";

const SESSION_TTL_HOURS = 12;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function createSessionToken() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return `${crypto.randomUUID()}-${toHex(randomBytes)}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let payload: { username?: string; password?: string } = {};
  try {
    payload = await req.json();
  } catch {
    console.error("[verify-gsi-login] invalid json body");
    return json(req, { ok: false, error: "invalid_json" }, 400);
  }

  const username = (payload.username || "").trim();
  const password = payload.password || "";
  if (!username || !password) {
    console.warn("[verify-gsi-login] missing username or password");
    return json(req, { ok: false, error: "missing_credentials" }, 400);
  }

  const supabase = createServiceRoleClient();
  console.info("[verify-gsi-login] start", { username });

  const { data, error } = await supabase.rpc("verify_gsi_user", {
    p_username: username,
    p_password: password,
  });

  if (error) {
    console.error("[verify-gsi-login] verify_gsi_user error", { error });
    return json(req, { ok: false, error: "server_error" }, 500);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const verifiedUser = rows[0];
  if (!verifiedUser?.id) {
    console.info("[verify-gsi-login] no matching user", { username });
    return json(req, { ok: false }, 200);
  }

  const { data: userData, error: userError } = await supabase
    .from("gsi_users")
    .select("id, username, full_name, admin, rece, insp, itif, huif, corr, trans, cntg, pick, rele, load, ship, trlo, trul")
    .eq("id", verifiedUser.id)
    .limit(1)
    .maybeSingle();

  if (userError || !userData?.id) {
    console.error("[verify-gsi-login] user lookup error", { error: userError, userId: verifiedUser.id });
    return json(req, { ok: false, error: "user_lookup_failed" }, 500);
  }

  const sessionToken = createSessionToken();
  const sessionTokenHash = await sha256Hex(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  await supabase
    .from("gsi_sessions")
    .update({ revoked_at: nowIso })
    .eq("gsi_user_id", verifiedUser.id)
    .is("revoked_at", null);

  const { error: sessionError } = await supabase.from("gsi_sessions").insert({
    gsi_user_id: verifiedUser.id,
    session_token_hash: sessionTokenHash,
    expires_at: expiresAt,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 512),
    ip_address: (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null,
  });

  if (sessionError) {
    console.error("[verify-gsi-login] session insert failed", { error: sessionError, userId: verifiedUser.id });
    return json(req, { ok: false, error: "session_create_failed" }, 500);
  }

  console.info("[verify-gsi-login] success", { username, userId: verifiedUser.id });
  return json(req, {
    ok: true,
    user: userData,
    session: {
      token: sessionToken,
      expires_at: expiresAt,
    },
  }, 200);
});
