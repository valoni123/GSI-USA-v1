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

let cachedConfig: IonApiConfig | null = null;
let cachedConfigAt = 0;

let cachedToken: { token: string; expiresAt: number } | null = null;

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
}

export async function getIonApiConfig(supabase: SupabaseClient): Promise<IonApiConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfigAt < 60_000) return cachedConfig;

  const [cfgRes, activeRes] = await Promise.all([
    supabase.rpc("get_active_ionapi"),
    supabase
      .from("ionapi_oauth2")
      .select("iu, ti")
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const cfgData = cfgRes.data as any;
  const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
  const activeRow = activeRes.data as any;

  if (!cfg || !activeRow) {
    throw new Error("no_active_config");
  }

  const raw = cfg as {
    ci: string;
    cs: string;
    pu: string;
    ot: string;
    grant_type: string;
    saak: string;
    sask: string;
  };

  const { iu, ti } = activeRow as { iu: string; ti: string };

  // Users often paste these values with a trailing newline; trim to avoid invalid_grant.
  const ci = String(raw.ci ?? "").trim();
  const cs = String(raw.cs ?? "").trim();
  const pu = String(raw.pu ?? "").trim();
  const ot = String(raw.ot ?? "").trim();
  const grant_type = String(raw.grant_type ?? "").trim();
  const saak = String(raw.saak ?? "").trim();
  const sask = String(raw.sask ?? "").trim();
  const iuTrimmed = String(iu ?? "").trim();
  const tiTrimmed = String(ti ?? "").trim();

  if (!ci || !cs || !pu || !ot || !grant_type || !saak || !sask || !iuTrimmed || !tiTrimmed) {
    throw new Error("config_incomplete");
  }

  cachedConfig = { ci, cs, pu, ot, grant_type, saak, sask, iu: iuTrimmed, ti: tiTrimmed };
  cachedConfigAt = now;
  return cachedConfig;
}

export async function getIonApiAccessToken(supabase: SupabaseClient): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
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

  return cachedToken.token;
}