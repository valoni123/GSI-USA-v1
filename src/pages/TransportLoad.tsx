import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, RotateCcw } from "lucide-react";
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
  const confirmHuRef = useRef<HTMLInputElement | null>(null);
  const lookupRequestIdRef = useRef(0);
  const loadRequestIdRef = useRef(0);
  const moveBackRequestIdRef = useRef(0);
  const lastLoadClickAtRef = useRef(0);
  const [handlingUnit, setHandlingUnit] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleEnabled, setVehicleEnabled] = useState<boolean>(false);
  const [confirmHandlingUnit, setConfirmHandlingUnit] = useState<string>("");
  const [result, setResult] = useState<{ TransportID?: string; RunNumber?: string; Item?: string; HandlingUnit?: string; Warehouse?: string; LocationFrom?: string; LocationTo?: string; ETag?: string; OrderedQuantity?: number | null } | null>(null);
  const [huQuantity, setHuQuantity] = useState<string>("");
  const [huUnit, setHuUnit] = useState<string>("");
  const [errorOpen, setErrorOpen] = useState<boolean>(false);
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
  type LoadedListItem = {
    HandlingUnit: string;
    LocationFrom: string;
    LocationTo: string;
    Warehouse: string;
    TransportID: string;
    RunNumber: string;
    ETag: string;
    OrderedQuantity?: number | string | null;
  };
  type ResolvedLoadData = {
    requestCode: string;
    result: NonNullable<typeof result>;
    etag: string;
    quantity: string;
    unit: string;
    matchType: "HU" | "ITEM";
  };
  const [listItems, setListItems] = useState<LoadedListItem[]>([]);
  const [movingBackMap, setMovingBackMap] = useState<Record<string, boolean>>({});
  const [moveBackProcessing, setMoveBackProcessing] = useState<boolean>(false);
  const [confirmMoveBackOpen, setConfirmMoveBackOpen] = useState<boolean>(false);
  const [confirmItem, setConfirmItem] = useState<LoadedListItem | null>(null);
  const [listLoading, setListLoading] = useState<boolean>(false);
  const [resolvedRequestCode, setResolvedRequestCode] = useState<string>("");
  const resolvedLoadRef = useRef<ResolvedLoadData | null>(null);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);
  const openedFromTransportsList = sessionStorage.getItem("transport.load.source") === "transports-list";

  const goBackFromLoad = () => {
    if (openedFromTransportsList) {
      sessionStorage.removeItem("transport.load.source");
      navigate("/menu/transports/list");
      return;
    }
    navigate("/menu/transport");
  };

  const clearResolvedLoad = () => {
    lookupRequestIdRef.current += 1;
    resolvedLoadRef.current = null;
    setResolvedRequestCode("");
  };

  const resetResolvedState = () => {
    clearResolvedLoad();
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
    setSelectOpen(false);
    setSelectItems([]);
    setConfirmHandlingUnit("");
  };

  useEffect(() => {
    if (!openedFromTransportsList) {
      huRef.current?.focus();
    }
  }, [openedFromTransportsList]);

  useEffect(() => {
    if (!openedFromTransportsList) return;
    const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
    if (!storedVehicle) return;
    setVehicleId(storedVehicle);
    setVehicleEnabled(true);
  }, [openedFromTransportsList]);

  useEffect(() => {
    const prefill = (sessionStorage.getItem("transport.load.prefill") || "").trim();
    if (!prefill) return;
    sessionStorage.removeItem("transport.load.prefill");
    setHandlingUnit(prefill);
    setPendingPrefill(prefill);
  }, []);

  useEffect(() => {
    if (!pendingPrefill) return;
    if (handlingUnit.trim() !== pendingPrefill.trim()) return;
    const timeoutId = window.setTimeout(() => {
      huRef.current?.focus();
      void onHUBlur();
      setPendingPrefill(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [pendingPrefill, handlingUnit]);

  useEffect(() => {
    if (!openedFromTransportsList || !result) return;
    const timeoutId = window.setTimeout(() => {
      confirmHuRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [openedFromTransportsList, result]);

  useEffect(() => {
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
      const items = Array.isArray(data.items)
        ? (data.items as any[]).map((v) => ({
            HandlingUnit: String(v?.HandlingUnit ?? ""),
            LocationFrom: String(v?.LocationFrom ?? ""),
            LocationTo: String(v?.LocationTo ?? ""),
            Warehouse: String(v?.Warehouse ?? ""),
            TransportID: String(v?.TransportID ?? ""),
            RunNumber: String(v?.RunNumber ?? ""),
            ETag: String(v?.ETag ?? ""),
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

  const moveBackKey = (it: LoadedListItem) => `${it.TransportID}::${it.RunNumber}::${it.HandlingUnit}`;

  const onMoveBack = async (it: LoadedListItem) => {
    const key = moveBackKey(it);
    if (movingBackMap[key] || moveBackProcessing) return;
    const requestId = ++moveBackRequestIdRef.current;
    const currentItem = {
      HandlingUnit: (it.HandlingUnit || "").trim(),
      Warehouse: (it.Warehouse || "").trim(),
      LocationFrom: (it.LocationFrom || "").trim(),
      TransportID: (it.TransportID || "").trim(),
      RunNumber: (it.RunNumber || "").trim(),
      ETag: (it.ETag || "").trim(),
    };
    setMovingBackMap((m) => ({ ...m, [key]: true }));
    setMoveBackProcessing(true);

    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();
    const vid = (localStorage.getItem("vehicle.id") || "").trim();
    if (!vid) {
      showError("No vehicle selected. Please set a Vehicle ID.");
      setMovingBackMap((m) => ({ ...m, [key]: false }));
      setMoveBackProcessing(false);
      return;
    }
    const tid = showLoading(trans.executingMovement);

    const { data: moveData, error: moveErr } = await supabase.functions.invoke("ln-move-to-location", {
      body: {
        handlingUnit: currentItem.HandlingUnit,
        fromWarehouse: currentItem.Warehouse,
        fromLocation: vid,
        toWarehouse: currentItem.Warehouse,
        toLocation: currentItem.LocationFrom,
        employee: employeeCode,
        language: locale,
      },
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

    const currentVehicle = (localStorage.getItem("vehicle.id") || "").trim();
    if (currentVehicle) {
      setListLoading(true);
      await fetchList(currentVehicle);
      setListLoading(false);
    } else {
      setListItems((items) => items.filter((row) => moveBackKey(row) !== key));
      setLoadedCount((n) => Math.max(0, n - 1));
      try { localStorage.setItem("transport.count", String(Math.max(0, (Number(localStorage.getItem("transport.count") || "1")) - 1))); } catch {}
    }
    setMovingBackMap((m) => ({ ...m, [key]: false }));
    setMoveBackProcessing(false);
  };

  const onHUBlur = async () => {
    const huRaw = handlingUnit;
    const requestCode = huRaw.trim();
    if (!requestCode) return;

    clearResolvedLoad();
    setLocationRequired(false);
    setLocationScan("");

    const shouldCheck = result === null || lastFetchedHu !== requestCode;
    if (!shouldCheck) return;

    const requestId = ++lookupRequestIdRef.current;
    const isLatestRequest = () => lookupRequestIdRef.current === requestId && handlingUnit.trim() === requestCode;

    const tid = showLoading(trans.checkingHandlingUnit);
    setDetailsLoading(true);
    const ordRes = await supabase.functions.invoke("ln-transport-orders", {
      body: { handlingUnit: huRaw, language: locale },
    });
    dismissToast(tid as unknown as string);

    if (!isLatestRequest()) {
      setDetailsLoading(false);
      return;
    }

    const ordData = ordRes.data;
    if (ordRes.error || !ordData || !ordData.ok || (ordData.count ?? 0) === 0) {
      setDetailsLoading(false);
      setErrorOpen(true);
      return;
    }

    const items = (ordData.items || []) as Array<{ TransportID: string; RunNumber: string; Item: string; HandlingUnit: string; Warehouse: string; LocationFrom: string; LocationTo: string; ETag: string; OrderedQuantity: number | null }>;
    const first = ordData.first as { TransportID?: string; RunNumber?: string; Item?: string; HandlingUnit?: string; Warehouse?: string; LocationFrom?: string; LocationTo?: string; ETag?: string; OrderedQuantity?: number | null } | null;

    if ((ordData.count ?? items.length ?? 0) > 1) {
      setSelectItems(items);
      setLastFetchedHu(requestCode);
      setSelectOpen(true);
      setDetailsLoading(false);
      return;
    }

    const nextResult = first || null;
    setResult(nextResult);
    setLastFetchedHu(requestCode);
    const etagValue = nextResult && typeof nextResult.ETag === "string" ? nextResult.ETag : "";
    setEtag(etagValue);

    const chosenHU = (nextResult?.HandlingUnit || "").trim();
    if (chosenHU) {
      setHuItemLabel("Handling Unit");
      const selectedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
      if (selectedVehicle) {
        const preTid = showLoading(trans.checkingHandlingUnit);
        const { data: loadedData } = await supabase.functions.invoke("ln-transport-loaded-check", {
          body: { handlingUnit: chosenHU, vehicleId: selectedVehicle, language: locale },
        });
        dismissToast(preTid as unknown as string);
        if (!isLatestRequest()) {
          setDetailsLoading(false);
          return;
        }
        if (loadedData && loadedData.ok && Number(loadedData.count || 0) > 0) {
          setLoadedErrorOpen(true);
          resetResolvedState();
          setHandlingUnit("");
          setDetailsLoading(false);
          setTimeout(() => huRef.current?.focus(), 50);
          return;
        }
      }
      const infoRes = await supabase.functions.invoke("ln-handling-unit-info", {
        body: { handlingUnit: chosenHU, language: locale },
      });
      if (!isLatestRequest()) {
        setDetailsLoading(false);
        return;
      }
      const qtyData = infoRes.data;
      const qty = qtyData && qtyData.ok ? String(qtyData.quantity ?? "") : "";
      const unit = qtyData && qtyData.ok ? String(qtyData.unit ?? "") : "";
      setHuQuantity(qty);
      setHuUnit(unit);
      setVehicleEnabled(true);
      const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
      if (storedVehicle) setVehicleId(storedVehicle);
      if (nextResult) {
        resolvedLoadRef.current = {
          requestCode,
          result: nextResult,
          etag: etagValue,
          quantity: qty,
          unit,
          matchType: "HU",
        };
        setResolvedRequestCode(requestCode);
      }
      setDetailsLoading(false);
      setTimeout(() => vehicleRef.current?.focus(), 50);
    } else {
      setHuItemLabel("Item");
      const qty = nextResult && typeof nextResult.OrderedQuantity === "number" ? String(nextResult.OrderedQuantity) : "";
      setHuQuantity(qty);
      setHuUnit("");
      setVehicleEnabled(false);
      setLocationRequired(true);
      if (nextResult) {
        resolvedLoadRef.current = {
          requestCode,
          result: nextResult,
          etag: etagValue,
          quantity: qty,
          unit: "",
          matchType: "ITEM",
        };
        setResolvedRequestCode(requestCode);
      }
      setDetailsLoading(false);
      setTimeout(() => locationRef.current?.focus(), 50);
    }
  };

  const onErrorConfirm = () => {
    setErrorOpen(false);
    resetResolvedState();
    setHandlingUnit("");
    setTimeout(() => huRef.current?.focus(), 50);
  };

  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  const sourceFlowIsItemOnly = openedFromTransportsList && result !== null && !(result?.HandlingUnit || "").trim();
  const expectedConfirmValue = openedFromTransportsList
    ? ((result?.HandlingUnit || "").trim() || (result?.LocationFrom || "").trim())
    : "";
  const confirmLabel = sourceFlowIsItemOnly ? trans.locationFromLabel : "Handling Unit";
  const scanMatchesTopValue =
    confirmHandlingUnit.trim() !== "" &&
    expectedConfirmValue !== "" &&
    confirmHandlingUnit.trim() === expectedConfirmValue;

  const canLoad =
    !detailsLoading &&
    vehicleId.trim().length > 0 &&
    Boolean(result) &&
    (!locationRequired || vehicleEnabled) &&
    (!openedFromTransportsList || scanMatchesTopValue);

  const onLoadClick = async () => {
    const now = Date.now();
    if (now - lastLoadClickAtRef.current < 250) return;
    lastLoadClickAtRef.current = now;

    if (processing || detailsLoading) return;
    const currentInput = handlingUnit.trim();
    const currentResolved =
      resolvedLoadRef.current && resolvedLoadRef.current.requestCode === currentInput
        ? resolvedLoadRef.current
        : result
          ? {
              requestCode: currentInput,
              result,
              etag,
              quantity: huQuantity,
              unit: huUnit,
              matchType: (result.HandlingUnit || "").trim() ? "HU" as const : "ITEM" as const,
            }
          : null;
    if (!currentResolved) {
      showError("Please wait until the current handling unit is fully resolved.");
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    setProcessing(true);

    const snapVehicleId = vehicleId.trim();
    const snapLocale = locale;
    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();

    // Re-resolve the current scanned code right before loading so a fast previous scan
    // can never leak old result/quantity data into the movement request.
    const verifyTid = showLoading(trans.checkingHandlingUnit);
    const { data: ordData, error: ordErr } = await supabase.functions.invoke("ln-transport-orders", {
      body: { handlingUnit: currentInput, language: snapLocale },
    });
    if (loadRequestIdRef.current !== requestId || handlingUnit.trim() !== currentInput) {
      dismissToast(verifyTid as unknown as string);
      setProcessing(false);
      return;
    }
    if (ordErr || !ordData || !ordData.ok || (ordData.count ?? 0) === 0) {
      dismissToast(verifyTid as unknown as string);
      showError(trans.huNotFound);
      setProcessing(false);
      return;
    }

    const orderItems = Array.isArray(ordData.items) ? ordData.items : [];
    const resolvedItem = orderItems.find((row: any) =>
      String(row?.TransportID ?? "") === String(currentResolved.result.TransportID ?? "") &&
      String(row?.RunNumber ?? "") === String(currentResolved.result.RunNumber ?? "")
    );
    const refreshedResult = (resolvedItem || ordData.first || null) as NonNullable<typeof result> | null;
    if (!refreshedResult) {
      dismissToast(verifyTid as unknown as string);
      showError(trans.huNotFound);
      setProcessing(false);
      return;
    }

    const refreshedMatchType: "HU" | "ITEM" = (refreshedResult.HandlingUnit || "").trim() ? "HU" : "ITEM";
    const refreshedEtag = typeof refreshedResult.ETag === "string" ? refreshedResult.ETag : "";
    let refreshedQuantity = "";
    let refreshedUnit = "";

    if (refreshedMatchType === "HU") {
      const resolvedHu = (refreshedResult.HandlingUnit || "").trim();
      const { data: huData, error: huErr } = await supabase.functions.invoke("ln-handling-unit-info", {
        body: { handlingUnit: resolvedHu, language: snapLocale },
      });
      if (loadRequestIdRef.current !== requestId || handlingUnit.trim() !== currentInput) {
        dismissToast(verifyTid as unknown as string);
        setProcessing(false);
        return;
      }
      if (huErr || !huData || !huData.ok) {
        dismissToast(verifyTid as unknown as string);
        showError(trans.huNotFound);
        setProcessing(false);
        return;
      }
      refreshedQuantity = String(huData.quantity ?? "");
      refreshedUnit = String(huData.unit ?? "");
    } else {
      refreshedQuantity = typeof refreshedResult.OrderedQuantity === "number" ? String(refreshedResult.OrderedQuantity) : "";
    }

    resolvedLoadRef.current = {
      requestCode: currentInput,
      result: refreshedResult,
      etag: refreshedEtag,
      quantity: refreshedQuantity,
      unit: refreshedUnit,
      matchType: refreshedMatchType,
    };
    setResolvedRequestCode(currentInput);
    setResult(refreshedResult);
    setEtag(refreshedEtag);
    setHuQuantity(refreshedQuantity);
    setHuUnit(refreshedUnit);
    dismissToast(verifyTid as unknown as string);

    const payload: Record<string, unknown> = {
      fromWarehouse: (refreshedResult.Warehouse || "").trim(),
      fromLocation: (refreshedResult.LocationFrom || "").trim(),
      toWarehouse: (refreshedResult.Warehouse || "").trim(),
      toLocation: snapVehicleId,
      employee: employeeCode,
      language: snapLocale,
    };
    if (refreshedMatchType === "HU") {
      payload.handlingUnit = (refreshedResult.HandlingUnit || "").trim();
    } else {
      payload.item = refreshedResult.Item || "";
      const qtyNum = Number(refreshedQuantity || "0");
      if (!Number.isNaN(qtyNum) && qtyNum > 0) {
        payload.quantity = qtyNum;
      }
    }
    const tid = showLoading(trans.executingMovement);
    const { data, error } = await supabase.functions.invoke("ln-move-to-location", { body: payload });
    dismissToast(tid as unknown as string);
    if (loadRequestIdRef.current !== requestId) {
      setProcessing(false);
      return;
    }
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

    const patchTid = showLoading(trans.updatingTransportOrder);
    const { data: patchData, error: patchErr } = await supabase.functions.invoke("ln-update-transport-order", {
      body: {
        transportId: (refreshedResult.TransportID || "").trim(),
        runNumber: (refreshedResult.RunNumber || "").trim(),
        etag: refreshedEtag,
        vehicleId: snapVehicleId,
        language: snapLocale,
        company: "1100",
      },
    });
    dismissToast(patchTid as unknown as string);
    if (loadRequestIdRef.current !== requestId) {
      setProcessing(false);
      return;
    }
    if (patchErr || !patchData || !patchData.ok) {
      const err = (patchData && patchData.error) || patchErr;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      setProcessing(false);
      return;
    }

    setHandlingUnit("");
    resetResolvedState();
    setTimeout(() => huRef.current?.focus(), 50);

    const selectedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
    if (selectedVehicle) {
      await fetchCount(selectedVehicle);
    }
    setProcessing(false);

    if (openedFromTransportsList) {
      sessionStorage.removeItem("transport.load.source");
      navigate("/menu/transports/list");
      return;
    }
  };

  const handleConfirmHandlingUnit = async () => {
    if (!openedFromTransportsList) return;
    if (processing || detailsLoading) return;

    const scanned = confirmHandlingUnit.trim();
    if (!scanned) return;
    if (scanned !== expectedConfirmValue) {
      showError(sourceFlowIsItemOnly ? "Scanned Location From does not match" : "Scanned Handling Unit does not match");
      setConfirmHandlingUnit("");
      setTimeout(() => confirmHuRef.current?.focus(), 50);
      return;
    }
    await onLoadClick();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={goBackFromLoad} />

          <div className="flex flex-col items-center flex-1">
            <div className="text-center flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => navigate("/menu/transport")}
                className="font-bold text-lg tracking-wide hover:opacity-80"
              >
                {trans.transportLoad}
              </button>
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
            disabled={processing}
            onChange={(e) => {
              const v = e.target.value;
              setHandlingUnit(v);
              const trimmed = v.trim();
              if (!trimmed) {
                resetResolvedState();
                return;
              }
              if (trimmed !== (lastFetchedHu || "")) {
                resetResolvedState();
              }
            }}
            onBlur={onHUBlur}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) {
                e.currentTarget.select();
              }
            }}
            readOnly={openedFromTransportsList}
          />
          {!openedFromTransportsList && locationRequired && (
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
            readOnly={openedFromTransportsList}
          />

          {openedFromTransportsList && sourceFlowIsItemOnly && (
            <FloatingLabelInput
              id="sourceLocationFrom"
              label={trans.locationFromLabel}
              value={result?.LocationFrom || ""}
              readOnly
            />
          )}

          {openedFromTransportsList && result && (
            <FloatingLabelInput
              id="confirmHandlingUnit"
              label={confirmLabel}
              ref={confirmHuRef}
              value={confirmHandlingUnit}
              disabled={processing}
              className="border-2 border-red-500 animate-pulse"
              onChange={(e) => setConfirmHandlingUnit(e.target.value)}
              onBlur={() => {
                void handleConfirmHandlingUnit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleConfirmHandlingUnit();
                }
              }}
            />
          )}
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
              canLoad && !processing
                ? "w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white"
                : "w-full h-12 text-base bg-gray-600 text-white disabled:opacity-100"
            }
            disabled={!canLoad || processing}
            onClick={onLoadClick}
          >
            {processing ? trans.executingMovement : trans.loadAction}
          </Button>
        </div>
      </div>

      {/* Blocking spinner while processing */}
      {detailsLoading && <ScreenSpinner message={trans.checkingHandlingUnit} />}
      {listLoading && <ScreenSpinner message={trans.loadingList} />}
      {processing && <ScreenSpinner message={trans.pleaseWait} />}
      {moveBackProcessing && <ScreenSpinner message={trans.pleaseWait} />}

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
                  <div key={`${it.TransportID}-${it.RunNumber}-${idx}`}>
                    <div className="rounded-md bg-gray-100/80 px-3 py-2 shadow-sm">
                      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center text-xs">
                        <div className="break-all">{it.HandlingUnit || "-"}</div>
                        <div className="break-all">{it.LocationFrom || "-"}</div>
                        <div className="break-all">{it.LocationTo || "-"}</div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center h-7 w-7 rounded-md border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50`}
                            onClick={() => {
                              setConfirmItem(it);
                              setConfirmMoveBackOpen(true);
                            }}
                            disabled={moveBackProcessing || Boolean(movingBackMap[`${it.TransportID}::${it.RunNumber}::${it.HandlingUnit}`])}
                            aria-label="Move back"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {idx < listItems.length - 1 && <div className="h-px bg-gray-200/60 mx-1 my-2" />}
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
                      const currentInput = handlingUnit.trim();
                      setSelectOpen(false);
                      const chosenHU = (it.HandlingUnit || "").trim();
                      const nextResult = {
                        TransportID: it.TransportID,
                        RunNumber: it.RunNumber,
                        Item: it.Item,
                        HandlingUnit: it.HandlingUnit,
                        Warehouse: it.Warehouse,
                        LocationFrom: it.LocationFrom,
                        LocationTo: it.LocationTo,
                        ETag: it.ETag,
                        OrderedQuantity: it.OrderedQuantity,
                      };
                      setResult(nextResult);
                      setLastFetchedHu(currentInput);
                      setEtag(it.ETag || "");
                      setHuItemLabel(chosenHU ? "Handling Unit" : "Item");
                      if (chosenHU) {
                        clearResolvedLoad();
                        const infoRes = await supabase.functions.invoke("ln-handling-unit-info", {
                          body: { handlingUnit: chosenHU, language: locale },
                        });
                        if (handlingUnit.trim() !== currentInput) {
                          return;
                        }
                        const qtyData = infoRes.data;
                        const qty = qtyData && qtyData.ok ? String(qtyData.quantity ?? "") : "";
                        const unit = qtyData && qtyData.ok ? String(qtyData.unit ?? "") : "";
                        setHuQuantity(qty);
                        setHuUnit(unit);
                        setVehicleEnabled(true);
                        const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
                        if (storedVehicle) setVehicleId(storedVehicle);
                        resolvedLoadRef.current = {
                          requestCode: currentInput,
                          result: nextResult,
                          etag: it.ETag || "",
                          quantity: qty,
                          unit,
                          matchType: "HU",
                        };
                        setResolvedRequestCode(currentInput);
                        setTimeout(() => vehicleRef.current?.focus(), 50);
                      } else {
                        const qty = typeof it.OrderedQuantity === "number" ? String(it.OrderedQuantity) : "";
                        setHuQuantity(qty);
                        setHuUnit("");
                        setVehicleEnabled(false);
                        setLocationRequired(true);
                        resolvedLoadRef.current = {
                          requestCode: currentInput,
                          result: nextResult,
                          etag: it.ETag || "",
                          quantity: qty,
                          unit: "",
                          matchType: "ITEM",
                        };
                        setResolvedRequestCode(currentInput);
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