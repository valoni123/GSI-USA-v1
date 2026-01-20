import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
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

  useEffect(() => {
    itemRef.current?.focus();
  }, []);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const fetchInventory = async (itm: string) => {
    const trimmed = (itm || "").trim();
    if (!trimmed) {
      setRows([]);
      setLocRows([]);
      setSelectedWarehouse(null);
      setLastFetchedItem(null);
      return;
    }
    setLoading(true);
    const tid = showLoading(trans.loadingList);
    const { data, error } = await supabase.functions.invoke("ln-item-inventory-by-warehouse", {
      body: { item: trimmed, language: locale, company: "1000" },
    });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      const msg = (data && (data.error?.message || data.error)) || "Failed";
      showError(typeof msg === "string" ? msg : trans.loadingList);
      setRows([]);
      setLocRows([]);
      setSelectedWarehouse(null);
      setLoading(false);
      return;
    }
    setRows((data.rows || []) as Array<{ Warehouse: string; WarehouseName?: string; Unit?: string; OnHand: number; Allocated: number; Available: number }>);
    setLastFetchedItem(trimmed);
    setLoading(false);
  };

  const fetchLocations = async (itm: string, wh: string) => {
    const trimmed = (itm || "").trim();
    const whTrim = (wh || "").trim();
    if (!trimmed || !whTrim) {
      setLocRows([]);
      return;
    }
    setLocLoading(true);
    const tid = showLoading(trans.loadingList);
    const { data, error } = await supabase.functions.invoke("ln-stockpoint-inventory", {
      body: { item: trimmed, warehouse: whTrim, language: locale, company: "1000" },
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label={trans.back}
            onClick={() => navigate("/menu/info-stock")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

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
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <FloatingLabelInput
            id="articleItem"
            label={trans.itemLabel}
            ref={itemRef}
            value={item}
            onChange={(e) => {
              const v = e.target.value;
              setItem(v);
              if (v.trim() === "") {
                setRows([]);
                setLocRows([]);
                setSelectedWarehouse(null);
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
            autoFocus
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
          />
          <FloatingLabelInput
            id="articleWarehouse"
            label={trans.warehouseLabel}
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
          />
          <FloatingLabelInput
            id="articleLocation"
            label={trans.locationLabel}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
          />

          {/* Warehouse blocks */}
          <div className="mt-2 rounded-md">
            {rows.length === 0 ? (
              <div className="text-muted-foreground text-sm">{trans.noEntries}</div>
            ) : (
              <div className="space-y-2">
                {rows.map((r, idx) => {
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
                        await fetchLocations(item, r.Warehouse);
                      }}
                    >
                      {/* Three-column layout: left (warehouse), middle (divider), right (numbers) */}
                      <div className="grid grid-cols-[170px_10px_1fr] gap-3 items-stretch">
                        {/* Left block: Warehouse */}
                        <div className="flex flex-col justify-center">
                          <div className="text-sm font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                          <div className="text-sm text-gray-900">
                            {r.Warehouse || "-"}
                            {r.WarehouseName ? <span className="ml-1 text-gray-700">({r.WarehouseName})</span> : null}
                          </div>
                        </div>

                        {/* Middle: vertical divider */}
                        <div className="flex items-stretch">
                          <div className="mx-auto w-[2px] rounded bg-gray-300/70" />
                        </div>

                        {/* Right block: Inventory data */}
                        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center">
                          <div className="text-xs text-gray-500">{trans.onHandLabel}:</div>
                          <div className="text-sm text-gray-900 text-right">{r.OnHand}{unit}</div>
                          <div className="text-xs text-gray-500">{trans.allocatedLabel}:</div>
                          <div className="text-sm text-gray-900 text-right">{r.Allocated}{unit}</div>
                          <div className="text-xs text-gray-500">{trans.availableLabel}:</div>
                          <div className="text-sm text-gray-900 text-right">{r.Available}{unit}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Locations list for selected warehouse */}
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
                    return (
                      <div key={`${lr.Location}-${idx}`} className="rounded-md bg-white border px-3 py-2">
                        <div className="grid grid-cols-[140px_1fr] gap-3">
                          {/* Left: Location and optional Lot */}
                          <div>
                            <div className="text-[11px] font-semibold text-gray-700">{trans.locationLabel}:</div>
                            <div className="text-sm text-gray-900">{lr.Location || "-"}</div>
                            {lr.Lot && (
                              <div className="text-xs text-gray-700 mt-1">Charge: <span className="text-gray-900">{lr.Lot}</span></div>
                            )}
                          </div>
                          {/* Right: numbers */}
                          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center">
                            <div className="text-xs text-gray-500">{trans.onHandLabel}:</div>
                            <div className="text-sm text-gray-900 text-right">{lr.OnHand}{unit}</div>
                            <div className="text-xs text-gray-500">{trans.allocatedLabel}:</div>
                            <div className="text-sm text-gray-900 text-right">{lr.Allocated}{unit}</div>
                            <div className="text-xs text-gray-500">{trans.availableLabel}:</div>
                            <div className="text-sm text-gray-900 text-right">{lr.Available}{unit}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            onClick={() => fetchInventory(item)}
            disabled={item.trim() === "" && warehouse.trim() === "" && location.trim() === ""}
          >
            {trans.searchLabel}
          </Button>
        </div>
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

      {/* Full-screen spinner while loading warehouses */}
      {loading && <ScreenSpinner message={trans.loadingList} />}
    </div>
  );
};

export default InfoStockArticle;