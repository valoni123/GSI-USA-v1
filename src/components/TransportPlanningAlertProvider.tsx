import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LanguageKey } from "@/lib/i18n";

type TransportPlanningAlertContextValue = {
  count: number;
  hasVehicle: boolean;
};

const TransportPlanningAlertContext = createContext<TransportPlanningAlertContextValue>({
  count: 0,
  hasVehicle: false,
});

const POLL_INTERVAL_MS = 20_000;
const STORAGE_KEY = "transport.planning.count";

const getStoredVehicleId = () =>
  (localStorage.getItem("vehicle.id") || localStorage.getItem("transports.vehicle.id") || "").trim();

const getLocale = (lang: LanguageKey | null) => {
  if (lang === "de") return "de-DE";
  if (lang === "es-MX") return "es-MX";
  if (lang === "pt-BR") return "pt-BR";
  return "en-US";
};

const hasStoredSession = () => {
  const gsiId = (localStorage.getItem("gsi.id") || "").trim();
  const login = (localStorage.getItem("gsi.login") || "").trim();
  const token = (localStorage.getItem("ln.token") || "").trim();
  return Boolean(gsiId && login && token);
};

export const TransportPlanningAlertProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState<number>(() => Number(localStorage.getItem(STORAGE_KEY) || "0"));
  const [vehicleId, setVehicleId] = useState<string>(() => getStoredVehicleId());
  const inFlightRef = useRef(false);

  useEffect(() => {
    const syncVehicleId = () => {
      const nextVehicleId = getStoredVehicleId();
      setVehicleId(nextVehicleId);
      if (!nextVehicleId) {
        setCount(0);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    const syncFromStorage = (event: StorageEvent) => {
      if (!event.key || ["vehicle.id", "transports.vehicle.id", "ln.token", "gsi.id", "gsi.login", STORAGE_KEY].includes(event.key)) {
        syncVehicleId();
        if (event.key === STORAGE_KEY) {
          setCount(Number(localStorage.getItem(STORAGE_KEY) || "0"));
        }
      }
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("vehicle-id-updated", syncVehicleId);
    window.addEventListener("auth-state-updated", syncVehicleId);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("vehicle-id-updated", syncVehicleId);
      window.removeEventListener("auth-state-updated", syncVehicleId);
    };
  }, []);

  useEffect(() => {
    const refreshCount = async () => {
      if (inFlightRef.current) return;
      if (!hasStoredSession() || !vehicleId) {
        setCount(0);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      inFlightRef.current = true;
      try {
        const lang = (localStorage.getItem("app.lang") as LanguageKey | null) || "en";
        const { data } = await supabase.functions.invoke("ln-transport-planning-count", {
          body: {
            vehicleId,
            language: getLocale(lang),
            company: "1100",
          },
        });

        const nextCount = data && data.ok ? Number(data.count || 0) : 0;
        setCount(nextCount);
        localStorage.setItem(STORAGE_KEY, String(nextCount));
      } finally {
        inFlightRef.current = false;
      }
    };

    void refreshCount();
    const interval = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      void refreshCount();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [vehicleId]);

  const value = useMemo(
    () => ({ count, hasVehicle: Boolean(vehicleId) }),
    [count, vehicleId],
  );

  return (
    <TransportPlanningAlertContext.Provider value={value}>
      {children}
    </TransportPlanningAlertContext.Provider>
  );
};

export const useTransportPlanningAlert = () => useContext(TransportPlanningAlertContext);
