import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, RotateCcw } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import ScreenSpinner from "@/components/ScreenSpinner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { getStoredGsiPermissions, hasPermission } from "@/lib/gsi-permissions";
import { getStoredGsiUsername } from "@/lib/gsi-user";

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
  ETag: string;
  OrderedQuantity?: number | string | null;
  OrderUnit?: string | null;
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
  const moveBackLocationRef = useRef<HTMLInputElement | null>(null);
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
  const [listLoading, setListLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [moveBackProcessing, setMoveBackProcessing] = useState(false);
  const [planningLoadingMore, setPlanningLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState<number>(() => Number(localStorage.getItem("transport.count") || "0"));
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [planningTotalCount, setPlanningTotalCount] = useState(0);
  const [planningNextPageUrl, setPlanningNextPageUrl] = useState<string | null>(null);
  const [loadedItems, setLoadedItems] = useState<LoadedListItem[]>([]);
  const [movingBackMap, setMovingBackMap] = useState<Record<string, boolean>>({});
  const [listOpen, setListOpen] = useState(false);
  const [moveBackDialogOpen, setMoveBackDialogOpen] = useState(false);
  const [moveBackItem, setMoveBackItem] = useState<LoadedListItem | null>(null);
  const [moveBackLocation, setMoveBackLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const selectedVehicleId = (localStorage.getItem("transports.vehicle.id") || localStorage.getItem("vehicle.id") || "").trim();

  const formatQuantity = (quantity?: number | string | null, unit?: string | null) => {
    const normalizedUnit = (unit || "").trim();

    if (typeof quantity === "number") {
      return normalizedUnit ? `${quantity} ${normalizedUnit}` : String(quantity);
    }

    const normalizedQuantity = (quantity || "").toString().trim();
    if (!normalizedQuantity) {
      return normalizedUnit || "-";
    }

    return normalizedUnit ? `${normalizedQuantity} ${normalizedUnit}` : normalizedQuantity;
  };

  const loadPlanningItems = async ({ append = false, nextPageUrl = "" }: { append?: boolean; nextPageUrl?: string } = {}) => {
    if (!selectedVehicleId) {
      setItems([]);
      setPlanningTotalCount(0);
      setPlanningNextPageUrl(null);
      setError("Missing vehicle");
      return;
    }

    console.log("[TransportsList] loading planning items", {
      selectedVehicleId,
      append,
      nextPageUrl,
    });

    const { data } = await supabase.functions.invoke("ln-transports-list", {
      body: { vehicleId: selectedVehicleId, language: locale, nextPageUrl },
    });

    if (data && data.ok) {
      const nextItems = Array.isArray(data.items) ? (data.items as PlanningItem[]) : [];
      setItems((current) => (append ? [...current, ...nextItems] : nextItems));
      if (typeof data.count === "number") {
        setPlanningTotalCount(Number(data.count));
      } else if (!append) {
        setPlanningTotalCount(nextItems.length);
      }
      setPlanningNextPageUrl(typeof data.nextPageUrl === "string" && data.nextPageUrl.trim() ? data.nextPageUrl : null);
      setError(null);
      return;
    }

    if (!append) {
      setItems([]);
      setPlanningTotalCount(0);
    }
    setPlanningNextPageUrl(null);
    setError((data && (data.error?.message || data.error)) || "Failed to load");
  };

  const loadMorePlanningItems = async () => {
    if (!planningNextPageUrl || planningLoadingMore) return;
    setPlanningLoadingMore(true);
    await loadPlanningItems({ append: true, nextPageUrl: planningNextPageUrl });
    setPlanningLoadingMore(false);
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
    await loadPlanningItems();
    setLoading(false);
    void fetchLoadedCount();
  };

  useEffect(() => {
    void loadPageData();
  }, [locale, selectedVehicleId]);

  const openLoadedList = async () => {
    setListOpen(true);
    setListLoading(true);
    await fetchLoadedList();
    setListLoading(false);
  };

  const onGetClick = async () => {
    if (!selectedVehicleId || assigning || !canLoadTransport) return;

    setAssigning(true);
    const tid = showLoading(trans.pleaseWait);
    const { data, error } = await supabase.functions.invoke("ln-assign-transport-orders", {
      body: {
        plannedVehicle: selectedVehicleId,
        language: locale,
        company: "1100",
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

    setAssigning(false);
    showSuccess("GET completed");

    void Promise.all([
      loadPlanningItems(),
      listOpen ? fetchLoadedList() : Promise.resolve(),
    ]).finally(() => {
      void fetchLoadedCount();
    });
  };

  const onSelectTransport = (item: PlanningItem) => {
    if (!canLoadTransport) return;
    const prefillValue = (item.HandlingUnit || "").trim() || (item.Item || "").trim();
    if (!prefillValue) return;

    const transportLineLoadState = {
      prefillValue,
      vehicleId: selectedVehicleId,
      transportId: (item.TransportID || "").trim(),
      item: (item.Item || "").trim(),
      handlingUnit: (item.HandlingUnit || "").trim(),
      locationFrom: (item.LocationFrom || "").trim(),
    };

    localStorage.setItem("vehicle.id", selectedVehicleId);
    sessionStorage.setItem("transport.line.load.prefill", prefillValue);
    sessionStorage.setItem("transport.line.load.vehicle", selectedVehicleId);
    sessionStorage.setItem("transport.line.load.state", JSON.stringify(transportLineLoadState));
    sessionStorage.setItem("transport.load.prefill", prefillValue);
    sessionStorage.setItem("transport.load.selected-item", JSON.stringify({
      TransportID: item.TransportID,
      RunNumber: item.RunNumber,
      Item: item.Item,
      HandlingUnit: item.HandlingUnit,
      Warehouse: item.Warehouse,
      LocationFrom: item.LocationFrom,
      LocationTo: item.LocationTo,
      ETag: item.ETag,
      OrderedQuantity: item.OrderedQuantity ?? null,
    }));
    sessionStorage.setItem("transport.load.source", "transports-list");
    sessionStorage.setItem("transport.selected", "1");
    sessionStorage.removeItem("transport.fromMain");
    setSelecting(true);
    navigate("/menu/transports/load", {
      state: transportLineLoadState,
    });
  };

  const moveBackKey = (it: LoadedListItem) => `${it.TransportID}::${it.RunNumber}::${it.HandlingUnit}`;

  const onMoveBack = async (it: LoadedListItem, targetLocationOverride?: string) => {
    if (!canLoadTransport) return;
    const key = moveBackKey(it);
    if (movingBackMap[key] || moveBackProcessing) return;

    const currentItem = {
      HandlingUnit: (it.HandlingUnit || "").trim(),
      Item: (it.Item ?? "").toString(),
      Warehouse: (it.Warehouse || "").trim(),
      LocationFrom: (it.LocationFrom || "").trim(),
      TransportID: (it.TransportID || "").trim(),
      RunNumber: (it.RunNumber || "").trim(),
      ETag: (it.ETag || "").trim(),
      OrderedQuantity: it.OrderedQuantity ?? null,
    };

    const employeeCode = getStoredGsiUsername();

    if (!selectedVehicleId) {
      showError("No vehicle selected. Please set a Vehicle ID.");
      return;
    }

    const targetLocation = (targetLocationOverride || currentItem.LocationFrom).trim();
    if (!targetLocation) {
      showError("Missing target location.");
      return;
    }

    const movePayload: Record<string, unknown> = {
      handlingUnit: currentItem.HandlingUnit,
      fromWarehouse: currentItem.Warehouse,
      fromLocation: selectedVehicleId,
      toWarehouse: currentItem.Warehouse,
      toLocation: targetLocation,
      employee: employeeCode,
      language: locale,
    };

    if (!currentItem.HandlingUnit) {
      const rawQty = currentItem.OrderedQuantity as string | number | null;
      const qty =
        typeof rawQty === "number"
          ? rawQty
          : (typeof rawQty === "string" && rawQty.trim() ? Number(rawQty) : NaN);

      if (!currentItem.Item || Number.isNaN(qty)) {
        showError("Missing OrderedQuantity for item movement.");
        return;
      }

      movePayload.item = currentItem.Item;
      movePayload.quantity = qty;
    }

    setMovingBackMap((m) => ({ ...m, [key]: true }));
    setMoveBackProcessing(true);

    const tid = showLoading(trans.executingMovement);
    const { data: moveData, error: moveErr } = await supabase.functions.invoke("ln-move-to-location", {
      body: movePayload,
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

    await Promise.all([loadPlanningItems(), fetchLoadedList()]);
    void fetchLoadedCount();
    showSuccess("Moved back");
    setMovingBackMap((m) => ({ ...m, [key]: false }));
    setMoveBackProcessing(false);
  };

  const openMoveBackDialog = (it: LoadedListItem) => {
    if (!canLoadTransport) return;
    if (moveBackProcessing || Boolean(movingBackMap[moveBackKey(it)])) return;
    setMoveBackItem(it);
    setMoveBackLocation((it.LocationFrom || "").trim());
    setMoveBackDialogOpen(true);
    window.setTimeout(() => moveBackLocationRef.current?.focus(), 50);
  };

  const closeMoveBackDialog = () => {
    setMoveBackDialogOpen(false);
    setMoveBackItem(null);
    setMoveBackLocation("");
  };

  const confirmMoveBack = async () => {
    const it = moveBackItem;
    const targetLocation = moveBackLocation.trim();
    if (!it || !targetLocation) return;
    closeMoveBackDialog();
    await onMoveBack(it, targetLocation);
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

  const visibleCount = planningTotalCount > 0 ? planningTotalCount : items.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {(loading || selecting || listLoading || moveBackProcessing || assigning) && <ScreenSpinner message={trans.pleaseWait} />}

      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between gap-3">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu")} />

          <div className="flex-1 text-center flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/menu/transports")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg uppercase text-black hover:opacity-80"
            >
              {trans.appTransports} ({visibleCount})
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
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md bg-green-500 px-4 text-sm font-bold uppercase text-black shadow hover:bg-green-600 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-green-500"
            onClick={() => {
              void openLoadedList();
            }}
            disabled={loadedCount === 0}
          >
            {loadedCount} {trans.loadedUpperLabel}
          </button>

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
            onClick={() => navigate("/menu/transport/unload")}
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
                    aria-label="Select transport"
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
                    <span className="text-gray-500">{trans.quantityLabel}:</span>{" "}
                    <span className="font-medium text-gray-800">{formatQuantity(it.OrderedQuantity, it.OrderUnit)}</span>
                  </div>
                </div>
              </div>
            ))}

            {planningNextPageUrl && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={() => {
                  void loadMorePlanningItems();
                }}
                disabled={planningLoadingMore}
              >
                {planningLoadingMore ? trans.loadingList : trans.loadMore}
              </Button>
            )}
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
          <div className="text-sm">
            <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 px-3 py-2 border-b rounded-t-lg bg-black text-white">
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
                        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 items-center text-xs">
                          <div className="truncate">
                            <span className="inline-block max-w-full truncate rounded-md bg-gray-300 px-2 py-1">
                              {it.HandlingUnit || it.Item || "-"}
                            </span>
                          </div>
                          <div className="truncate">{it.LocationFrom || "-"}</div>
                          <div className="truncate">{it.LocationTo || "-"}</div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className={`inline-flex items-center justify-center h-7 w-7 rounded-md border ${canLoadTransport ? "border-red-600 text-red-600 hover:bg-red-50" : "border-gray-300 text-gray-400 cursor-not-allowed"} disabled:opacity-100`}
                              onClick={() => {
                                openMoveBackDialog(it);
                              }}
                              disabled={!canLoadTransport || moveBackProcessing || Boolean(movingBackMap[key])}
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

      <Dialog
        open={moveBackDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMoveBackDialog();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-lg bg-white p-0">
          <div className="border-b bg-black px-4 py-3 text-left text-sm font-semibold text-white">Move back</div>
          <div className="space-y-4 p-4">
            <FloatingLabelInput
              id="moveBackLocation"
              ref={moveBackLocationRef}
              autoFocus
              label={`${trans.targetLocationLabel} *`}
              value={moveBackLocation}
              disabled={moveBackProcessing}
              onChange={(e) => setMoveBackLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void confirmMoveBack();
                }
              }}
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={closeMoveBackDialog}
              >
                {trans.cancel}
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
                disabled={!moveBackLocation.trim() || moveBackProcessing}
                onClick={() => {
                  void confirmMoveBack();
                }}
              >
                Move back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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