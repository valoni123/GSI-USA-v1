import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import ScreenSpinner from "@/components/ScreenSpinner";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { getStoredGsiPermissions, hasPermission } from "@/lib/gsi-permissions";
import { getGsiSessionAuthorizationHeader } from "@/lib/gsi-session";

const cleanValue = (value: string) => {
  const trimmed = (value || "").trim();
  return trimmed || "-";
};

type PlanningItem = {
  TransportID: string;
  RunNumber: string;
  TransportType: string;
  Item: string;
  HandlingUnit: string;
  Warehouse: string;
  LocationFrom: string;
  LocationTo: string;
  Remark: string;
  ETag: string;
  OrderedQuantity?: number | string | null;
};

const KittingAppList = () => {
  const navigate = useNavigate();
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);
  const huShortLabel = useMemo(() => {
    if (lang === "de") return "LE";
    if (lang === "es-MX") return "UH";
    if (lang === "pt-BR") return "UM";
    return "HU";
  }, [lang]);
  const permissions = useMemo(() => getStoredGsiPermissions(), []);
  const canLoadTransport = hasPermission(permissions, "trlo");
  const canUnloadTransport = hasPermission(permissions, "trul");

  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const selectedVehicleId = (localStorage.getItem("kittings.vehicle.id") || "").trim();

  const loadPlanningItems = async () => {
    if (!selectedVehicleId) {
      setItems([]);
      setError("Missing kitting id");
      return;
    }

    const { data } = await supabase.functions.invoke("ln-transports-list", {
      body: { vehicleId: selectedVehicleId, language: locale, transportType: "Kitting" },
    });

    if (data && data.ok) {
      setItems(data.items || []);
      setError(null);
      return;
    }

    setItems([]);
    setError((data && (data.error?.message || data.error)) || "Failed to load");
  };

  const fetchLoadedCount = async () => {
    if (!selectedVehicleId) {
      setLoadedCount(0);
      try {
        localStorage.setItem("transport.count", "0");
      } catch {}
      return;
    }

    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId: selectedVehicleId, language: locale, company: "1100" },
    });

    const nextCount = data && data.ok ? Number(data.count || 0) : 0;
    setLoadedCount(nextCount);
    try {
      localStorage.setItem("transport.count", String(nextCount));
    } catch {}
  };

  const loadPageData = async () => {
    setLoading(true);
    await Promise.all([loadPlanningItems(), fetchLoadedCount()]);
    setLoading(false);
  };

  useEffect(() => {
    void loadPageData();
  }, [locale, selectedVehicleId]);

  const setReturnRoute = () => {
    sessionStorage.setItem("transport.session.returnRoute", "/menu/kitting/list");
  };

  const onGetClick = async () => {
    if (!selectedVehicleId || assigning || !canLoadTransport) return;

    setAssigning(true);
    const tid = showLoading(trans.pleaseWait);
    const { data, error } = await supabase.functions.invoke("ln-assign-transport-orders", {
      body: {
        plannedVehicle: selectedVehicleId,
        planningType: "Kitting",
        language: locale,
      },
      headers: {
        Authorization: getGsiSessionAuthorizationHeader(),
      },
    });

    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      const err = (data && data.error) || error;
      const top = err?.message || "Assignment failed";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setAssigning(false);
      return;
    }

    await Promise.all([loadPlanningItems(), fetchLoadedCount()]);
    showSuccess("GET completed");
    setAssigning(false);
  };

  const onSelectTransport = (item: PlanningItem) => {
    if (!canLoadTransport) return;
    const prefillValue = (item.HandlingUnit || "").trim() || (item.Item || "").trim();
    if (!prefillValue) return;

    localStorage.setItem("vehicle.id", selectedVehicleId);
    setReturnRoute();
    sessionStorage.setItem("transport.load.prefill", prefillValue);
    sessionStorage.setItem(
      "transport.load.selected-item",
      JSON.stringify({
        TransportID: item.TransportID,
        RunNumber: item.RunNumber,
        Item: item.Item,
        HandlingUnit: item.HandlingUnit,
        Warehouse: item.Warehouse,
        LocationFrom: item.LocationFrom,
        LocationTo: item.LocationTo,
        Remark: item.Remark,
        ETag: item.ETag,
        OrderedQuantity: item.OrderedQuantity ?? null,
      }),
    );
    sessionStorage.setItem("transport.load.source", "transports-list");
    sessionStorage.setItem("transport.selected", "1");
    sessionStorage.removeItem("transport.fromMain");
    setSelecting(true);
    navigate("/menu/transport/load");
  };

  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
      localStorage.removeItem("vehicle.id");
      localStorage.removeItem("kittings.vehicle.id");
      localStorage.removeItem("transport.count");
      sessionStorage.removeItem("transport.session.returnRoute");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {(loading || selecting || assigning) && <ScreenSpinner message={trans.pleaseWait} />}

      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between gap-3">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu")} />

          <div className="flex-1 text-center flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/menu/kitting")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg uppercase text-black hover:opacity-80"
            >
              KITTINGS ({items.length})
            </button>
            {selectedVehicleId && (
              <span className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-gray-100 border border-white/20">
                Kitting ID: {selectedVehicleId}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-white/10"
            aria-label={trans.signOut}
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm">
          <Button
            type="button"
            className={canLoadTransport
              ? "h-8 bg-green-500 px-4 text-sm font-bold uppercase text-black hover:bg-green-600 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-green-500"
              : "h-8 bg-gray-300 px-4 text-sm font-bold uppercase text-gray-500 hover:bg-gray-300"}
            onClick={() => {
              if (!selectedVehicleId) return;
              localStorage.setItem("vehicle.id", selectedVehicleId);
              setReturnRoute();
              navigate("/menu/transport/load");
            }}
            disabled={!selectedVehicleId || !canLoadTransport}
          >
            {trans.loadAction}
          </Button>

          <Button
            type="button"
            className={canLoadTransport
              ? "h-8 bg-orange-500 px-4 text-sm font-bold uppercase text-white hover:bg-orange-600 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-orange-500"
              : "h-8 bg-gray-300 px-4 text-sm font-bold uppercase text-gray-500 hover:bg-gray-300"}
            onClick={() => {
              void onGetClick();
            }}
            disabled={!selectedVehicleId || assigning || !canLoadTransport}
          >
            GET
          </Button>

          <Button
            type="button"
            className={canUnloadTransport
              ? "h-8 bg-black px-4 text-sm font-bold uppercase text-white hover:bg-gray-800 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-black"
              : "h-8 bg-gray-300 px-4 text-sm font-bold uppercase text-gray-500 hover:bg-gray-300"}
            onClick={() => {
              if (!selectedVehicleId) return;
              localStorage.setItem("vehicle.id", selectedVehicleId);
              setReturnRoute();
              navigate("/menu/transport/unload");
            }}
            disabled={loadedCount === 0 || !canUnloadTransport}
          >
            {trans.unloadAction}
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={`${it.TransportID}-${it.HandlingUnit}-${idx}`}
                className="relative rounded-xl border-2 border-gray-300 bg-white px-3 pb-2 pt-4 shadow-sm"
              >
                <span className="absolute -top-3 left-3 rounded-md bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-700 border border-gray-300 leading-none">
                  {cleanValue(it.TransportID)}
                </span>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_30px] gap-x-3 gap-y-1 items-center text-sm leading-5">
                  <div className="min-w-0 truncate text-gray-700">
                    <span className="text-gray-500">{trans.itemLabel}:</span>{" "}
                    <span className="font-semibold text-gray-800">{cleanValue(it.Item)}</span>
                  </div>
                  <div className="min-w-0 truncate text-gray-700">
                    <span className="text-gray-500">{huShortLabel}:</span>{" "}
                    <span className="font-semibold text-gray-800">{cleanValue(it.HandlingUnit)}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Select kitting"
                    className={`row-span-2 inline-flex h-7 w-7 items-center justify-center rounded-md border ${canLoadTransport ? "border-red-300 text-red-600 hover:bg-red-50" : "border-gray-300 text-gray-400 cursor-not-allowed"}`}
                    onClick={() => onSelectTransport(it)}
                    disabled={!canLoadTransport}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 truncate text-sm leading-5 text-gray-700">
                    <span className="text-gray-500">{trans.fromLabel}:</span>{" "}
                    <span className="font-medium text-gray-800">{cleanValue(it.LocationFrom)}</span>
                  </div>
                  <div className="min-w-0 truncate text-sm leading-5 text-gray-700">
                    <span className="text-gray-500">{trans.toLabel}:</span>{" "}
                    <span className="font-medium text-gray-800">{cleanValue(it.LocationTo)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <SignOutConfirm
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={trans.signOutTitle}
        question={trans.signOutQuestion}
        yesLabel={trans.yes}
        noLabel={trans.no}
        onConfirm={onConfirmSignOut}
      />
    </div>
  );
};

export default KittingAppList;
