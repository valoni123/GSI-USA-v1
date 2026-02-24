import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type ActiveConfig = {
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

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("env_missing");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getActiveConfig(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<ActiveConfig> {
  const { data: cfgData, error: cfgErr } = await supabase.rpc("get_active_ionapi");
  if (cfgErr) throw new Error("config_error");
  const cfg = Array.isArray(cfgData) ? cfgData[0] : cfgData;
  if (!cfg) throw new Error("no_active_config");

  const { data: row, error: rowErr } = await supabase
    .from("ionapi_oauth2")
    .select("iu, ti")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (rowErr || !row) throw new Error("no_active_config_row");

  const ac: ActiveConfig = {
    ci: String(cfg.ci || ""),
    cs: String(cfg.cs || ""),
    pu: String(cfg.pu || ""),
    ot: String(cfg.ot || ""),
    grant_type: String(cfg.grant_type || ""),
    saak: String(cfg.saak || ""),
    sask: String(cfg.sask || ""),
    iu: String(row.iu || ""),
    ti: String(row.ti || ""),
  };

  if (!ac.ci || !ac.cs || !ac.pu || !ac.ot || !ac.saak || !ac.sask || !ac.iu || !ac.ti) {
    throw new Error("config_incomplete");
  }
  return ac;
}

function buildTokenUrl(pu: string, ot: string) {
  const base = pu.endsWith("/") ? pu : pu + "/";
  return base + ot.replace(/^\//, "");
}

export async function getAccessTokenCached(cfg: ActiveConfig): Promise<string> {
  const cacheKey = `${cfg.pu}|${cfg.ot}|${cfg.saak}|${cfg.sask}`;
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 15_000) {
    return cached.token;
  }

  const basic = btoa(`${cfg.ci}:${cfg.cs}`);
  const gt = cfg.grant_type === "password_credentials" ? "password" : cfg.grant_type || "password";
  const tokenParams = new URLSearchParams();
  tokenParams.set("grant_type", gt);
  tokenParams.set("username", cfg.saak);
  tokenParams.set("password", cfg.sask);

  const res = await fetch(buildTokenUrl(cfg.pu, cfg.ot), {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Connection": "keep-alive",
    },
    body: tokenParams.toString(),
    keepalive: true,
  }).catch(() => null as unknown as Response);
  if (!res) throw new Error("token_network_error");
  const json = await res.json().catch(() => null) as any;
  if (!res.ok || !json || typeof json.access_token !== "string") {
    throw new Error(`token_error:${json?.error_description || "unknown"}`);
  }
  const expires = Number(json.expires_in || 900);
  tokenCache.set(cacheKey, { token: json.access_token as string, expiresAt: now + expires * 1000 });
  return json.access_token as string;
}

export function buildODataBase(cfg: ActiveConfig) {
  const iu = cfg.iu.endsWith("/") ? cfg.iu.slice(0, -1) : cfg.iu;
  return `${iu}/${cfg.ti}/LN/lnapi/odata`;
}

export async function fetchOData(cfg: ActiveConfig, company: string, pathAndQuery: string, language = "en-US") {
  const token = await getAccessTokenCached(cfg);
  const base = buildODataBase(cfg);
  const url = `${base}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "accept": "application/json",
      "Content-Language": language,
      "X-Infor-LnCompany": company,
      "Authorization": `Bearer ${token}`,
      "Connection": "keep-alive",
    },
    keepalive: true,
  }).catch(() => null as unknown as Response);
  return res;
}