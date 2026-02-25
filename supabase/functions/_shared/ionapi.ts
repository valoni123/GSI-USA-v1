import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type IonApiConfig = {
  ci: string;
  cs: string;
  pu: string;
  ot: string;
  grant_type: string;
  saak: string;
  sask: string;
  iu: string;
  ti: string;
};

type TokenCache = { token: string; expiresAt: number };

let cachedConfig: IonApiConfig | null = null;
let cachedConfigAt = 0;

let cachedToken: TokenCache | null = null;

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
}

export async function getIonApiConfig(supabase: SupabaseClient): Promise<IonApiConfig> {
  return (await getIonApiConfigInfo(supabase)).config;
}

export async function getIonApiConfigInfo(
  supabase: SupabaseClient,
): Promise<{ config: IonApiConfig; cached: boolean }> {
  const now = Date.now();
  // Cache config for longer; config rarely changes and this saves a DB roundtrip.
  if (cachedConfig && now - cachedConfigAt < 5 * 60_000) return { config: cachedConfig, cached: true };

  const { data } = await supabase.rpc("get_active_ionapi_full");
  const row = Array.isArray(data) ? data[0] : (data as any);

  if (!row) {
    throw new Error("no_active_config");
  }

  const { ci, cs, pu, ot, grant_type, saak, sask, iu, ti } = row as {
    ci: string;
    cs: string;
    pu: string;
    ot: string;
    grant_type: string;
    saak: string;
    sask: string;
    iu: string;
    ti: string;
  };

  if (!ci || !cs || !pu || !ot || !grant_type || !saak || !sask || !iu || !ti) {
    throw new Error("config_incomplete");
  }

  cachedConfig = { ci, cs, pu, ot, grant_type, saak, sask, iu, ti };
  cachedConfigAt = now;
  return { config: cachedConfig, cached: false };
}

export async function getIonApiAccessToken(supabase: SupabaseClient): Promise<string> {
  return (await getIonApiAccessTokenInfo(supabase)).token;
}

export async function getIonApiAccessTokenInfo(
  supabase: SupabaseClient,
): Promise<{ token: string; cached: boolean; expiresAt: number }> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) {
    return { token: cachedToken.token, cached: true, expiresAt: cachedToken.expiresAt };
  }

  const cfg = await getIonApiConfig(supabase);

  const grantType = cfg.grant_type === "password_credentials" ? "password" : cfg.grant_type;
  const basic = btoa(`${cfg.ci}:${cfg.cs}`);

  const tokenParams = new URLSearchParams();
  tokenParams.set("grant_type", grantType);
  tokenParams.set("username", cfg.saak);
  tokenParams.set("password", cfg.sask);

  const tokenRes = await fetch(buildTokenUrl(cfg.pu, cfg.ot), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
  });

  const tokenJson = (await tokenRes.json().catch(() => null)) as any;
  if (!tokenRes.ok || !tokenJson || typeof tokenJson.access_token !== "string") {
    throw new Error("token_error");
  }

  const expiresInSec = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 600;
  cachedToken = {
    token: tokenJson.access_token,
    expiresAt: now + Math.max(30, expiresInSec) * 1000,
  };

  return { token: cachedToken.token, cached: false, expiresAt: cachedToken.expiresAt };
}