import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState<string>("");
  const [lastSearched, setLastSearched] = useState<string | null>(null);
  // First input dynamic label and item description
  const [queryLabel, setQueryLabel] = useState<string>(() => t(lang).itemOrHandlingUnit);
  const [itemDescription, setItemDescription] = useState<string>("");
  // Result fields
  const [warehouse, setWarehouse] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [item, setItem] = useState<string>("");
  const [lot, setLot] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  // Enablement
  const [warehouseEnabled, setWarehouseEnabled] = useState<boolean>(false);
  // Control visibility of detail fields
  const [showDetails, setShowDetails] = useState<boolean>(false);
  // Track last match type to format description
  const [lastMatchType, setLastMatchType] = useState<"HU" | "ITEM" | null>(null);
  // Target fields (editable)
  const [targetWarehouse, setTargetWarehouse] = useState<string>("");
  const [targetLocation, setTargetLocation] = useState<string>("");
  // Warehouse picker state
  const [warehousePickerOpen, setWarehousePickerOpen] = useState<boolean>(false);
  const [whLoading, setWhLoading] = useState<boolean>(false);
  const [whRows, setWhRows] = useState<Array<{ Warehouse: string; WarehouseName?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>>([]);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  // Helper to enrich description for HUs by fetching item details
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

  // Main search handler: HU first, then ITEM
  const handleSearch = async (withLoading = false) => {
    const input = query.trim();
    if (!input) return;
    if (lastSearched === input) return;
    let tid: string | null = null;
    if (withLoading) {
      tid = showLoading(trans.loadingDetails) as unknown as string;
    }
    // 1) Try HU
    const huRes = await supabase.functions.invoke("ln-handling-unit-info", {
      body: { handlingUnit: input, language: locale, company: "1100" },
    });
    if (huRes.data && huRes.data.ok) {
      const d = huRes.data;
      setItem(d.item || "");
      setWarehouse(d.warehouse || "");
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
      // Try to fetch item description for HU-based results
      await fetchItemDescription(d.item);
      if (withLoading && tid) dismissToast(tid);
      return;
    }
    // 2) Try ITEM (no HU error toast)
    const itemRes = await supabase.functions.invoke("ln-item-info", {
      body: { item: input, language: locale, company: "1100" },
    });
    if (withLoading && tid) dismissToast(tid);
    if (itemRes.data && itemRes.data.ok) {
      const d = itemRes.data;
      setItem(d.item || input);
      setUnit((d.unit || "").toString());
      setWarehouseEnabled(true);
      setLastSearched(input);
      // Clear HU-specific fields
      setWarehouse("");
      setLocation("");
      setLot("");
      setQuantity("");
      setStatus("");
      setShowDetails(true);
      setQueryLabel(trans.itemLabel);
      setLastMatchType("ITEM");
      setItemDescription((d.description || "").toString());
      setTimeout(() => warehouseRef.current?.focus(), 50);
      return;
    }
    // Neither HU nor Item found → small error
    showError(trans.noEntries);
  };

  // Open and load warehouses for current item
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
    // Keep warehouses with InventoryOnHand >= 0 (as per example), preserve unit and names
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

  // Status color helpers (same scheme as HU Info)
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

          {/* Item description: label + highlighted box; show Status chip on the right for HU */}
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
            <div className="relative">
              <FloatingLabelInput
                id="transferWarehouse"
                label={trans.warehouseLabel}
                ref={warehouseRef}
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                disabled={!warehouseEnabled}
                className="pr-12"
                onFocus={(e) => {
                  if (e.currentTarget.value.length > 0) e.currentTarget.select();
                }}
                onClick={(e) => {
                  if (e.currentTarget.value.length > 0) e.currentTarget.select();
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
            <Input disabled value={location} placeholder={trans.locationLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <FloatingLabelInput
                id="transferQuantity"
                label={trans.quantityLabel}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
              />
              <FloatingLabelInput
                id="transferUnit"
                label={trans.unitLabel}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                onClear={() => setUnit("")}
              />
            </div>
            {/* Status field removed; it's displayed as a colored chip near Description for HU */}
            <FloatingLabelInput
              id="targetWarehouse"
              label={trans.targetWarehouseLabel}
              value={targetWarehouse}
              onChange={(e) => setTargetWarehouse(e.target.value)}
              onClear={() => setTargetWarehouse("")}
            />
            <FloatingLabelInput
              id="targetLocation"
              label={trans.targetLocationLabel}
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
              onClear={() => setTargetLocation("")}
            />
          </div>
          )}

          {/* Warehouse picker dialog */}
          <Dialog open={warehousePickerOpen} onOpenChange={setWarehousePickerOpen}>
            <DialogPortal>
              <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
              {/* Content wrapper using same visual style as other pickers */}
              <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg">
                <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
                  {trans.warehouseLabel}
                </div>
                <div className="max-h-80 overflow-auto p-2">
                  {whLoading ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.loadingList}</div>
                  ) : whRows.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                  ) : (
                    <div className="space-y-2">
                      {whRows.map((r, idx) => {
                        const unit = r.Unit ? ` ${r.Unit}` : "";
                        return (
                          <button
                            key={`${r.Warehouse}-${idx}`}
                            type="button"
                            className="w-full text-left px-3 py-2 rounded-md border mb-1.5 bg-gray-50 hover:bg-gray-100"
                            onClick={() => {
                              setWarehouse(r.Warehouse);
                              setWarehousePickerOpen(false);
                              setTimeout(() => warehouseRef.current?.focus(), 50);
                            }}
                          >
                            <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                              <div className="flex flex-col">
                                <div className="text-xs font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                                <div className="text-sm text-gray-900">{r.Warehouse || "-"}</div>
                                {r.WarehouseName && <div className="text-xs text-gray-700">{r.WarehouseName}</div>}
                              </div>
                              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 items-center">
                                <div className="text-xs text-gray-500 whitespace-nowrap">On hand:</div>
                                <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.OnHand}{unit}</div>
                                <div className="text-xs text-gray-500 whitespace-nowrap">Allocated:</div>
                                <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.Allocated}{unit}</div>
                                <div className="text-xs text-gray-500 whitespace-nowrap">Available:</div>
                                <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.Available}{unit}</div>
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

export default InfoStockTransfer;