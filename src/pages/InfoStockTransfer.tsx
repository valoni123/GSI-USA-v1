import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  // Result fields
  const [warehouse, setWarehouse] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [item, setItem] = useState<string>("");
  const [lot, setLot] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  // Enablement
  const [warehouseEnabled, setWarehouseEnabled] = useState<boolean>(false);
  // Control visibility of detail fields
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

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
      setQuantity(qty + (d.unit ? ` ${d.unit}` : ""));
      setStatus(d.status || "");
      setWarehouseEnabled(false);
      setLastSearched(input);
      setShowDetails(true);
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
      setWarehouseEnabled(true);
      setLastSearched(input);
      // Clear HU-specific fields
      setWarehouse("");
      setLocation("");
      setLot("");
      setQuantity("");
      setStatus("");
      setShowDetails(true);
      setTimeout(() => warehouseRef.current?.focus(), 50);
      return;
    }
    // Neither HU nor Item found → small error
    showError(trans.noEntries);
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
                label={trans.itemOrHandlingUnit}
                ref={huRef}
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  setLastSearched(null);
                  if (showDetails) setShowDetails(false);
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

          {/* Stacked fields (visible only after a successful search) */}
          {showDetails && (
          <div className="space-y-3">
            <FloatingLabelInput
              id="transferWarehouse"
              label={trans.warehouseLabel}
              ref={warehouseRef}
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              disabled={!warehouseEnabled}
              onFocus={(e) => {
                if (e.currentTarget.value.length > 0) e.currentTarget.select();
              }}
              onClick={(e) => {
                if (e.currentTarget.value.length > 0) e.currentTarget.select();
              }}
              onClear={() => setWarehouse("")}
            />
            <Input disabled value={location} placeholder={trans.locationLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <Input disabled value={item} placeholder={trans.itemLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <Input disabled value={lot} placeholder={trans.lotLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <Input disabled value={quantity} placeholder={trans.quantityLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <Input disabled value={status} placeholder={trans.statusLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <Input disabled placeholder={trans.targetWarehouseLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
            <Input disabled placeholder={trans.targetLocationLabel} className="h-10 bg-gray-100 text-gray-700 placeholder:text-gray-700" />
          </div>
          )}
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