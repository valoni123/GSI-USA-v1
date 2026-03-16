import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Search, User, CheckSquare, Square, MinusCircle, PlusCircle } from "lucide-react";
import LocationPickerDialog from "@/components/LocationPickerDialog";
import ScreenSpinner from "@/components/ScreenSpinner";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showError, showLoading, dismissToast, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const InfoStockCorrection = () => {
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
  const fromLocRef = useRef<HTMLInputElement | null>(null);
  const quantityRef = useRef<HTMLInputElement | null>(null);

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

  // Quantity to submit (editable via +/- field)
  const [submitQuantity, setSubmitQuantity] = useState<string>("");
  const [submitQtyTouched, setSubmitQtyTouched] = useState<boolean>(false);

  // Correction reason
  const [reasons, setReasons] = useState<Array<{ Reason: string; Description?: string }>>([]);
  const [reasonsLoading, setReasonsLoading] = useState(false);
  const [reason, setReason] = useState<string>("");

  // Enablement and visibility
  const [warehouseEnabled, setWarehouseEnabled] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [lastMatchType, setLastMatchType] = useState<"HU" | "ITEM" | null>(null);

  // Warehouse picker state (for item scan)
  const [warehousePickerOpen, setWarehousePickerOpen] = useState<boolean>(false);
  const [whLoading, setWhLoading] = useState<boolean>(false);
  const [whRows, setWhRows] = useState<
    Array<{ Warehouse: string; WarehouseName?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>
  >([]);

  // From-Location picker (ITEM flow)
  const [fromLocPickerOpen, setFromLocPickerOpen] = useState<boolean>(false);
  const [fromLocLoading, setFromLocLoading] = useState<boolean>(false);
  const [fromLocRows, setFromLocRows] = useState<
    Array<{ Location: string; OnHand: number; Allocated?: number; Available?: number; Lot?: string | null; Unit?: string }>
  >([]);

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

  // Fokus zuverlässig ins Mengenfeld
  const focusQuantity = () => {
    const focus = () => {
      const el = quantityRef.current || (document.getElementById("transferQuantity") as HTMLInputElement | null);
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

  // Quantity helpers: allow only positive numeric with optional decimal separator
  const sanitizeQuantity = (raw: string) => {
    const replaced = raw.replace(",", "."); // normalize comma to dot
    // keep digits and dots only
    let s = replaced.replace(/[^0-9.]/g, "");
    // collapse multiple dots to a single one (keep first)
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    // prevent leading dot by prefixing 0
    if (s.startsWith(".")) s = "0" + s;
    return s;
  };

  const handleQuantityChange = (raw: string) => {
    const s = sanitizeQuantity(raw);
    setQuantity(s);
    if (!submitQtyTouched) setSubmitQuantity(s);
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedControl = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowedControl.includes(e.key)) return;
    // Allow digits
    if (/^[0-9]$/.test(e.key)) return;
    // Allow one decimal separator if not present
    if ((e.key === "." || e.key === ",") && !String(quantity || "").includes(".")) return;
    // Block everything else (including minus, plus, letters)
    e.preventDefault();
  };

  const handleQuantityPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = (e.clipboardData?.getData("text") || "").toString();
    handleQuantityChange(text);
  };

  const handleQuantityBlur = () => {
    const s = sanitizeQuantity(quantity || "");
    const num = s === "" ? NaN : Number(s);
    if (!isFinite(num) || num <= 0) {
      setQuantity("");
      if (!submitQtyTouched) setSubmitQuantity("");
      // keep user in the field to correct
      setTimeout(() => quantityRef.current?.focus(), 0);
      return;
    }
    const normalized = String(num);
    setQuantity(normalized);
    if (!submitQtyTouched) setSubmitQuantity(normalized);
  };

  const handleSubmitQuantityChange = (raw: string) => {
    setSubmitQtyTouched(true);
    setSubmitQuantity(sanitizeQuantity(raw));
  };

  const handleSubmitQuantityBlur = () => {
    const s = sanitizeQuantity(submitQuantity || "");
    const num = s === "" ? NaN : Number(s);
    if (!isFinite(num) || num <= 0) {
      setSubmitQuantity("");
      return;
    }
    setSubmitQuantity(String(num));
  };

  const adjustSubmitQuantity = (delta: number) => {
    setSubmitQtyTouched(true);
    const s = sanitizeQuantity(submitQuantity || "");
    const current = s === "" ? 0 : Number(s);
    const next = Math.max(0, (isFinite(current) ? current : 0) + delta);
    setSubmitQuantity(next === 0 ? "0" : String(next));
  };

  // Menge/Einheit aus gewählter/eingegebener Location holen (ITEM-Flow)
  const prefillFromLocation = async () => {
    if (lastMatchType !== "ITEM") return;
    const itm = (item || "").trim();
    const wh = (warehouse || "").trim();
    const loc = (location || "").trim();
    if (!itm || !wh || !loc) return;
    const { data, error } = await supabase.functions.invoke("ln-stockpoint-inventory", {
      body: { item: itm, warehouse: wh, location: loc, language: locale, company: "1100" },
    });
    if (error || !data || !data.ok) {
      // Falls Service scheitert, keine Änderung erzwingen
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const first = rows[0];
    if (first) {
      const avail = typeof first.Available === "number" ? first.Available : undefined;
      const onHand = typeof first.OnHand === "number" ? first.OnHand : undefined;
      const unitVal = typeof first.Unit === "string" ? first.Unit : (typeof first.InventoryUnit === "string" ? first.InventoryUnit : "");
      const qtyNum = typeof avail === "number" ? avail : (typeof onHand === "number" ? onHand : undefined);
      if (typeof qtyNum === "number") {
        const q = String(qtyNum);
        setQuantity(q);
        if (!submitQtyTouched) setSubmitQuantity(q);
      }
      if (unitVal) setUnit(unitVal);
      // WICHTIG: Kein Fokuswechsel mehr
    }
  };

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const loadReasons = async () => {
    setReasonsLoading(true);
    const tid = showLoading(trans.pleaseWait);
    const { data } = await supabase.functions.invoke("ln-reasons-list", {
      body: { company: "1100", language: locale, reasonType: "InventoryAdjustment" },
    });
    dismissToast(tid as unknown as string);
    const list = Array.isArray(data?.value) ? data.value : [];
    setReasons(list);
    setReasonsLoading(false);
  };

  useEffect(() => {
    if (!showDetails) return;
    if (reasonsLoading) return;
    if (reasons.length > 0) return;
    void loadReasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetails]);

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
  const [transferring, setTransferring] = useState<boolean>(false);

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

  // Enable SUBMIT only when everything required is filled
  const canSubmit = useMemo(() => {
    if (!showDetails) return false;

    const statusKey = normalizeStatus(status);
    // For HU flow, only allow submit when HU is actually in stock.
    if (lastMatchType === "HU" && statusKey !== "instock") return false;

    const baseOk = (warehouse || "").trim() && (location || "").trim();
    const unitOk = (unit || "").trim().length > 0;

    const originalQty = Number(quantity);
    const nextQty = Number(submitQuantity);
    const qtyOk = isFinite(nextQty) && nextQty > 0;
    const qtyChanged = isFinite(originalQty) && isFinite(nextQty) && nextQty !== originalQty;

    const reasonOk = (reason || "").trim().length > 0;

    return !!(baseOk && qtyOk && unitOk && qtyChanged && reasonOk) && !searching && !transferring;
  }, [showDetails, lastMatchType, warehouse, location, quantity, submitQuantity, unit, reason, searching, transferring, status]);

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
      setLocation(d.location || "");
      setLot(d.lot || "");
      const qty = d.quantity != null ? String(d.quantity) : "";
      setQuantity(qty);
      setSubmitQuantity(qty);
      setSubmitQtyTouched(false);
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
      setLocation("");
      setLot("");
      setQuantity("");
      setSubmitQuantity("");
      setSubmitQtyTouched(false);
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

  const resetAll = () => {
    setQuery("");
    setLastSearched(null);
    setItem("");
    setHandlingUnit("");
    setWarehouse("");
    setLocation("");
    setLot("");
    setQuantity("");
    setSubmitQuantity("");
    setSubmitQtyTouched(false);
    setUnit("");
    setStatus("");
    setReason("");
    setWarehouseEnabled(false);
    setShowDetails(false);
    setItemDescription("");
    setQueryLabel(trans.itemOrHandlingUnit);
    setLastMatchType(null);
    setWhRows([]);
    setWarehousePickerOpen(false);
    huRef.current?.focus();
  };

  const doSubmit = async () => {
    if (!canSubmit) return;
    setTransferring(true);

    try {
      if (lastMatchType === "HU") {
        const hu = (handlingUnit || query || "").trim();
        const deviation = Number(submitQuantity);
        const reasonCode = (reason || "").trim();

        const loginCode =
          (localStorage.getItem("gsi.login") ||
            localStorage.getItem("gsi.employee") ||
            localStorage.getItem("gsi.username") ||
            "")
            .toString()
            .trim();

        const employee =
          (localStorage.getItem("gsi.employee") ||
            localStorage.getItem("gsi.login") ||
            localStorage.getItem("gsi.username") ||
            "")
            .toString()
            .trim();

        const tid = showLoading(trans.pleaseWait);
        const { data, error } = await supabase.functions.invoke("ln-inventory-adjustment", {
          body: {
            company: "1100",
            language: locale,
            handlingUnit: hu,
            deviation,
            reason: reasonCode,
            loginCode,
            employee,
          },
        });
        dismissToast(tid as unknown as string);

        if (error || !data || !data.ok) {
          showError(trans.tokenFailed);
          setTransferring(false);
          return;
        }

        showSuccess(trans.correctionSubmit);
      } else {
        showSuccess("Submitted");
      }

      setTransferring(false);
      resetAll();
    } catch (e) {
      setTransferring(false);
      showError(String(e));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/info-stock")} />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.infoStockCorrection.toUpperCase()}</div>
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
                  onBlur={() => { if ((location || "").trim()) { void prefillFromLocation(); } }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (location || "").trim()) {
                      e.preventDefault();
                      void prefillFromLocation();
                    }
                  }}
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
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  onKeyDown={handleQuantityKeyDown}
                  onPaste={handleQuantityPaste}
                  onBlur={handleQuantityBlur}
                  onClick={() => {
                    // Nur im ITEM-Flow und wenn leer automatisch aus Location befüllen
                    if (lastMatchType === "ITEM" && !(quantity || "").trim()) {
                      void prefillFromLocation();
                    }
                  }}
                  ref={quantityRef}
                  inputMode="decimal"
                  disabled={lastMatchType === "HU"}
                  className={lastMatchType === "HU" ? "bg-gray-100 text-gray-700" : undefined}
                />
                <FloatingLabelInput id="transferUnit" label={trans.unitLabel} value={unit} disabled />
              </div>

              {/* Editable submit quantity with +/- */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => adjustSubmitQuantity(-1)}
                  aria-label="Decrease quantity"
                >
                  <MinusCircle className="h-7 w-7 text-gray-700" />
                </Button>

                <Input
                  value={submitQuantity}
                  onChange={(e) => handleSubmitQuantityChange(e.target.value)}
                  onBlur={handleSubmitQuantityBlur}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                  inputMode="decimal"
                  placeholder={trans.quantityLabel}
                  className="h-10 text-center"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => adjustSubmitQuantity(1)}
                  aria-label="Increase quantity"
                >
                  <PlusCircle className="h-7 w-7 text-red-600" />
                </Button>
              </div>

              {/* Reason */}
              <div className="relative">
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger
                    id="correctionReason"
                    className="peer h-12"
                    disabled={reasonsLoading || reasons.length === 0}
                    data-has-value={Boolean((reason || "").trim())}
                  >
                    <SelectValue placeholder={""} />
                  </SelectTrigger>
                  <label
                    htmlFor="correctionReason"
                    className="
                      pointer-events-none absolute left-3
                      bg-white dark:bg-background px-1 rounded-sm
                      text-gray-400
                      transition-all duration-200
                      peer-data-[has-value=false]:top-1/2 peer-data-[has-value=false]:-translate-y-1/2 peer-data-[has-value=false]:text-sm
                      peer-data-[state=open]:-top-3 peer-data-[state=open]:-translate-y-0 peer-data-[state=open]:text-xs peer-data-[state=open]:text-gray-700
                      peer-data-[has-value=true]:-top-3 peer-data-[has-value=true]:-translate-y-0 peer-data-[has-value=true]:text-xs peer-data-[has-value=true]:text-gray-700
                      peer-disabled:text-gray-400
                    "
                  >
                    {trans.correctionReasonLabel} <span className="text-red-600">*</span>
                  </label>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.Reason} value={r.Reason}>
                        <div className="flex flex-col">
                          <div className="text-sm font-medium">{r.Reason}</div>
                          {r.Description ? (
                            <div className="text-xs text-muted-foreground">{r.Description}</div>
                          ) : null}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Submit button */}
              <Button
                type="button"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={!canSubmit}
                onClick={doSubmit}
              >
                {trans.correctionSubmit}
              </Button>
            </div>
          )}

          {(searching || transferring) && <ScreenSpinner message={trans.pleaseWait} />}

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

          {/* From-Location picker dialog (ITEM flow) */}
          <LocationPickerDialog
            open={fromLocPickerOpen}
            onOpenChange={setFromLocPickerOpen}
            loading={fromLocLoading}
            title={trans.locationLabel}
            rows={fromLocRows}
            onPick={(loc) => {
              setLocation(loc);
              const picked = fromLocRows.find((r) => r.Location === loc);
              setLot(typeof picked?.Lot === "string" ? picked.Lot : "");
              setFromLocPickerOpen(false);
              void prefillFromLocation();
              focusQuantity();
            }}
          />
        </Card>
      </div>

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

export default InfoStockCorrection;