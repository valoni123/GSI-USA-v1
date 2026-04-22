import { clearStoredGsiPermissions } from "@/lib/gsi-permissions";
import { clearStoredGsiSession } from "@/lib/gsi-session";

const IDENTITY_KEYS = [
  "gsi.id",
  "gsi.full_name",
  "gsi.username",
  "gsi.employee",
  "gsi.login",
  "vehicle.id",
  "transports.vehicle.id",
  "transport.count",
] as const;

export const hasStoredGsiIdentity = () => {
  if (typeof window === "undefined") return false;

  try {
    const gsiId = (localStorage.getItem("gsi.id") || "").trim();
    const login = (localStorage.getItem("gsi.login") || "").trim();
    return Boolean(gsiId && login);
  } catch {
    return false;
  }
};

export const storeGsiIdentity = (identity: {
  gsiId?: string;
  fullName?: string;
  username?: string;
  loginUsername: string;
}) => {
  if (typeof window === "undefined") return;

  try {
    if (identity.gsiId) localStorage.setItem("gsi.id", identity.gsiId);
    if (identity.fullName) localStorage.setItem("gsi.full_name", identity.fullName);
    if (identity.username) localStorage.setItem("gsi.username", identity.username);
    localStorage.setItem("gsi.employee", identity.loginUsername);
    localStorage.setItem("gsi.login", identity.loginUsername);
  } catch {}
};

export const clearStoredGsiAuth = () => {
  if (typeof window === "undefined") return;

  clearStoredGsiSession();
  clearStoredGsiPermissions();

  try {
    for (const key of IDENTITY_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {}
};
