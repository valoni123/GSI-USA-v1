import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Search, User, CheckSquare, Square } from "lucide-react";
import LocationPickerDialog from "@/components/LocationPickerDialog";
import ScreenSpinner from "@/components/ScreenSpinner";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showError, showLoading, dismissToast, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const InfoStockTransfer = () => {
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
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const huRef = useRef<HTMLInputElement | null>(null);
  const warehouseRef = useRef<HTMLInputElement | null>(null);
  const targetWhRef = useRef<HTMLInputElement | null>(null);
  const targetLocRef = useRef<HTMLInputElement | null>(null);
  const fromLocRef = useRef<HTMLInputElement | null>(null);

  // First input + dynamic label/description
  const [query, setQuery] = useState<string>("");
  const [lastSearched, setLastSearched] = useState<string | null>(null);
  const [queryLabel, setQueryLabel] = useState<string>(() => t(lang).itemOrHandlingUnit);
  const [itemDescription, setItemDescription] = useState<string>("");

  // Result fields
  const [warehouse, setWarehouse] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [item, setItem] = useState<string>("");
  const [handlingUnit, setHandlingUnit] = useState<string>("");
  const [lot, setLot] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  // Enablement and visibility
  const [warehouseEnabled, setWarehouseEnabled] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [lastMatchType, setLastMatchType] = useState<"HU" | "ITEM" | null>(null);

  // Target fields
  const [targetWarehouse, setTargetWarehouse] = useState<string>("");
  const [targetLocation, setTargetLocation] = useState<string>("");
  // Track last validated values to avoid unnecessary service calls
  const [lastValidatedTargetWarehouse, setLastValidatedTargetWarehouse] = useState<string | null>(null);
  const [lastValidatedTargetLocation, setLastValidatedTargetLocation] = useState<string | null>(null);
  const [lastLocValidatedForWarehouse, setLastLocValidatedForWarehouse] = useState<string | null>(null);

  // Warehouse picker state (for item scan)
  const [warehousePickerOpen, setWarehousePickerOpen] = useState<boolean>(false);
  const [whLoading, setWhLoading] = useState<boolean>(false);
  const [whRows, setWhRows] = useState<
    Array<{ Warehouse: string; WarehouseName?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>
  >([]);

  // Target warehouse picker state
  const [targetWhPickerOpen, setTargetWhPickerOpen] = useState<boolean>(false);
  const [targetWhLoading, setTargetWhLoading] = useState<boolean>(false);
  const [targetWhRows, setTargetWhRows] = useState<Array<{ Warehouse: string; Description?: string; Type?: string }>>([]);

  // From-Location picker (ITEM flow)
  const [fromLocPickerOpen, setFromLocPickerOpen] = useState<boolean>(false);
  const [fromLocLoading, setFromLocLoading] = useState<boolean>(false);
  const [fromLocRows, setFromLocRows] = useState<Array<{ Location: string; OnHand: number; Allocated?: number; Available?: number; Lot?: string | null }>>([]);

  // Robuster Fokus ins obere Location-Feld (ITEM-Flow)
  const focusFromLocation = () => {
    const focus = () => {
      const el = fromLocRef.current || (document.getElementById("transferLocation") as HTMLInputElement | null);
      el?.focus();
    };
    focus();
    requestAnimationFrame(focus);
    const t1 = window.setTimeout(focus, 50);
    const t2 = window.setTimeout(focus, 200);
    const t3 = window.setTimeout(focus, 500);
    window.setTimeout(() => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    }, 600);
  };

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  // Enrich description for HUs by fetching item details (for the description box)
  const fetchItemDescription = async (itm?: string | null) => {
    const code = (itm || "").toString().trim();
    if (!code) {
      setItemDescription("");
      return;
    }
    const { data, error } = await supabase.functions.invoke("ln-item-info", {
      body: { item: code, language: locale, company: "1100" },
    });
    if (!error && data && data.ok) {
      setItemDescription((data.description || "").toString());
    }
  };

  useEffect(() => {
    huRef.current?.focus();
  }, []);

  // Searching flags (used in canTransfer)
  const [searching, setSearching] = useState<boolean>(false);
  const [checkingTargetLocation, setCheckingTargetLocation] = useState<boolean>(false);
  const [transferring, setTransferring] = useState<boolean>(false);

  const [focusTargetLocTick, setFocusTargetLocTick] = useState(0);
  useEffect(() => {
    if (!targetWarehouse.trim()) return;

    const focus = () => {
      const el =
        targetLocRef.current ||
        (document.getElementById("targetLocation") as HTMLInputElement | null);
      el?.focus();
    };

    // Try a few times to survive re-renders / overlay timing.
    focus();
    requestAnimationFrame(focus);
    const t1 = window.setTimeout(focus, 50);
    const t2 = window.setTimeout(focus, 200);
    const t3 = window.setTimeout(focus, 500);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [focusTargetLocTick, targetWarehouse]);

  // Status helpers
  const normalizeStatus = (raw?: string | null): string | null => {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (["im bestand", "instock", "in stock"].includes(s)) return "instock";
    if (["staged", "zum versand bereit", "bereit zum versand", "ready to ship"].includes(s)) return "staged";
    if (["tobeinspected", "toinspect", "zu prüfen", "zu pruefen", "to be inspected", "to inspect", "inspection"].includes(s)) return "tobeinspected";
    if (["intransit", "in transit"].includes(s)) return "intransit";
    if (["shipped", "versendet"].includes(s)) return "shipped";
    if (["blocked", "gesperrt"].includes(s)) return "blocked";
    if (["quarantine", "quarantaene", "quarantäne"].includes(s)) return "quarantine";
    if (["close", "geschlossen", "closed"].includes(s)) return "close";
    return s;
  };
  const statusLabel = (key: string | null) => {
    if (!key) return "-";
    switch (key) {
      case "instock":
        return lang === "de" ? "Im Bestand" : lang === "es-MX" ? "En inventario" : lang === "pt-BR" ? "Em estoque" : "In Stock";
      case "staged":
        return lang === "de" ? "Zum Versand Bereit" : lang === "es-MX" ? "Preparado para envío" : lang === "pt-BR" ? "Pronto para envio" : "Staged";
      case "tobeinspected":
        return lang === "de" ? "Zu prüfen" : lang === "es-MX" ? "Por inspeccionar" : lang === "pt-BR" ? "A inspecionar" : "To be inspected";
      case "intransit":
        return lang === "de" ? "Unterwegs" : lang === "es-MX" ? "En tránsito" : lang === "pt-BR" ? "Em trânsito" : "In Transit";
      case "shipped":
        return lang === "de" ? "Versendet" : lang === "es-MX" ? "Enviado" : lang === "pt-BR" ? "Enviado" : "Shipped";
      case "blocked":
      case "quarantine":
        return lang === "de" ? "Gesperrt / Quarantäne" : lang === "es-MX" ? "Bloqueado / Cuarentena" : lang === "pt-BR" ? "Bloqueado / Quarentena" : "Blocked / Quarantine";
      case "close":
        return lang === "de" ? "Geschlossen" : lang === "es-MX" ? "Cerrado" : lang === "pt-BR" ? "Fechado" : "Closed";
      default:
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  };
  const statusStyle = (key: string | null) => {
    if (!key) return "bg-gray-200 text-gray-800";
    switch (key) {
      case "instock":
        return "bg-[#78d8a3] text-black";
      case "staged":
        return "bg-[#fcc888] text-black";
      case "tobeinspected":
        return "bg-[#a876eb] text-white";
      case "intransit":
        return "bg-[#55a3f3] text-black";
      case "shipped":
        return "bg-[#8e8e95] text-white";
      case "blocked":
      case "quarantine":
        return "bg-[#e66467] text-white";
      case "close":
        return "bg-[#28282a] text-white";
      default:
        return "bg-gray-300 text-black";
    }
  };

  // Enable TRANSFER only when everything required is filled
  const canTransfer = useMemo(() => {
    if (!showDetails) return false;
    const qtyOk = Number(quantity) > 0;
    const unitOk = (unit || "").trim().length > 0;
    const tgtWh = (targetWarehouse || "").trim();
    const tgtLoc = (targetLocation || "").trim();
    // Target location must be validated (not just filled)
    const targetLocValid =
      !!tgtWh &&
      !!tgtLoc &&
      (lastValidatedTargetLocation || "").toLowerCase() === tgtLoc.toLowerCase() &&
      (lastLocValidatedForWarehouse || "").toLowerCase() === tgtWh.toLowerCase();
    // Must be different from current Location
    const locDifferent = (location || "").trim().toLowerCase() !== tgtLoc.toLowerCase();

    if (lastMatchType === "HU") {
      const baseOk = (warehouse || "").trim() && (location || "").trim();
      return !!(baseOk && qtyOk && unitOk && targetLocValid && locDifferent) && !searching && !checkingTargetLocation && !transferring;
    }
    // ITEM
    const baseOk = (warehouse || "").trim();
    return !!(baseOk && qtyOk && unitOk && targetLocValid && locDifferent) && !searching && !checkingTargetLocation && !transferring;
  }, [
    showDetails,
    lastMatchType,
    warehouse,
    location,
    quantity,
    unit,
    targetWarehouse,
    targetLocation,
    lastValidatedTargetLocation,
    lastLocValidatedForWarehouse,
    searching,
    checkingTargetLocation,
    transferring,
  ]);

  const handleSearch = async (_withLoading = false) => {
    const input = query.trim();
    if (!input) return;
    if (lastSearched === input) return;

    setSearching(true);

    // Try Handling Unit
    const huRes = await supabase.functions.invoke("ln-handling-unit-info", {
      body: { handlingUnit: input, language: locale, company: "1100" },
    });
    if (huRes.data && huRes.data.ok) {
      const d = huRes.data;
      setItem(d.item || "");
      setHandlingUnit((d.handlingUnit || input).toString());
      setWarehouse(d.warehouse || "");
      setTargetWarehouse(d.warehouse || "");
      setLocation(d.location || "");
      setLot(d.lot || "");
      const qty = d.quantity != null ? String(d.quantity) : "";
      setQuantity(qty);
      setUnit((d.unit || "").toString());
      setStatus(d.status || "");
      setWarehouseEnabled(false);
      setLastSearched(input);
      setShowDetails(true);
      setQueryLabel(trans.loadHandlingUnit);
      setLastMatchType("HU");
      await fetchItemDescription(d.item);
      setSearching(false);
      return;
    }

    // Try Item
    const itemRes = await supabase.functions.invoke("ln-item-info", {
      body: { item: input, language: locale, company: "1100" },
    });
    if (itemRes.data && itemRes.data.ok) {
      const d = itemRes.data;
      setItem(d.item || input);
      setHandlingUnit("");
      setUnit((d.unit || "").toString());
      setWarehouseEnabled(true);
      setLastSearched(input);
      setWarehouse("");
      setTargetWarehouse("");
      setLocation("");
      setLot("");
      setQuantity("");
      setStatus("");
      setShowDetails(true);
      setQueryLabel(trans.itemLabel);
      setLastMatchType("ITEM");
      setItemDescription((d.description || "").toString());
      setTimeout(() => warehouseRef.current?.focus(), 50);
      setSearching(false);
      return;
    }

    showError(trans.noEntries);
    setSearching(false);
  };

  // Open and load warehouses for current item (picker)
  const openWarehousePicker = async () => {
    const itm = (item || "").trim();
    if (!itm) {
      showError("Scan item first");
      return;
    }
    setWarehousePickerOpen(true);
    setWhLoading(true);
    const { data, error } = await supabase.functions.invoke("ln-item-inventory-by-warehouse", {
      body: { item: itm, language: locale, company: "1100" },
    });
    if (error || !data || !data.ok) {
      setWhRows([]);
      setWhLoading(false);
      showError(trans.loadingList);
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const mapped = rows
      .map((r: any) => ({
        Warehouse: String(r.Warehouse || ""),
        WarehouseName: typeof r.WarehouseName === "string" ? r.WarehouseName : undefined,
        Unit: typeof r.Unit === "string" ? r.Unit : undefined,
        OnHand: Number(r.OnHand ?? 0),
        Allocated: Number(r.Allocated ?? 0),
        Available: Number(r.Available ?? 0),
      }))
      .filter((r) => r.Warehouse);
    setWhRows(mapped);
    setWhLoading(false);
  };

  // Open From-Location picker for ITEM flow
  const openFromLocationPicker = async () => {
    if (lastMatchType !== "ITEM") return;
    const itm = (item || "").trim();
    const wh = (warehouse || "").trim();
    if (!itm || !wh) {
      showError(lang === "de" ? "Bitte zuerst Artikel und Lager setzen" : "Scan item and warehouse first");
      return;
    }
    setFromLocPickerOpen(true);
    setFromLocLoading(true);
    const { data, error } = await supabase.functions.invoke("ln-stockpoint-inventory", {
      body: { item: itm, warehouse: wh, language: locale, company: "1100" },
    });
    if (error || !data || !data.ok) {
      setFromLocRows([]);
      setFromLocLoading(false);
      showError(trans.loadingList);
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const mapped = rows
      .map((r: any) => ({
        Location: String(r.Location || r.LocationCode || r.StockPoint || ""),
        OnHand: Number(r.OnHand ?? r.Quantity ?? 0),
        Allocated: typeof r.Allocated === "number" ? r.Allocated : undefined,
        Available: typeof r.Available === "number" ? r.Available : undefined,
        Lot: typeof r.Lot === "string" ? r.Lot : null,
        Unit: typeof r.Unit === "string" ? r.Unit : undefined,
      }))
      .filter((r) => r.Location);
    setFromLocRows(mapped);
    setFromLocLoading(false);
  };

  // Target warehouses
  const openTargetWarehousePicker = async () => {
    setTargetWhPickerOpen(true);
    setTargetWhLoading(true);
    const { data, error } = await supabase.functions.invoke("ln-warehouses-list", {
      body: { language: locale, company: "1100" },
    });
    if (error || !data || !data.ok) {
      setTargetWhRows([]);
      setTargetWhLoading(false);
      showError(trans.loadingList);
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const mapped = rows
      .map((r: any) => ({
        Warehouse: String(r.Warehouse || ""),
        Description: typeof r.Description === "string" ? r.Description : undefined,
        Type: typeof r.Type === "string" ? r.Type : undefined,
      }))
      .filter((r) => r.Warehouse);
    setTargetWhRows(mapped);
    setTargetWhLoading(false);
  };

  const validateTargetWarehouse = async () => {
    const wh = (targetWarehouse || "").trim();
    if (!wh) return;
    if ((lastValidatedTargetWarehouse || "").toLowerCase() === wh.toLowerCase()) return;

    setCheckingTargetLocation(true);
    const { data, error } = await supabase.functions.invoke("ln-warehouse-location-exists", {
      body: { warehouse: wh, location: "*", language: locale, company: "1100" },
    });
    setCheckingTargetLocation(false);

    if (error || !data || !data.ok || data.exists !== true) {
      showError(trans.noEntries);
      setLastValidatedTargetWarehouse(null);
      return;
    }

    setLastValidatedTargetWarehouse(wh);
  };

  const validateTargetLocation = async () => {
    const wh = (targetWarehouse || "").trim();
    const loc = (targetLocation || "").trim();
    if (!wh || !loc) return;

    // Must be different from current Location
    if ((location || "").trim().toLowerCase() === loc.toLowerCase()) {
      showError(lang === "de" ? "Target Location darf nicht gleich Location sein" : "Target Location must differ from Location");
      setTargetLocation("");
      setLastValidatedTargetLocation(null);
      setLastLocValidatedForWarehouse(null);
      // Defer the focus tick so it runs after the blur/click sequence completes.
      window.setTimeout(() => setFocusTargetLocTick((v) => v + 1), 0);
      return;
    }

    if (
      (lastValidatedTargetLocation || "").toLowerCase() === loc.toLowerCase() &&
      (lastLocValidatedForWarehouse || "").toLowerCase() === wh.toLowerCase()
    ) {
      return;
    }

    setCheckingTargetLocation(true);
    const { data, error } = await supabase.functions.invoke("ln-warehouse-location-exists", {
      body: { warehouse: wh, location: loc, language: locale, company: "1100" },
    });
    setCheckingTargetLocation(false);

    if (!error && data && data.ok && data.exists === false) {
      showError("location not found");
      setTargetLocation("");
      setLastValidatedTargetLocation(null);
      setLastLocValidatedForWarehouse(null);
      setFocusTargetLocTick((v) => v + 1);
      return;
    }

    if (error || !data || !data.ok || data.exists !== true) {
      showError(trans.noEntries);
      setTargetLocation("");
      setLastValidatedTargetLocation(null);
      setLastLocValidatedForWarehouse(null);
      setFocusTargetLocTick((v) => v + 1);
      return;
    }

    setLastValidatedTargetLocation(loc);
    setLastLocValidatedForWarehouse(wh);
  };

  const resetAll = () => {
    setQuery("");
    setLastSearched(null);
    setItem("");
    setHandlingUnit("");
    setWarehouse("");
    setLocation("");
    setLot("");
    setQuantity("");
    setUnit("");
    setStatus("");
    setWarehouseEnabled(false);
    setShowDetails(false);
    setItemDescription("");
    setQueryLabel(trans.itemOrHandlingUnit);
    setLastMatchType(null);
    setTargetWarehouse("");
    setTargetLocation("");
    setLastValidatedTargetWarehouse(null);
    setLastValidatedTargetLocation(null);
    setLastLocValidatedForWarehouse(null);
    setWhRows([]);
    setWarehousePickerOpen(false);
    setTargetWhRows([]);
    setTargetWhPickerOpen(false);
    huRef.current?.focus();
  };

  const doTransfer = async () => {
    if (!canTransfer) return;
    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();

    const loginCode = (localStorage.getItem("gsi.login") || employeeCode).trim();

    const isHU = lastMatchType === "HU" && (handlingUnit || "").trim().length > 0;

    setTransferring(true);
    const tid = showLoading(trans.pleaseWait);

    // LN expects these (German) field names for txgsi.apiTRANSFER/GSITransfers
    const payload: Record<string, unknown> = {
      TransferID: "",
      VonLager: (warehouse || "").trim(),
      VonLagerplatz: (location || "").trim(),
      InLager: (targetWarehouse || "").trim(),
      AufLagerplatz: (targetLocation || "").trim(),
      Menge: Number((quantity || "").trim() || "0"),
      LoginCode: loginCode || employeeCode,
      Mitarbeiter: employeeCode,
      FromWebserver: "Yes",
      language: locale,
      company: "1100",
    };

    if (isHU) {
      payload.Ladeeinheit = (handlingUnit || query || "").trim();
    } else {
      // Item transfer is not supported by this LN endpoint; keep previous behavior by sending the item as Ladeeinheit
      // only if the app was used that way.
      payload.Ladeeinheit = (item || "").trim();
    }

    const { data, error } = await supabase.functions.invoke("ln-transfer-handling-unit", {
      body: payload,
    });

    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      const msg = (data && (data.error?.message || data.error)) || "Transfer failed";
      showError(typeof msg === "string" ? msg : "Transfer failed");
      setTransferring(false);
      return;
    }
    setTransferring(false);
    showSuccess("Transfer completed");
    resetAll();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/info-stock")} />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.infoStockTransfer.toUpperCase()}</div>
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

      {/* Form */}
      <div className="mx-auto max-w-md px-4 py-6 pb-6">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          {/* Search row */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FloatingLabelInput
                id="transferQuery"
                label={queryLabel}
                ref={huRef}
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  setLastSearched(null);
                  if (showDetails) setShowDetails(false);
                  setItemDescription("");
                  setQueryLabel(trans.itemOrHandlingUnit);
                  setLastMatchType(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSearch(true);
                  }
                }}
                onBlur={() => {
                  if (query.trim()) {
                    void handleSearch(true);
                  }
                }}
                onFocus={(e) => {
                  if (e.currentTarget.value.length > 0) e.currentTarget.select();
                }}
                onClick={(e) => {
                  if (e.currentTarget.value.length > 0) e.currentTarget.select();
                }}
                onClear={() => {
                  setQuery("");
                  setLastSearched(null);
                  setItem("");
                  setWarehouse("");
                  setLocation("");
                  setLot("");
                  setQuantity("");
                  setStatus("");
                  setWarehouseEnabled(false);
                  setShowDetails(false);
                  setItemDescription("");
                  setQueryLabel(trans.itemOrHandlingUnit);
                  setLastMatchType(null);
                  setTargetWarehouse("");
                  setTargetLocation("");
                  setUnit("");
                  huRef.current?.focus();
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={query.trim() ? "h-10 w-10 bg-red-600 hover:bg-red-700 text-white" : "h-10 w-10 text-gray-700 hover:text-gray-900"}
              aria-label={trans.searchLabel}
              onClick={() => handleSearch(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>

          {/* Description + Status chip (HU only). Pad right to align with input's search icon width */}
          {showDetails && itemDescription && (
            <div className="mt-2">
              <div className="flex items-center justify-between pr-12">
                <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-800 px-3 py-1 text-xs font-semibold">
                  Description
                </span>
                {lastMatchType === "HU" && (status || "").trim() && (
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${statusStyle(normalizeStatus(status))}`}>
                    {statusLabel(normalizeStatus(status))}
                  </span>
                )}
              </div>
              <div className="mt-1 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-900">
                {lastMatchType === "HU" && (item || "").trim()
                  ? `${(item || "").trim()} - ${itemDescription}`
                  : itemDescription}
              </div>
            </div>
          )}

          {/* Stacked fields (visible only after a successful search) */}
          {showDetails && (
            <div className="space-y-3">
              {/* Warehouse (item-only search icon) */}
              <div className="relative">
                <FloatingLabelInput
                  id="transferWarehouse"
                  label={trans.warehouseLabel}
                  ref={warehouseRef}
                  value={warehouse}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWarehouse(v);
                    if (!targetWarehouse) setTargetWarehouse(v);
                  }}
                  disabled={!warehouseEnabled}
                  className="pr-12"
                  onFocus={(e) => {
                    if (e.currentTarget.value.length > 0) e.currentTarget.select();
                  }}
                  onClick={(e) => {
                    if (e.currentTarget.value.length > 0) e.currentTarget.select();
                  }}
                  onBlur={() => {
                    // Nach Warehouse-Eingabe im ITEM-Flow → Fokus ins Location-Feld
                    if (lastMatchType === "ITEM" && (warehouse || "").trim()) {
                      focusFromLocation();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && lastMatchType === "ITEM" && (warehouse || "").trim()) {
                      e.preventDefault();
                      focusFromLocation();
                    }
                  }}
                  onClear={() => setWarehouse("")}
                />
                {lastMatchType !== "HU" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10"
                    onClick={openWarehousePicker}
                    disabled={!warehouseEnabled}
                    aria-label={trans.searchLabel}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Location (from) — editable for ITEM flow, with picker */}
              <div className="relative">
                <FloatingLabelInput
                  id="transferLocation"
                  label={trans.locationLabel}
                  ref={fromLocRef}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={lastMatchType === "HU"}
                  className={`${lastMatchType === "HU" ? "bg-gray-100 text-gray-700" : ""} pr-12`}
                />
                {lastMatchType === "ITEM" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10"
                    onClick={openFromLocationPicker}
                    aria-label={trans.searchLabel}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Quantity + Unit (unit read-only) */}
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <FloatingLabelInput
                  id="transferQuantity"
                  label={trans.quantityLabel}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="decimal"
                />
                <FloatingLabelInput id="transferUnit" label={trans.unitLabel} value={unit} disabled />
              </div>

              {/* Target Warehouse with picker */}
              <div className="relative">
                <FloatingLabelInput
                  id="targetWarehouse"
                  label={trans.targetWarehouseLabel}
                  value={targetWarehouse}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTargetWarehouse(v);
                    // Value changed → clear last validated
                    if (v.toLowerCase() !== (lastValidatedTargetWarehouse || "").toLowerCase()) {
                      setLastValidatedTargetWarehouse(null);
                    }
                    // Warehouse changed → clear validated location (bound to old WH)
                    if (v.toLowerCase() !== (lastLocValidatedForWarehouse || "").toLowerCase()) {
                      setLastValidatedTargetLocation(null);
                      setLastLocValidatedForWarehouse(null);
                    }
                  }}
                  className="pr-12"
                  ref={targetWhRef}
                  onBlur={() => {
                    void validateTargetWarehouse();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void validateTargetWarehouse();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10"
                  onClick={openTargetWarehousePicker}
                  aria-label={trans.searchLabel}
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>

              {/* Target Location: only visible after Target Warehouse set; no picker, inline validation */}
              {!!targetWarehouse.trim() && (
                <FloatingLabelInput
                  id="targetLocation"
                  label={trans.targetLocationLabel}
                  value={targetLocation}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTargetLocation(v);
                    // Value changed → clear last validated
                    if (v.toLowerCase() !== (lastValidatedTargetLocation || "").toLowerCase()) {
                      setLastValidatedTargetLocation(null);
                    }
                  }}
                  ref={targetLocRef}
                  onBlur={() => {
                    void validateTargetLocation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void validateTargetLocation();
                  }}
                />
              )}

              {/* Transfer button */}
              <Button
                type="button"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={!canTransfer}
                onClick={doTransfer}
              >
                TRANSFER
              </Button>
            </div>
          )}

          {(searching || checkingTargetLocation || transferring) && <ScreenSpinner message={trans.pleaseWait} />}

          {/* Item warehouse picker dialog */}
          <Dialog open={warehousePickerOpen} onOpenChange={setWarehousePickerOpen}>
            <DialogPortal>
              <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
              <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg">
                <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
                  {trans.warehouseLabel}
                </div>
                <div className="max-height-80 max-h-80 overflow-auto p-2">
                  {whLoading ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.loadingList}</div>
                  ) : whRows.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                  ) : (
                    <div className="space-y-2">
                      {whRows.map((r, idx) => {
                        const u = r.Unit ? ` ${r.Unit}` : "";
                        return (
                          <button
                            key={`${r.Warehouse}-${idx}`}
                            type="button"
                            className="w-full text-left px-3 py-2 rounded-md border mb-1.5 bg-gray-50 hover:bg-gray-100"
                            onClick={() => {
                              setWarehouse(r.Warehouse);
                              setTargetWarehouse(r.Warehouse);
                              setWarehousePickerOpen(false);
                              // NACH Warehouse-Auswahl immer ins obere Location-Feld springen (ITEM-Flow)
                              if (lastMatchType === "ITEM") {
                                focusFromLocation();
                              } else {
                                setTimeout(() => warehouseRef.current?.focus(), 50);
                              }
                            }}
                          >
                            <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                              <div className="flex flex-col">
                                <div className="text-sm text-gray-900">{r.Warehouse || "-"}</div>
                                {r.WarehouseName && <div className="text-xs text-gray-700">{r.WarehouseName}</div>}
                              </div>
                              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 items-center">
                                <div className="text-xs text-gray-500 whitespace-nowrap">On hand:</div>
                                <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.OnHand}{u}</div>
                                <div className="text-xs text-gray-500 whitespace-nowrap">Allocated:</div>
                                <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.Allocated}{u}</div>
                                <div className="text-xs text-gray-500 whitespace-nowrap">Available:</div>
                                <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.Available}{u}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="absolute right-3 top-2 text-gray-600 hover:text-gray-900"
                  aria-label="Close"
                  onClick={() => setWarehousePickerOpen(false)}
                >
                  ×
                </button>
              </div>
            </DialogPortal>
          </Dialog>

          {/* Target warehouse picker dialog */}
          <Dialog open={targetWhPickerOpen} onOpenChange={setTargetWhPickerOpen}>
            <DialogPortal>
              <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
              <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg">
                <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
                  {trans.targetWarehouseLabel}
                </div>
                <div className="max-h-[70vh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-2">
                  {targetWhLoading ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.loadingList}</div>
                  ) : targetWhRows.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                  ) : (
                    <div className="space-y-2">
                      {targetWhRows.map((r, idx) => (
                        <button
                          key={`${r.Warehouse}-${idx}`}
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-md border mb-1.5 bg-gray-50 hover:bg-gray-100"
                          onClick={() => {
                            setTargetWarehouse(r.Warehouse);
                            setLastValidatedTargetWarehouse(r.Warehouse);
                            setTargetWhPickerOpen(false);
                            setTimeout(() => targetLocRef.current?.focus(), 50);
                          }}
                        >
                          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                            <div className="flex flex-col">
                              <div className="text-sm text-gray-900">{r.Warehouse}</div>
                              {r.Description && <div className="text-xs text-gray-700">{r.Description}</div>}
                            </div>
                            {r.Type ? (
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${(() => {
                                  const t = r.Type.toLowerCase();
                                  if (t === "normal" || t === "service und instandhaltung") {
                                    return "bg-orange-500 text-white";
                                  }
                                  if (t === "produktion") {
                                    return "bg-emerald-500 text-white";
                                  }
                                  if (t === "projekt") {
                                    return "bg-sky-500 text-white";
                                  }
                                  if (t === "service (ts) im kundeneigentum") {
                                    return "bg-orange-200 text-orange-900";
                                  }
                                  if (t === "service-reklamation") {
                                    return "bg-red-500 text-white";
                                  }
                                  if (t === "fremder konsignationsbestand") {
                                    return "bg-lime-200 text-lime-900";
                                  }
                                  if (t === "eigener konsignationsbestand") {
                                    return "bg-green-500 text-white";
                                  }
                                  if (t === "kaufmännisches lager" || t === "kaufmaennisches lager") {
                                    return "bg-fuchsia-500 text-white";
                                  }
                                  return "bg-gray-200 text-gray-800";
                                })()}`}
                              >
                                {r.Type}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="absolute right-3 top-2 text-gray-600 hover:text-gray-900"
                  aria-label="Close"
                  onClick={() => setTargetWhPickerOpen(false)}
                >
                  ×
                </button>
              </div>
            </DialogPortal>
          </Dialog>

          {/* From-Location picker dialog */}
          <LocationPickerDialog
            open={fromLocPickerOpen}
            onOpenChange={setFromLocPickerOpen}
            loading={fromLocLoading}
            rows={fromLocRows}
            onPick={(loc) => {
              setLocation(loc);
              setFromLocPickerOpen(false);
              // Next step is Target Warehouse or Target Location depending on flow; keep focus on Location for quick scan
              setTimeout(() => fromLocRef.current?.focus(), 50);
            }}
            title={trans.locationLabel}
            emptyText={trans.noEntries}
            loadingText={trans.loadingList}
          />

        </Card>
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

export default InfoStockTransfer;