import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Package, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import HandlingUnitStockDialog, { type HandlingUnitStockRow } from "@/components/HandlingUnitStockDialog";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import ScreenSpinner from "@/components/ScreenSpinner";

const InfoStockArticle = () => {
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

  // Inputs
  const itemRef = useRef<HTMLInputElement | null>(null);
  const warehouseRef = useRef<HTMLInputElement | null>(null);
  const locationRef = useRef<HTMLInputElement | null>(null);
  const [item, setItem] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");
  // Track last fetched item to avoid redundant calls on blur
  const [lastFetchedItem, setLastFetchedItem] = useState<string | null>(null);

  // Results
  const [rows, setRows] = useState<Array<{ Warehouse: string; WarehouseName?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [locRows, setLocRows] = useState<Array<{ Location: string; Lot?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isLocationSelecting, setIsLocationSelecting] = useState<boolean>(false);
  const [huStockOpen, setHuStockOpen] = useState(false);
  const [huStockLoading, setHuStockLoading] = useState(false);
  const [huStockRows, setHuStockRows] = useState<HandlingUnitStockRow[]>([]);

  useEffect(() => {
    itemRef.current?.focus();
  }, []);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const searchDisabled = useMemo(() => {
    const itemValue = item.trim();
    const warehouseValue = warehouse.trim();
    const locationValue = location.trim();
    const currentWarehouse = (selectedWarehouse || "").trim();
    const currentLocation = (selectedLocation || "").trim();

    if (!itemValue) return true;

    const itemAlreadyLoaded = lastFetchedItem === itemValue;
    const warehouseAlreadyLoaded =
      !!warehouseValue &&
      currentWarehouse.toLowerCase() === warehouseValue.toLowerCase();
    const locationAlreadyLoaded =
      !!locationValue &&
      currentLocation.toLowerCase() === locationValue.toLowerCase();

    return loading || locLoading || (itemAlreadyLoaded && warehouseAlreadyLoaded && locationAlreadyLoaded);
  }, [item, warehouse, location, selectedWarehouse, selectedLocation, lastFetchedItem, loading, locLoading]);

  const canOpenHuStock = useMemo(() => {
    const itemValue = item.trim();
    const warehouseValue = warehouse.trim();
    const locationValue = location.trim();
    const currentWarehouse = (selectedWarehouse || "").trim();
    const currentLocation = (selectedLocation || "").trim();

    return (
      !!itemValue &&
      !!warehouseValue &&
      !!locationValue &&
      lastFetchedItem === itemValue &&
      currentWarehouse.toLowerCase() === warehouseValue.toLowerCase() &&
      currentLocation.toLowerCase() === locationValue.toLowerCase() &&
      !loading &&
      !locLoading
    );
  }, [item, warehouse, location, selectedWarehouse, selectedLocation, lastFetchedItem, loading, locLoading]);

  // NEW: Only show the selected/typed warehouse block when a warehouse is specified
  const displayRows = useMemo(() => {
    const eff = (warehouse || selectedWarehouse || "").trim();
    if (!eff) return rows;
    return rows.filter((r) => (r.Warehouse || "").toLowerCase() === eff.toLowerCase());
  }, [rows, warehouse, selectedWarehouse]);

  const fetchInventory = async (itm: string) => {
    const trimmed = (itm || "").trim();
    if (!trimmed) {
      setRows([]);
      setLocRows([]);
      setSelectedWarehouse(null);
      setSelectedLocation(null);
      setLastFetchedItem(null);
      setHuStockRows([]);
      setHuStockOpen(false);
      return;
    }
    setHuStockRows([]);
    setHuStockOpen(false);
    setLoading(true);
    const tid = showLoading(trans.loadingList);
    const { data, error } = await supabase.functions.invoke("ln-item-inventory-by-warehouse", {
      body: { item: trimmed, language: locale, company: "1100" },
    });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      const msg = (data && (data.error?.message || data.error)) || "Failed";
      showError(typeof msg === "string" ? msg : trans.loadingList);
      setRows([]);
      setLocRows([]);
      setSelectedWarehouse(null);
      setSelectedLocation(null);
      setLoading(false);
      return;
    }
    setRows((data.rows || []) as Array<{ Warehouse: string; WarehouseName?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>);
    setLastFetchedItem(trimmed);
    setLoading(false);
  };

  const fetchLocations = async (itm: string, wh: string, loc?: string) => {
    const trimmed = (itm || "").trim();
    const whTrim = (wh || "").trim();
    const locTrim = (loc || "").trim();
    if (!trimmed || !whTrim) {
      setLocRows([]);
      return;
    }
    setHuStockRows([]);
    setHuStockOpen(false);
    setLocLoading(true);
    const tid = showLoading(trans.loadingList);
    const { data, error } = await supabase.functions.invoke("ln-stockpoint-inventory", {
      body: { item: trimmed, warehouse: whTrim, location: locTrim || undefined, language: locale, company: "1100" },
    });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      const msg = (data && (data.error?.message || data.error)) || "Failed";
      showError(typeof msg === "string" ? msg : trans.loadingList);
      setLocRows([]);
      setLocLoading(false);
      return;
    }
    setLocRows((data.rows || []) as Array<{ Location: string; Lot?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>);
    setLocLoading(false);
  };

  const openHuStock = async () => {
    if (!canOpenHuStock) return;

    setHuStockOpen(true);
    setHuStockLoading(true);
    const tid = showLoading(trans.loadingList);
    const { data, error } = await supabase.functions.invoke("ln-handling-unit-stock", {
      body: {
        item: item.trim(),
        warehouse: warehouse.trim(),
        location: location.trim(),
        language: locale,
        company: "1100",
      },
    });
    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      const msg = (data && (data.error?.message || data.error)) || "Failed";
      showError(typeof msg === "string" ? msg : trans.loadingList);
      setHuStockRows([]);
      setHuStockLoading(false);
      return;
    }

    setHuStockRows(Array.isArray(data.rows) ? (data.rows as HandlingUnitStockRow[]) : []);
    setHuStockLoading(false);
  };

  const openHuInfo = (handlingUnitValue: string) => {
    const value = (handlingUnitValue || "").trim();
    if (!value) return;
    setHuStockOpen(false);
    navigate("/menu/info-stock/le-info", { state: { initialHandlingUnit: value } });
  };

  // Clear handlers with re-fetch
  const clearItem = async () => {
    setItem("");
    setRows([]);
    setLocRows([]);
    setSelectedWarehouse(null);
    setSelectedLocation(null);
    setLastFetchedItem(null);
    setHuStockRows([]);
    setHuStockOpen(false);
    itemRef.current?.focus();
    // No item → show empty state
  };
  const clearWarehouse = async () => {
    setWarehouse("");
    setSelectedWarehouse(null);
    setSelectedLocation(null);
    setLocRows([]);
    setHuStockRows([]);
    setHuStockOpen(false);
    warehouseRef.current?.focus();
    // Reload warehouses for current item
    if (item.trim()) await fetchInventory(item);
  };
  const clearLocation = async () => {
    setLocation("");
    setSelectedLocation(null);
    setHuStockRows([]);
    setHuStockOpen(false);
    locationRef.current?.focus();
    // Reload locations for current item + warehouse
    const wh = (warehouse || selectedWarehouse || "").trim();
    if (item.trim() && wh) await fetchLocations(item, wh);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/info-stock")} />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.infoStockArticle}</div>
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
      <div className="mx-auto max-w-md px-4 py-6 pb-36">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          {/* Item */}
          <FloatingLabelInput
            id="articleItem"
            label={trans.itemLabel}
            ref={itemRef}
            value={item}
            onChange={(e) => {
              const v = e.target.value;
              setItem(v);
              setHuStockRows([]);
              setHuStockOpen(false);
              if (v.trim() === "") {
                setRows([]);
                setLocRows([]);
                setSelectedWarehouse(null);
                setSelectedLocation(null);
                setLastFetchedItem(null);
              }
            }}
            onBlur={() => {
              const current = item.trim();
              if (!current) return;
              if (lastFetchedItem !== current) {
                fetchInventory(item);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const current = item.trim();
                if (current) fetchInventory(item);
              }
            }}
            autoFocus
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClear={clearItem}
          />

          {/* Warehouse */}
          <FloatingLabelInput
            id="articleWarehouse"
            label={trans.warehouseLabel}
            ref={warehouseRef}
            value={warehouse}
            onChange={(e) => {
              setWarehouse(e.target.value);
              setHuStockRows([]);
              setHuStockOpen(false);
            }}
            onBlur={() => {
              const wh = warehouse.trim();
              if (!wh) {
                setSelectedWarehouse(null);
                setLocRows([]);
                return;
              }
              if (item.trim()) {
                setSelectedWarehouse(wh);
                setSelectedLocation(null);
                fetchLocations(item, wh);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const wh = warehouse.trim();
                if (item.trim() && wh) {
                  setSelectedWarehouse(wh);
                  setSelectedLocation(null);
                  fetchLocations(item, wh);
                }
              }
            }}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClear={clearWarehouse}
          />

          {/* Location */}
          <FloatingLabelInput
            id="articleLocation"
            label={trans.locationLabel}
            ref={locationRef}
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setHuStockRows([]);
              setHuStockOpen(false);
            }}
            onBlur={() => {
              if (isLocationSelecting) {
                // Skip blur-triggered fetch when a location row is being selected
                setIsLocationSelecting(false);
                return;
              }
              const loc = location.trim();
              const wh = (warehouse || selectedWarehouse || "").trim();
              if (!loc) {
                setSelectedLocation(null);
                if (item.trim() && wh) fetchLocations(item, wh);
                return;
              }
              if (item.trim() && wh) {
                setSelectedLocation(loc);
                fetchLocations(item, wh, loc);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const loc = location.trim();
                const wh = (warehouse || selectedWarehouse || "").trim();
                if (item.trim() && wh) {
                  setSelectedLocation(loc || null);
                  fetchLocations(item, wh, loc || undefined);
                }
              }
            }}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClear={clearLocation}
          />

          {/* Warehouse blocks */}
          <div className="mt-2 rounded-md">
            {displayRows.length === 0 ? (
              <div className="text-muted-foreground text-sm">{trans.noEntries}</div>
            ) : (
              <div className="space-y-2">
                {displayRows.map((r, idx) => {
                  const unit = r.Unit ? ` ${r.Unit}` : "";
                  const isSelected = selectedWarehouse === r.Warehouse;
                  return (
                    <button
                      key={`${r.Warehouse}-${idx}`}
                      type="button"
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${isSelected ? "bg-gray-200/70" : "bg-gray-50 hover:bg-gray-100/70"}`}
                      onClick={async () => {
                        setSelectedWarehouse(r.Warehouse);
                        setWarehouse(r.Warehouse);
                        setSelectedLocation(null);
                        setHuStockRows([]);
                        setHuStockOpen(false);
                        await fetchLocations(item, r.Warehouse);
                        setTimeout(() => locationRef.current?.focus(), 50);
                      }}
                    >
                      <div className="grid grid-cols-[130px_10px_1fr] sm:grid-cols-[170px_12px_1fr] gap-3 items-stretch w-full">
                        <div className="flex flex-col justify-center">
                          <div className="text-sm font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                          <div className="text-sm text-gray-900 whitespace-nowrap">{r.Warehouse || "-"}</div>
                          {r.WarehouseName && (
                            <div className="text-xs text-gray-700 break-words">{r.WarehouseName}</div>
                          )}
                        </div>

                        <div className="flex items-stretch">
                          <div className="mx-auto w-[2px] rounded bg-gray-300/70" />
                        </div>

                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-center">
                          <div className="text-xs text-gray-500 whitespace-nowrap">{trans.onHandLabel}:</div>
                          <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.OnHand}{unit}</div>

                          <div className="text-xs text-gray-500 whitespace-nowrap">{trans.allocatedLabel}:</div>
                          <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.Allocated}{unit}</div>

                          <div className="text-xs text-gray-500 whitespace-nowrap">{trans.availableLabel}:</div>
                          <div className="text-sm text-gray-900 text-right whitespace-nowrap">{r.Available}{unit}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedWarehouse && (
            <div className="mt-4 rounded-md">
              {locLoading ? (
                <div className="text-muted-foreground text-sm">{trans.loadingList}</div>
              ) : locRows.length === 0 ? (
                <div className="text-muted-foreground text-sm">{trans.noEntries}</div>
              ) : (
                <div className="space-y-2">
                  {locRows.map((lr, idx) => {
                    const unit = lr.Unit ? ` ${lr.Unit}` : "";
                    const isLocSelected = selectedLocation === lr.Location;
                    return (
                      <button
                        key={`${lr.Location}-${idx}`}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${isLocSelected ? "bg-gray-200/70" : "bg-white hover:bg-gray-100/70"}`}
                        onMouseDown={() => {
                          setIsLocationSelecting(true);
                        }}
                        onClick={async () => {
                          const clickedLoc = lr.Location;
                          const currentItem = item.trim();
                          const currentWh = (warehouse || selectedWarehouse || "").trim();
                          const currentLoc = location.trim();

                          setSelectedLocation(clickedLoc);
                          setLocation(clickedLoc);
                          setHuStockRows([]);
                          setHuStockOpen(false);

                          if (currentItem && currentWh && currentLoc === clickedLoc) {
                            setIsLocationSelecting(false);
                            return;
                          }

                          await fetchLocations(item, currentWh || selectedWarehouse || "", clickedLoc);
                          setIsLocationSelecting(false);
                        }}
                      >
                        <div className="grid grid-cols-[140px_1fr] gap-3">
                          <div>
                            <div className="text-[11px] font-semibold text-gray-700">{trans.locationLabel}:</div>
                            <div className="text-sm text-gray-900">{lr.Location || "-"}</div>
                            {lr.Lot && (
                              <div className="text-xs text-gray-700 mt-1">Charge: <span className="text-gray-900">{lr.Lot}</span></div>
                            )}
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center">
                            <div className="text-xs text-gray-500">{trans.onHandLabel}:</div>
                            <div className="text-sm text-gray-900 text-right">{lr.OnHand}{unit}</div>
                            <div className="text-xs text-gray-500">{trans.allocatedLabel}:</div>
                            <div className="text-sm text-gray-900 text-right">{lr.Allocated}{unit}</div>
                            <div className="text-xs text-gray-500">{trans.availableLabel}:</div>
                            <div className="text-sm text-gray-900 text-right">{lr.Available}{unit}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3 space-y-3">
          {canOpenHuStock && (
            <Button
              type="button"
              className="w-full h-11 text-base bg-zinc-700 hover:bg-zinc-800 text-white"
              onClick={openHuStock}
            >
              <Package className="mr-2 h-4 w-4" />
              {trans.handlingUnitStockLabel}
            </Button>
          )}

          <Button
            className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            onClick={() => fetchInventory(item)}
            disabled={searchDisabled}
          >
            {trans.searchLabel}
          </Button>
        </div>
      </div>

      <HandlingUnitStockDialog
        open={huStockOpen}
        onOpenChange={setHuStockOpen}
        lang={lang}
        rows={huStockRows}
        loading={huStockLoading}
        onOpenHandlingUnit={openHuInfo}
      />

      <SignOutConfirm
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={trans.signOutTitle}
        question={trans.signOutQuestion}
        yesLabel={trans.yes}
        noLabel={trans.no}
        onConfirm={onConfirmSignOut}
      />

      {loading && <ScreenSpinner message={trans.loadingList} />}
    </div>
  );
};

export default InfoStockArticle;