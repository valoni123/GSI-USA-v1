import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import HelpMenu from "@/components/HelpMenu";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { dismissToast, showLoading, showSuccess, showError } from "@/utils/toast";
import { type LanguageKey, t } from "@/lib/i18n";
import ScreenSpinner from "@/components/ScreenSpinner";

const TransportLoad = () => {
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
      // Clear cached transport count to prevent stale value on next login
      localStorage.removeItem("transport.count");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const huRef = useRef<HTMLInputElement | null>(null);
  const locationRef = useRef<HTMLInputElement | null>(null);
  const vehicleRef = useRef<HTMLInputElement | null>(null);
  const [handlingUnit, setHandlingUnit] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleEnabled, setVehicleEnabled] = useState<boolean>(false);
  const [result, setResult] = useState<{ TransportID?: string; RunNumber?: string; Item?: string; HandlingUnit?: string; Warehouse?: string; LocationFrom?: string; LocationTo?: string; ETag?: string; OrderedQuantity?: number | null } | null>(null);
  // NEW: Quantity and Unit for the scanned Handling Unit
  const [huQuantity, setHuQuantity] = useState<string>("");
  const [huUnit, setHuUnit] = useState<string>("");
  const [errorOpen, setErrorOpen] = useState<boolean>(false);
  // NEW: dynamic label for first input
  const [huItemLabel, setHuItemLabel] = useState<string>("Handling Unit / Item");
  const [loadedErrorOpen, setLoadedErrorOpen] = useState<boolean>(false);
  const [lastFetchedHu, setLastFetchedHu] = useState<string | null>(null);
  const [etag, setEtag] = useState<string>("");
  const [selectOpen, setSelectOpen] = useState<boolean>(false);
  const [selectItems, setSelectItems] = useState<Array<{ TransportID: string; RunNumber: string; Item: string; HandlingUnit: string; Warehouse: string; LocationFrom: string; LocationTo: string; ETag: string; OrderedQuantity: number | null }>>([]);
  const [locationScan, setLocationScan] = useState<string>("");
  const [locationRequired, setLocationRequired] = useState<boolean>(false);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [listOpen, setListOpen] = useState<boolean>(false);
  const [listItems, setListItems] = useState<Array<{ HandlingUnit: string; LocationFrom: string; LocationTo: string }>>([]);
  const [listLoading, setListLoading] = useState<boolean>(false);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  useEffect(() => {
    // Focus the first field on mount
    huRef.current?.focus();
  }, []);

  useEffect(() => {
    // Initialize badge from localStorage, no REST call
    const cached = Number(localStorage.getItem("transport.count") || "0");
    setLoadedCount(cached);
  }, [locale]);

  useEffect(() => {
    let active = true;
    (async () => {
      const vehicleId = (localStorage.getItem("vehicle.id") || "").trim();
      if (!vehicleId) {
        setLoadedCount(0);
        return;
      }
      const { data } = await supabase.functions.invoke("ln-transport-count", {
        body: { vehicleId, language: locale, company: "1100" },
      });
      if (!active) return;
      setLoadedCount(data && data.ok ? Number(data.count || 0) : 0);
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  const fetchList = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-list", {
      body: { vehicleId: vid, language: locale, company: "1100" },
    });
    if (data && data.ok) {
      const items = (data.items || []) as Array<{ HandlingUnit: string; LocationFrom: string; LocationTo: string }>;
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

  const fetchCount = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId: vid, language: locale, company: "1100" },
    });
    const next = data && data.ok ? Number(data.count || 0) : 0;
    setLoadedCount(next);
    try {
      localStorage.setItem("transport.count", String(next));
    } catch {}
  };

  const onHUBlur = async () => {
    const huRaw = handlingUnit;
    if (!huRaw.trim()) return;

    setLocationRequired(false);
    setLocationScan("");

    // Only proceed if result is empty (first time) or HU changed
    const shouldCheck = result === null || lastFetchedHu !== huRaw;
    if (!shouldCheck) return;

    const tid = showLoading(trans.checkingHandlingUnit);
    setDetailsLoading(true);
    const ordRes = await supabase.functions.invoke("ln-transport-orders", {
      body: { handlingUnit: huRaw, language: locale },
    });
    dismissToast(tid as unknown as string);

    const ordData = ordRes.data;
    if (ordRes.error || !ordData || !ordData.ok || (ordData.count ?? 0) === 0) {
      setDetailsLoading(false);
      setErrorOpen(true);
      return;
    }

    const items = (ordData.items || []) as Array<{ TransportID: string; RunNumber: string; Item: string; HandlingUnit: string; Warehouse: string; LocationFrom: string; LocationTo: string; ETag: string; OrderedQuantity: number | null }>;
    const first = ordData.first as { TransportID?: string; RunNumber?: string; Item?: string; HandlingUnit?: string; Warehouse?: string; LocationFrom?: string; LocationTo?: string; ETag?: string; OrderedQuantity?: number | null } | null;

    // If multiple matches → open selection popup
    if ((ordData.count ?? items.length ?? 0) > 1) {
      setSelectItems(items);
      setSelectOpen(true);
      setDetailsLoading(false);
      return;
    }

    // Single match path
    setResult(first || null);
    const etagValue = (first && typeof first?.ETag === "string" ? first.ETag : "");
    setEtag(etagValue);

    // If HandlingUnit present → load HU info for qty/unit; else require Location scan
    const chosenHU = (first?.HandlingUnit || "").trim();
    if (chosenHU) {
      setHuItemLabel("Handling Unit");
      const selectedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
      if (selectedVehicle) {
        const preTid = showLoading(trans.checkingHandlingUnit);
        const { data: loadedData } = await supabase.functions.invoke("ln-transport-loaded-check", {
          body: { handlingUnit: chosenHU, vehicleId: selectedVehicle, language: locale },
        });
        dismissToast(preTid as unknown as string);
        if (loadedData && loadedData.ok && Number(loadedData.count || 0) > 0) {
          setLoadedErrorOpen(true);
          // Clear and reset
          setResult(null);
          setVehicleEnabled(false);
          setHandlingUnit("");
          setVehicleId("");
          setLastFetchedHu(null);
          setEtag("");
          setDetailsLoading(false);
          setTimeout(() => huRef.current?.focus(), 50);
          return;
        }
      }
      const infoRes = await supabase.functions.invoke("ln-handling-unit-info", {
        body: { handlingUnit: chosenHU, language: locale },
      });
      const qtyData = infoRes.data;
      const qty = qtyData && qtyData.ok ? String(qtyData.quantity ?? "") : "";
      const unit = qtyData && qtyData.ok ? String(qtyData.unit ?? "") : "";
      setHuQuantity(qty);
      setHuUnit(unit);
      setVehicleEnabled(true);
      const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
      if (storedVehicle) setVehicleId(storedVehicle);
      setLastFetchedHu(chosenHU);
      setDetailsLoading(false);
      setTimeout(() => vehicleRef.current?.focus(), 50);
    } else {
      // Item-only path
      setHuItemLabel("Item");
      // Item-only → Location required before proceeding
      setHuQuantity(first && typeof first.OrderedQuantity === "number" ? String(first.OrderedQuantity) : "");
      setHuUnit("");
      setVehicleEnabled(false);
      setLocationRequired(true);
      setDetailsLoading(false);
      setTimeout(() => locationRef.current?.focus(), 50);
    }
  };

  const onErrorConfirm = () => {
    setErrorOpen(false);
    setResult(null);
    setVehicleEnabled(false);
    setHandlingUnit("");
    setVehicleId("");
    setLastFetchedHu(null);
    setEtag("");
    // Refocus HU
    setTimeout(() => huRef.current?.focus(), 50);
  };

  const canLoad = vehicleEnabled && vehicleId.trim().length > 0;

  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  const onLoadClick = async () => {
    if (!canLoad || !result) return;
    setProcessing(true);
    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();
    // Build payload: HandlingUnit move OR Item move
    const isHU = (result?.HandlingUnit || "").trim().length > 0;
    const payload: Record<string, unknown> = {
      fromWarehouse: (result.Warehouse || "").trim(),
      fromLocation: (result.LocationFrom || "").trim(),
      toWarehouse: (result.Warehouse || "").trim(),
      toLocation: vehicleId.trim(),
      employee: employeeCode,
      language: locale,
    };
    if (isHU) {
      // Handling Unit move
      payload.handlingUnit = handlingUnit.trim();
    } else {
      // Item move: send Item as returned by LN (preserve leading spaces) and Quantity from OrderedQuantity
      payload.item = (result.Item || "");
      const qtyNum = Number((huQuantity || "").trim() || "0");
      if (!Number.isNaN(qtyNum) && qtyNum > 0) {
        payload.quantity = qtyNum;
      }
    }
    const tid = showLoading(trans.executingMovement);
    const { data, error } = await supabase.functions.invoke("ln-move-to-location", { body: payload });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      const err = (data && data.error) || error;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setProcessing(false);
      return;
    }
    showSuccess(trans.loadedSuccessfully);

    // PATCH Transport order to set VehicleID and LocationDevice = Fahrzeug-ID
    const patchTid = showLoading(trans.updatingTransportOrder);
    const { data: patchData, error: patchErr } = await supabase.functions.invoke("ln-update-transport-order", {
      body: {
        transportId: (result.TransportID || "").trim(),
        runNumber: (result.RunNumber || "").trim(),
        etag: etag.trim(),
        vehicleId: vehicleId.trim(),
        language: locale,
        company: "1100",
      },
    });
    dismissToast(patchTid as unknown as string);
    if (patchErr || !patchData || !patchData.ok) {
      const err = (patchData && patchData.error) || patchErr;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setProcessing(false);
      return;
    }

    // Clear form and reset after successful PATCH
    setHandlingUnit("");
    setVehicleId("");
    setResult(null);
    setVehicleEnabled(false);
    setLastFetchedHu(null);
    setEtag("");
    setHuQuantity("");
    setHuUnit("");
    setTimeout(() => huRef.current?.focus(), 50);

    // Refresh the loaded count badge
    const selectedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
    if (selectedVehicle) {
      await fetchCount(selectedVehicle);
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/transport")} />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center flex items-center gap-2 relative">
              <span>{trans.transportLoad}</span>
              <button
                type="button"
                className="bg-red-700 text-white rounded-md h-5 px-2 min-w-[20px] inline-flex items-center justify-center text-xs font-bold focus:outline-none"
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
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4" />
              <span className="line-clamp-1">{fullName || ""}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <HelpMenu topic="transport-load" />
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
      </div>

      {/* Form area */}
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <FloatingLabelInput
            id="handlingUnit"
            label={huItemLabel}
            autoFocus
            ref={huRef}
            value={handlingUnit}
            onChange={(e) => {
              const v = e.target.value;
              setHandlingUnit(v);
              if (v.trim() === "") {
                setResult(null);
                setVehicleEnabled(false);
                setVehicleId("");
                setLastFetchedHu(null);
                setEtag("");
                setHuQuantity("");
                setHuUnit("");
                setLocationRequired(false);
                setLocationScan("");
                setHuItemLabel("Handling Unit / Item");
              }
            }}
            onBlur={onHUBlur}
            onFocus={(e) => {
              // Select the full value when focusing the field
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              // If user clicks while focused, keep the full selection
              if (e.currentTarget.value.length > 0) {
                e.currentTarget.select();
              }
            }}
          />
          {locationRequired && (
            <FloatingLabelInput
              id="scanLocation"
              label={`${trans.locationFromLabel} *`}
              ref={locationRef}
              value={locationScan}
              onChange={(e) => setLocationScan(e.target.value)}
              onBlur={() => {
                const loc = (locationScan || "").trim();
                const expected = (result?.LocationFrom || "").trim();
                if (!loc || !expected) return;
                if (loc !== expected) {
                  showError("Scanned Location does not match Location From");
                  setLocationScan("");
                  setTimeout(() => locationRef.current?.focus(), 50);
                } else {
                  setVehicleEnabled(true);
                  const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
                  if (storedVehicle) setVehicleId(storedVehicle);
                  setTimeout(() => vehicleRef.current?.focus(), 50);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const loc = (locationScan || "").trim();
                  const expected = (result?.LocationFrom || "").trim();
                  if (!loc || !expected) return;
                  if (loc !== expected) {
                    showError("Scanned Location does not match Location From");
                    setLocationScan("");
                    setTimeout(() => locationRef.current?.focus(), 50);
                  } else {
                    setVehicleEnabled(true);
                    const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
                    if (storedVehicle) setVehicleId(storedVehicle);
                    setTimeout(() => vehicleRef.current?.focus(), 50);
                  }
                }
              }}
            />
          )}
          <FloatingLabelInput
            id="vehicleId"
            label={trans.loadVehicleId}
            ref={vehicleRef}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!vehicleEnabled}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
          />
          {/* Red result area */}
          <div className="mt-2 rounded-md min-h-28 p-3">
            {detailsLoading ? (
              <div className="text-muted-foreground text-sm">{trans.loadingDetails}</div>
            ) : result ? (
              <div className="text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 items-start">
                  <div className="font-semibold text-gray-700">{trans.transportIdLabel}:</div>
                  <div className="break-all text-gray-900">{result.TransportID ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.itemLabel}:</div>
                  <div className="break-all text-gray-900">{result.Item ?? "-"}</div>
                  <div className="font-semibold text-gray-700">Handling Unit:</div>
                  <div className="break-all text-gray-900">{(result.HandlingUnit || "").trim() || "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                  <div className="break-all text-gray-900">{result.Warehouse ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.locationFromLabel}:</div>
                  <div className="break-all text-gray-900">{result.LocationFrom ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.locationToLabel}:</div>
                  <div className="break-all text-gray-900">{result.LocationTo ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.quantityLabel}:</div>
                  <div className="break-all text-gray-900">
                    {huQuantity || "-"} {huUnit ? <span className="ml-2 text-gray-700">{huUnit}</span> : ""}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm"> </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            className={
              canLoad
                ? "w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white"
                : "w-full h-12 text-base bg-gray-600 text-white disabled:opacity-100"
            }
            disabled={!canLoad}
            onClick={onLoadClick}
          >
            {trans.loadAction}
          </Button>
        </div>
      </div>

      {/* Blocking spinner while processing */}
      {listLoading && <ScreenSpinner message={trans.loadingList} />}
      {processing && <ScreenSpinner message={trans.pleaseWait} />}

      {/* Error dialog: HU not found */}
      <AlertDialog open={errorOpen} onOpenChange={setErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{trans.huNotFound}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onErrorConfirm}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error dialog: HU already loaded */}
      <AlertDialog open={loadedErrorOpen} onOpenChange={setLoadedErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{trans.huAlreadyLoaded}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setLoadedErrorOpen(false);
                // Everything is already cleared in the blur handler; ensure focus on HU
                setTimeout(() => huRef.current?.focus(), 50);
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Overlay list dialog */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
          <div className="text-sm">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-b rounded-t-lg bg-black text-white">
              <div className="font-semibold">{trans.loadHandlingUnit}</div>
              <div className="font-semibold">{trans.locationFromLabel}</div>
              <div className="font-semibold">{trans.locationToLabel}</div>
            </div>
            <div className="max-h-64 overflow-auto mt-0 space-y-2 px-2 py-2">
              {listItems.length === 0 ? (
                <div className="text-xs text-muted-foreground px-1">{trans.noEntries}</div>
              ) : (
                listItems.map((it, idx) => (
                  <div key={idx}>
                    <div className="rounded-md bg-gray-100/80 px-3 py-2 shadow-sm">
                      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs">
                        <div className="break-all">{it.HandlingUnit}</div>
                        <div className="break-all">{it.LocationFrom}</div>
                        <div className="break-all">{it.LocationTo}</div>
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

      {/* Selection popup for multiple matches */}
      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
          <div className="text-sm">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-3 py-2 border-b rounded-t-lg bg-black text-white">
              <div className="font-semibold">Handling Unit</div>
              <div className="font-semibold">{trans.itemLabel}</div>
              <div className="font-semibold">{trans.locationFromLabel}</div>
              <div className="font-semibold">{trans.locationToLabel}</div>
            </div>
            <div className="max-h-64 overflow-auto mt-0 space-y-2 px-2 py-2">
              {selectItems.length === 0 ? (
                <div className="text-xs text-muted-foreground px-1">{trans.noEntries}</div>
              ) : (
                selectItems.map((it, idx) => (
                  <button
                    key={`${it.TransportID}-${idx}`}
                    type="button"
                    className="w-full text-left"
                    onClick={async () => {
                      setSelectOpen(false);
                      const chosenHU = (it.HandlingUnit || "").trim();
                      setResult({
                        TransportID: it.TransportID,
                        RunNumber: it.RunNumber,
                        Item: it.Item,
                        HandlingUnit: it.HandlingUnit,
                        Warehouse: it.Warehouse,
                        LocationFrom: it.LocationFrom,
                        LocationTo: it.LocationTo,
                        ETag: it.ETag,
                        OrderedQuantity: it.OrderedQuantity,
                      });
                      setEtag(it.ETag || "");
                      // Update dynamic label based on presence of Handling Unit in the selected row
                      setHuItemLabel(chosenHU ? "Handling Unit" : "Item");
                      if (chosenHU) {
                        const infoRes = await supabase.functions.invoke("ln-handling-unit-info", {
                          body: { handlingUnit: chosenHU, language: locale },
                        });
                        const qtyData = infoRes.data;
                        const qty = qtyData && qtyData.ok ? String(qtyData.quantity ?? "") : "";
                        const unit = qtyData && qtyData.ok ? String(qtyData.unit ?? "") : "";
                        setHuQuantity(qty);
                        setHuUnit(unit);
                        setVehicleEnabled(true);
                        const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
                        if (storedVehicle) setVehicleId(storedVehicle);
                        setTimeout(() => vehicleRef.current?.focus(), 50);
                      } else {
                        setHuQuantity(typeof it.OrderedQuantity === "number" ? String(it.OrderedQuantity) : "");
                        setHuUnit("");
                        setVehicleEnabled(false);
                        setLocationRequired(true);
                        setTimeout(() => locationRef.current?.focus(), 50);
                      }
                    }}
                  >
                    <div className="rounded-md bg-gray-100/80 px-3 py-2 shadow-sm">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 text-xs">
                        <div className="break-all">{it.HandlingUnit || "-"}</div>
                        <div className="break-all">{it.Item || "-"}</div>
                        <div className="break-all">{it.LocationFrom || "-"}</div>
                        <div className="break-all">{it.LocationTo || "-"}</div>
                      </div>
                    </div>
                    {idx < selectItems.length - 1 && (
                      <div className="h-px bg-gray-200/60 mx-1 my-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportLoad;