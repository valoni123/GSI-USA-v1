const SESSION_TOKEN_KEY = "gsi.session.token";
const SESSION_EXPIRES_AT_KEY = "gsi.session.expires_at";

const isBrowser = () => typeof window !== "undefined";

export const getStoredGsiSessionToken = () => {
  if (!isBrowser()) return "";

  try {
    return (sessionStorage.getItem(SESSION_TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const getStoredGsiSessionExpiry = () => {
  if (!isBrowser()) return "";

  try {
    return (sessionStorage.getItem(SESSION_EXPIRES_AT_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const hasValidGsiSession = () => {
  const token = getStoredGsiSessionToken();
  const expiresAt = getStoredGsiSessionExpiry();
  if (!token || !expiresAt) return false;

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
};

export const setStoredGsiSession = (token: string, expiresAt: string) => {
  if (!isBrowser()) return;

  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_EXPIRES_AT_KEY, expiresAt);
    localStorage.removeItem("ln.token");
  } catch {}
};

export const clearStoredGsiSession = () => {
  if (!isBrowser()) return;

  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  } catch {}

  try {
    localStorage.removeItem("ln.token");
  } catch {}
};

export const getGsiSessionAuthorizationHeader = () => {
  if (!hasValidGsiSession()) {
    clearStoredGsiSession();
    return "";
  }

  const token = getStoredGsiSessionToken();
  return token ? `Bearer ${token}` : "";
};
