export type GsiPermissions = {
  admin: boolean;
  rece: boolean;
  insp: boolean;
  itif: boolean;
  huif: boolean;
  corr: boolean;
  trans: boolean;
  cntg: boolean;
  pick: boolean;
  rele: boolean;
  load: boolean;
  ship: boolean;
  trlo: boolean;
  trul: boolean;
};

const STORAGE_KEY = "gsi.permissions";

const permissionKeys: Array<keyof GsiPermissions> = [
  "admin",
  "rece",
  "insp",
  "itif",
  "huif",
  "corr",
  "trans",
  "cntg",
  "pick",
  "rele",
  "load",
  "ship",
  "trlo",
  "trul",
];

export const emptyGsiPermissions: GsiPermissions = {
  admin: false,
  rece: false,
  insp: false,
  itif: false,
  huif: false,
  corr: false,
  trans: false,
  cntg: false,
  pick: false,
  rele: false,
  load: false,
  ship: false,
  trlo: false,
  trul: false,
};

const toBool = (value: unknown) => value === true || String(value ?? "").toLowerCase() === "true";

export const normalizeGsiPermissions = (value: unknown): GsiPermissions => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return permissionKeys.reduce((acc, key) => {
    acc[key] = toBool(source[key]);
    return acc;
  }, { ...emptyGsiPermissions });
};

export const getStoredGsiPermissions = (): GsiPermissions => {
  if (typeof window === "undefined") return emptyGsiPermissions;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyGsiPermissions;
    return normalizeGsiPermissions(JSON.parse(raw));
  } catch {
    return emptyGsiPermissions;
  }
};

export const setStoredGsiPermissions = (permissions: unknown) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeGsiPermissions(permissions)));
  } catch {}
};

export const clearStoredGsiPermissions = () => {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

export const hasPermission = (permissions: GsiPermissions, key: keyof GsiPermissions) => permissions.admin || permissions[key];

export const canAccessIncomingMenu = (permissions: GsiPermissions) => hasPermission(permissions, "rece") || hasPermission(permissions, "insp");
export const canAccessOutgoingMenu = (permissions: GsiPermissions) => hasPermission(permissions, "pick") || hasPermission(permissions, "rele") || hasPermission(permissions, "load") || hasPermission(permissions, "ship");
export const canAccessInfoStockMenu = (permissions: GsiPermissions) => hasPermission(permissions, "itif") || hasPermission(permissions, "huif") || hasPermission(permissions, "corr") || hasPermission(permissions, "trans") || hasPermission(permissions, "cntg");
export const canAccessTransportMenus = (permissions: GsiPermissions) => hasPermission(permissions, "trlo") || hasPermission(permissions, "trul");
