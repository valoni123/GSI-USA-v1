import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, RotateCcw } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import ScreenSpinner from "@/components/ScreenSpinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const cleanValue = (value: string) => {
  const trimmed = (value || "").trim();
  return trimmed || "-";
};

type PlanningItem = {
  TransportID: string;
  TransportType: string;
  Item: string;
  HandlingUnit: string;
  LocationFrom: string;
  LocationTo: string;
};

type LoadedListItem = {
  HandlingUnit: string;
  Item: string;
  LocationFrom: string;
  LocationTo: string;
  Warehouse: string;
  TransportID: string;
  RunNumber: string;
  ETag: string;
  OrderedQuantity?: number | string | null;
};

const TransportsList = () => {
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

  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [moveBackProcessing, setMoveBackProcessing] = useState(false);
  const [loadedCount, setLoadedCount] = useState<number>(() => Number(localStorage.getItem("transport.count") || "0"));
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [loadedItems, setLoadedItems] = useState<LoadedListItem[]>([]);
  const [movingBackMap, setMovingBackMap] = useState<Record<string, boolean>>({});
  const [listOpen, setListOpen] = useState(false);
  const [confirmMoveBackOpen, setConfirmMoveBackOpen] = useState(false);
  const [confirmItem, setConfirmItem] = useState<LoadedListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const selectedVehicleId = (localStorage.getItem("transports.vehicle.id") || localStorage.getItem("vehicle.id") || "").trim();

  const loadPlanningItems = async () => {
    if (!selectedVehicleId) {
      setItems([]);
      setError("Missing vehicle");
      return;
    }

    const { data } = await supabase.functions.invoke("ln-transports-list", {
      body: { vehicleId: selectedVehicleId, language: locale },
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

  const fetchLoadedList = async () => {
    if (!selectedVehicleId) {
      setLoadedItems([]);
      setLoadedCount(0);
      try {
        localStorage.setItem("transport.count", "0");
      } catch {}
      return;
    }

    const { data } = await supabase.functions.invoke("ln-transport-list", {
      body: { vehicleId: selectedVehicleId, language: locale, company: "1100" },
    });

    if (data && data.ok) {
      const nextItems = Array.isArray(data.items)
        ? (data.items as any[]).map((v) => ({
            HandlingUnit: String(v?.HandlingUnit ?? ""),
            Item: String(v?.Item ?? ""),
            LocationFrom: String(v?.LocationFrom ?? ""),
            LocationTo: String(v?.LocationTo ?? ""),
            Warehouse: String(v?.Warehouse ?? ""),
            TransportID: String(v?.TransportID ?? ""),
            RunNumber: String(v?.RunNumber ?? ""),
            ETag: String(v?.ETag ?? ""),
            OrderedQuantity: v?.OrderedQuantity ?? null,
          })) as LoadedListItem[]
        : [];
      const nextCount = Number(data.count ?? nextItems.length ?? 0);
      setLoadedItems(nextItems);
      setLoadedCount(nextCount);
      try {
        localStorage.setItem("transport.count", String(nextCount));
      } catch {}
      return;
    }

    setLoadedItems([]);
    setLoadedCount(0);
    try {
      localStorage.setItem("transport.count", "0");
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

  const onSelectTransport = (item: { HandlingUnit: string; Item: string }) => {
    const prefillValue = (item.HandlingUnit || "").trim() || (item.Item || "").trim();
    if (!prefillValue) return;

    localStorage.setItem("vehicle.id", selectedVehicleId);
    sessionStorage.setItem("transport.load.prefill", prefillValue);
    sessionStorage.setItem("transport.load.source", "transports-list");
    sessionStorage.setItem("transport.selected", "1");
    sessionStorage.removeItem("transport.fromMain");
    setSelecting(true);
    navigate("/menu/transport/load");
  };

  const moveBackKey = (it: LoadedListItem) => `${it.TransportID}::${it.RunNumber}::${it.HandlingUnit}`;

  const onMoveBack = async (it: LoadedListItem) => {
    const key = moveBackKey(it);
    if (movingBackMap[key] || moveBackProcessing) return;

    const currentItem = {
      HandlingUnit: (it.HandlingUnit || "").trim(),
      Warehouse: (it.Warehouse || "").trim(),
      LocationFrom: (it.LocationFrom || "").trim(),
      TransportID: (it.TransportID || "").trim(),
      RunNumber: (it.RunNumber || "").trim(),
      ETag: (it.ETag || "").trim(),
    };

    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();

    if (!selectedVehicleId) {
      showError("No vehicle selected. Please set a Vehicle ID.");
      return;
    }

    setMovingBackMap((m) => ({ ...m, [key]: true }));
    setMoveBackProcessing(true);

    const tid = showLoading(trans.executingMovement);
    const { data: moveData, error: moveErr } = await supabase.functions.invoke("ln-move-to-location", {
      body: {
        handlingUnit: currentItem.HandlingUnit,
        fromWarehouse: currentItem.Warehouse,
        fromLocation: selectedVehicleId,
        toWarehouse: currentItem.Warehouse,
        toLocation: currentItem.LocationFrom,
        employee: employeeCode,
        language: locale,
      },
    });

    if (moveErr || !moveData || !moveData.ok) {
      dismissToast(tid as unknown as string);
      const err = (moveData && moveData.error) || moveErr;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setMovingBackMap((m) => ({ ...m, [key]: false }));
      setMoveBackProcessing(false);
      return;
    }

    const { data: patchData, error: patchErr } = await supabase.functions.invoke("ln-update-transport-order", {
      body: {
        transportId: currentItem.TransportID,
        runNumber: currentItem.RunNumber,
        etag: currentItem.ETag,
        vehicleId: "",
        language: locale,
        company: "1100",
      },
    });
    dismissToast(tid as unknown as string);

    if (patchErr || !patchData || !patchData.ok) {
      const err = (patchData && patchData.error) || patchErr;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setMovingBackMap((m) => ({ ...m, [key]: false }));
      setMoveBackProcessing(false);
      return;
    }

    showSuccess("Moved back");
    await Promise.all([loadPlanningItems(), fetchLoadedList()]);
    setMovingBackMap((m) => ({ ...m, [key]: false }));
    setMoveBackProcessing(false);
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
      localStorage.removeItem("transports.vehicle.id");
      localStorage.removeItem("transport.count");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {(loading || selecting || listLoading || moveBackProcessing) && <ScreenSpinner message={trans.pleaseWait} />}

      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between gap-3">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu")} />

          <div className="flex-1 font-bold text-lg text-center flex items-center justify-center gap-2">
            <span>{trans.appTransports}</span>
            <button
              type="button"
              className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-red-700 px-2 text-xs font-bold text-white leading-none"
              onClick={async () => {
                setListOpen(true);
                setListLoading(true);
                await fetchLoadedList();
                setListLoading(false);
              }}
              aria-label="Show loaded transports"
            >
              {loadedCount}
            </button>
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
                    aria-label="Select transport"
                    className="row-span-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => onSelectTransport(it)}
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

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
          <div className="text-sm">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 border-b rounded-t-lg bg-black text-white">
              <div className="font-semibold">{trans.huOrItemLabel}</div>
              <div className="font-semibold">{trans.fromLabel}</div>
              <div className="font-semibold">{trans.toLabel}</div>
              <div className="font-semibold text-right"> </div>
            </div>

            <div className="max-h-64 overflow-auto mt-0 space-y-2 px-2 py-2">
              {loadedItems.length === 0 ? (
                <div className="text-xs text-muted-foreground px-1">{trans.noEntries}</div>
              ) : (
                loadedItems.map((it, idx) => {
                  const key = moveBackKey(it);
                  return (
                    <div key={`${it.TransportID}-${it.RunNumber}-${idx}`}>
                      <div className="rounded-md bg-gray-100/80 px-3 py-2 shadow-sm">
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center text-xs">
                          <div className="break-all">{it.HandlingUnit || it.Item || "-"}</div>
                          <div className="break-all">{it.LocationFrom || "-"}</div>
                          <div className="break-all">{it.LocationTo || "-"}</div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              onClick={() => {
                                setConfirmItem(it);
                                setConfirmMoveBackOpen(true);
                              }}
                              disabled={moveBackProcessing || Boolean(movingBackMap[key])}
                              aria-label="Move back"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      {idx < loadedItems.length - 1 && <div className="h-px bg-gray-200/60 mx-1 my-2" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmMoveBackOpen} onOpenChange={setConfirmMoveBackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move back</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-gray-700">Do you really want to move it back?</div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setConfirmMoveBackOpen(false);
                setConfirmItem(null);
              }}
            >
              Cancel
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                const it = confirmItem;
                setConfirmMoveBackOpen(false);
                setConfirmItem(null);
                if (it) {
                  await onMoveBack(it);
                }
              }}
            >
              Move back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

export default TransportsList;