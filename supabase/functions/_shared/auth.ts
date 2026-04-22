import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type GsiAuthUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  admin: boolean | null;
  rece: boolean | null;
  insp: boolean | null;
  itif: boolean | null;
  huif: boolean | null;
  corr: boolean | null;
  trans: boolean | null;
  cntg: boolean | null;
  pick: boolean | null;
  rele: boolean | null;
  load: boolean | null;
  ship: boolean | null;
  trlo: boolean | null;
  trul: boolean | null;
};

type SessionLookupRow = {
  id: string;
  gsi_user_id: string;
  expires_at: string;
  gsi_users: GsiAuthUser | GsiAuthUser[] | null;
};

export type AuthenticatedGsiUser = GsiAuthUser;
export type GsiPermissionKey = Exclude<keyof GsiAuthUser, "id" | "username" | "full_name">;

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

export function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("env_missing");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireGsiSession(req: Request, supabase?: SupabaseClient) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return {
      ok: false as const,
      response: json(req, { ok: false, error: "unauthorized" }, 401),
    };
  }

  const db = supabase ?? createServiceRoleClient();
  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from("gsi_sessions")
    .select(`
      id,
      gsi_user_id,
      expires_at,
      gsi_users!gsi_sessions_gsi_user_id_fkey (
        id,
        username,
        full_name,
        admin,
        rece,
        insp,
        itif,
        huif,
        corr,
        trans,
        cntg,
        pick,
        rele,
        load,
        ship,
        trlo,
        trul
      )
    `)
    .eq("session_token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[gsi-auth] session lookup failed", { error });
    return {
      ok: false as const,
      response: json(req, { ok: false, error: "auth_lookup_failed" }, 500),
    };
  }

  if (!data) {
    return {
      ok: false as const,
      response: json(req, { ok: false, error: "unauthorized" }, 401),
    };
  }

  const row = data as unknown as SessionLookupRow;
  const user = Array.isArray(row.gsi_users) ? row.gsi_users[0] ?? null : row.gsi_users;
  if (!user?.id) {
    return {
      ok: false as const,
      response: json(req, { ok: false, error: "unauthorized" }, 401),
    };
  }

  await db
    .from("gsi_sessions")
    .update({ last_used_at: nowIso })
    .eq("id", row.id);

  return {
    ok: true as const,
    sessionId: row.id,
    gsiUserId: row.gsi_user_id,
    user,
  };
}

export function hasAnyPermission(user: AuthenticatedGsiUser, permissions: GsiPermissionKey[]) {
  if (user.admin) return true;
  return permissions.some((permission) => user[permission] === true);
}

export function requirePermissions(req: Request, user: AuthenticatedGsiUser, permissions: GsiPermissionKey[]) {
  if (hasAnyPermission(user, permissions)) {
    return null;
  }

  return json(req, { ok: false, error: "forbidden" }, 403);
}
