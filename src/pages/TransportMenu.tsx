import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowBigLeft, ArrowBigRight, Forklift, User, LogOut, Search, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BackButton from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ScreenSpinner from "@/components/ScreenSpinner";

type Tile = { key: string; label: string; icon: React.ReactNode };

const TransportMenu = () => {
  const navigate = useNavigate();

  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);

  const [fullName, setFullName] = useState<string>("");
  useEffect(() => {
    const name = localStorage.getItem("gsi.full_name");
    if (name) setFullName(name);
  }, []);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      // Clear cached transport count on sign-out to avoid stale badges
      localStorage.removeItem("transport.count");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const tiles: Tile[] = [
    {
      key: "load",
      label: trans.transportLoad,
      icon: (
        <div className="relative flex items-center justify-center">
          <Forklift className="h-10 w-10 text-red-700" />
          <ArrowBigLeft className="absolute -right-4 top-1/2 -translate-y-1/2 h-7 w-7 text-red-700" />
        </div>
      ),
    },
    {
      key: "unload",
      label: trans.transportUnload,
      icon: (
        <div className="relative flex items-center justify-center">
          <Forklift className="h-10 w-10 text-red-700 transform scale-x-[-1]" />
          <ArrowBigRight className="absolute -left-4 top-1/2 -translate-y-1/2 h-7 w-7 text-red-700" />
        </div>
      ),
    },
  ];
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [listOpen, setListOpen] = useState<boolean>(false);
  type LoadedListItem = {
    HandlingUnit: string;
    LocationFrom: string;
    LocationTo: string;
    Warehouse: string;
    TransportID: string;
    RunNumber: string;
    ETag: string;
    Item?: string;
    OrderedQuantity?: number | string | null;
  };
  const [listItems, setListItems] = useState<LoadedListItem[]>([]);
  const [movingBackMap, setMovingBackMap] = useState<Record<string, boolean>>({});
  const [moveBackProcessing, setMoveBackProcessing] = useState<boolean>(false);
  const [listLoading, setListLoading] = useState<boolean>(false);
  const [confirmMoveBackOpen, setConfirmMoveBackOpen] = useState<boolean>(false);
  const [confirmItem, setConfirmItem] = useState<LoadedListItem | null>(null);
  const moveBackRequestIdRef = useRef(0);

  // Vehicle selection
  const initialSelected = sessionStorage.getItem("transport.selected") === "1";
  const initialFromMain = sessionStorage.getItem("transport.fromMain") === "1";
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState<boolean>(initialFromMain ? true : !initialSelected);
  const [vehicleList, setVehicleList] = useState<Array<{ VehicleID: string; Description: string }>>([]);
  const [vehicleQuery, setVehicleQuery] = useState<string>("");

  const filteredVehicles = vehicleList.filter((v) => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      v.VehicleID.toLowerCase().includes(q) ||
      (v.Description || "").toLowerCase().includes(q)
    );
  });
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState<boolean>(false);

  // Helper to fetch count for a given vehicle (called only after load/unload)
  const fetchCount = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId: vid, language: "en-US", company: "1100" },
    });
    const next = data && data.ok ? Number(data.count || 0) : 0;
    setLoadedCount(next);
    try {
      localStorage.setItem("transport.count", String(next));
    } catch {}
  };

  const fetchList = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-list", {
      body: { vehicleId: vid, language: "en-US", company: "1100" },
    });
    if (data && data.ok) {
      const items = Array.isArray(data.items)
        ? (data.items as any[]).map((v) => ({
            HandlingUnit: String(v?.HandlingUnit ?? ""),
            LocationFrom: String(v?.LocationFrom ?? ""),
            LocationTo: String(v?.LocationTo ?? ""),
            Warehouse: String(v?.Warehouse ?? ""),
            TransportID: String(v?.TransportID ?? ""),
            RunNumber: String(v?.RunNumber ?? ""),
            ETag: String(v?.ETag ?? ""),
            Item: v?.Item ?? "",
            OrderedQuantity: v?.OrderedQuantity ?? null,
          })) as LoadedListItem[]
        : [];
      setListItems(items);
      const next = Number(data.count ?? items.length ?? 0);
      setLoadedCount(next);
      try { localStorage.setItem("transport.count", String(next)); } catch {}
    } else {
      setListItems([]);
      setLoadedCount(0);
      try { localStorage.setItem("transport.count", "0"); } catch {}
    }
  };

  const moveBackKey = (it: LoadedListItem) => `${it.TransportID}::${it.RunNumber}::${it.HandlingUnit || it.Item || it.LocationFrom}`;

  const onMoveBack = async (it: LoadedListItem) => {
    const key = moveBackKey(it);
    if (movingBackMap[key] || moveBackProcessing) return;
    
    const requestId = ++moveBackRequestIdRef.current;
    const currentItem = {
      HandlingUnit: (it.HandlingUnit || "").trim(),
      Item: it.Item || "",
      Warehouse: (it.Warehouse || "").trim(),
      LocationFrom: (it.LocationFrom || "").trim(),
      TransportID: (it.TransportID || "").trim(),
      RunNumber: (it.RunNumber || "").trim(),
      ETag: (it.ETag || "").trim(),
      OrderedQuantity: it.OrderedQuantity,
    };

    setMovingBackMap((m) => ({ ...m, [key]: true }));
    setMoveBackProcessing(true);

    const vid = (localStorage.getItem("vehicle.id") || "").trim();
    if (!vid) {
      showError("No vehicle selected. Please set a Vehicle ID.");
      setMovingBackMap((m) => ({ ...m, [key]: false }));
      setMoveBackProcessing(false);
      return;
    }
    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();

    const movePayload: Record<string, unknown> = {
      fromWarehouse: currentItem.Warehouse,
      fromLocation: vid,
      toWarehouse: currentItem.Warehouse,
      toLocation: currentItem.LocationFrom,
      employee: employeeCode,
      language: "en-US",
    };
    if (currentItem.HandlingUnit) {
      movePayload.handlingUnit = currentItem.HandlingUnit;
    } else {
      const rawQty = currentItem.OrderedQuantity;
      const qty =
        typeof rawQty === "number"
          ? rawQty
          : (typeof rawQty === "string" && rawQty.trim() ? Number(rawQty) : NaN);
      if (!currentItem.Item || Number.isNaN(qty)) {
        showError("Missing OrderedQuantity for item movement.");
        setMovingBackMap((m) => ({ ...m, [key]: false }));
        setMoveBackProcessing(false);
        return;
      }
      movePayload.item = currentItem.Item;
      movePayload.quantity = qty;
    }

    const tid = showLoading("Please wait…");
    const { data: moveData, error: moveErr } = await supabase.functions.invoke("ln-move-to-location", {
      body: movePayload,
    });
    if (moveBackRequestIdRef.current !== requestId) {
      dismissToast(tid as unknown as string);
      setMovingBackMap((m) => ({ ...m, [key]: false }));
      setMoveBackProcessing(false);
      return;
    }
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

    // Step 2: Clear VehicleID on the transport order
    const { data: patchData, error: patchErr } = await supabase.functions.invoke("ln-update-transport-order", {
      body: {
        transportId: currentItem.TransportID,
        runNumber: currentItem.RunNumber,
        etag: currentItem.ETag,
        vehicleId: "",
        language: "en-US",
        company: "1100",
      },
    });
    dismissToast(tid as unknown as string);
    if (moveBackRequestIdRef.current !== requestId) {
      setMovingBackMap((m) => ({ ...m, [key]: false }));
      setMoveBackProcessing(false);
      return;
    }
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

    // Refresh list and badge
    setListLoading(true);
    await fetchList(vid);
    await fetchCount(vid);
    setListLoading(false);
    setMovingBackMap((m) => ({ ...m, [key]: false }));
    setMoveBackProcessing(false);
  };

  // Ensure we read cached count immediately on mount and set up focus/visibility refresh
  useEffect(() => {
    // Read cached count right away regardless of dialog state
    const cached = Number(localStorage.getItem("transport.count") || "0");
    setLoadedCount(cached);

    // Prefill vehicleId (unchanged)
    (async () => {
      const gsiId = localStorage.getItem("gsi.id") || undefined;
      const username = localStorage.getItem("gsi.username") || undefined;
      const { data } = await supabase.functions.invoke("gsi-get-vehicle-id", {
        body: { gsi_id: gsiId, username },
      });
      if (data && data.ok && typeof data.vehicleId === "string" && data.vehicleId) {
        setVehicleId(data.vehicleId);
      } else {
        const stored = (localStorage.getItem("vehicle.id") || "").trim();
        if (stored) setVehicleId(stored);
      }

      // Dialog visibility control (unchanged)
      const fromMain = sessionStorage.getItem("transport.fromMain") === "1";
      if (fromMain) {
        setVehicleDialogOpen(true);
        sessionStorage.removeItem("transport.fromMain");
      }
    })();

    // Re-read cached count when window/tab regains focus or becomes visible
    const syncCachedCount = () => {
      const cachedNow = Number(localStorage.getItem("transport.count") || "0");
      setLoadedCount(cachedNow);
    };
    window.addEventListener("focus", syncCachedCount);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncCachedCount();
    });

    return () => {
      window.removeEventListener("focus", syncCachedCount);
      // No need to remove the anonymous listener; add a named wrapper if you prefer later
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton
            ariaLabel={trans.back}
            onClick={() => {
              sessionStorage.removeItem("transport.selected");
              navigate("/menu");
            }}
          />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.appTransport}</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4" />
              <span className="line-clamp-1">{fullName || ""}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-white/10"
            aria-label={trans.signOut}
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Grid of Transport tiles */}
      <div className="relative mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
            onClick={() => {
              if (tile.key === "load") {
                navigate("/menu/transport/load");
              }
              if (tile.key === "unload") {
                navigate("/menu/transport/unload");
              }
            }}
          >
            <div className="h-14 w-14 rounded-md border-2 border-red-700 flex items-center justify-center overflow-hidden">
              {tile.icon}
            </div>
            <div className="text-sm font-medium text-gray-700 text-center">{tile.label}</div>
          </Card>
        ))}
        {/* Center badge between tiles */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            className="bg-red-700 text-white rounded-md h-6 px-2 min-w-[24px] inline-flex items-center justify-center text-sm font-bold shadow focus:outline-none"
            onClick={async () => {
              const vid = (localStorage.getItem("vehicle.id") || "").trim();
              if (!vid) return;
              const willOpen = !listOpen;
              setListOpen(willOpen);
              if (willOpen) {
                setListLoading(true);
                await fetchList(vid);
                setListLoading(false);
              }
            }}
          >
            {loadedCount}
          </button>
        </div>
        {/* Overlay list dialog */}
        <Dialog open={listOpen} onOpenChange={setListOpen}>
          <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
            <div className="text-sm">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 border-b rounded-t-lg bg-black text-white">
                <div className="font-semibold">{trans.loadHandlingUnit}</div>
                <div className="font-semibold">{trans.locationFromLabel}</div>
                <div className="font-semibold">{trans.locationToLabel}</div>
                <div className="font-semibold text-right"> </div>
              </div>
              <div className="max-h-64 overflow-auto mt-0 space-y-2 px-2 py-2">
                {listItems.length === 0 ? (
                  <div className="text-xs text-muted-foreground px-1">{trans.noEntries}</div>
                ) : (
                  listItems.map((it, idx) => (
                    <div key={idx}>
                      <div className="rounded-md bg-gray-100/80 px-3 py-2 shadow-sm">
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 text-xs">
                          <div className="break-all">{it.HandlingUnit}</div>
                          <div className="break-all">{it.LocationFrom}</div>
                          <div className="break-all">{it.LocationTo}</div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              onClick={() => {
                                setConfirmItem(it);
                                setConfirmMoveBackOpen(true);
                              }}
                              disabled={moveBackProcessing || Boolean(movingBackMap[moveBackKey(it)])}
                              aria-label="Move back"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      {idx < listItems.length - 1 && (
                        <div className="h-px bg-gray-200/60 mx-1 my-2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Confirm Move Back dialog */}
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
        {/* Blocking spinner while list is loading */}
        {listLoading && <ScreenSpinner message={trans.loadingList} />}
        {moveBackProcessing && <ScreenSpinner message={trans.pleaseWait} />}
      </div>

      {/* Fahrzeug-ID selection dialog */}
      <Dialog
        open={vehicleDialogOpen}
        onOpenChange={(open) => {
          setVehicleDialogOpen(open);
          if (!open) {
            const selected = sessionStorage.getItem("transport.selected") === "1";
            // Require explicit confirmation via Select; if not selected, return to main menu
            if (!selected) {
              sessionStorage.removeItem("transport.selected");
              navigate("/menu");
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{trans.loadVehicleId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 relative">
            <FloatingLabelInput
              id="transportVehicleId"
              label={trans.loadVehicleId}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              autoFocus
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1 text-gray-700 hover:text-gray-900 h-8 w-8 flex items-center justify-center"
              aria-label="Search vehicles"
              onClick={async () => {
                const { data } = await supabase.functions.invoke("ln-vehicles-list", { body: {} });
                if (data && data.ok) {
                  setVehicleList(data.items || []);
                  setVehicleQuery("");
                } else {
                  setVehicleList([]);
                }
                setVehicleDropdownOpen((o) => !o);
              }}
            >
              <Search className="h-6 w-6" />
            </Button>

            {vehicleDropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2">
                <div className="space-y-2">
                  <Input
                    placeholder="Search vehicle…"
                    value={vehicleQuery}
                    onChange={(e) => setVehicleQuery(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="max-h-56 overflow-auto space-y-1">
                    {filteredVehicles.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-1">No vehicles</div>
                    ) : (
                      filteredVehicles.map((v, idx) => (
                        <button
                          key={`${v.VehicleID}-${idx}`}
                          type="button"
                          className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                          onClick={() => {
                            setVehicleId(v.VehicleID);
                            setVehicleDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm font-medium">{v.VehicleID}</div>
                          <div className="text-xs text-gray-600">{v.Description}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full h-10 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              disabled={!vehicleId.trim()}
              onClick={async () => {
                const vid = vehicleId.trim();
                if (!vid) return;
                localStorage.setItem("vehicle.id", vid);
                sessionStorage.setItem("transport.selected", "1");
                setVehicleDialogOpen(false);
                // Do NOT refresh count via REST here; use cached value
                const cached = Number(localStorage.getItem("transport.count") || "0");
                setLoadedCount(cached);
              }}
            >
              {trans.selectLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign-out confirmation dialog */}
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

export default TransportMenu;