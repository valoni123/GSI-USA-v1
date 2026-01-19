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

  // Results
  const [rows, setRows] = useState<Array<{ Warehouse: string; OnHand: number; Allocated: number; Available: number }>>([]);
  const [loading, setLoading] = useState(false);

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
      setLoading(false);
      return;
    }
    setRows((data.rows || []) as Array<{ Warehouse: string; OnHand: number; Allocated: number; Available: number }>);
    setLoading(false);
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
            onChange={(e) => setItem(e.target.value)}
            onBlur={() => fetchInventory(item)}
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

          {/* Result list */}
          <div className="mt-2 rounded-md">
            {rows.length === 0 ? (
              <div className="text-muted-foreground text-sm">{trans.noEntries}</div>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 bg-black text-white rounded-md text-xs font-semibold">
                  <div className="whitespace-nowrap">{trans.warehouseLabel}</div>
                  <div className="whitespace-nowrap">{trans.onHandLabel}</div>
                  <div className="whitespace-nowrap">{trans.allocatedLabel}</div>
                  <div className="whitespace-nowrap">{trans.availableLabel}</div>
                </div>
                {/* Rows */}
                {rows.map((r, idx) => (
                  <div key={`${r.Warehouse}-${idx}`}>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2 rounded-md bg-gray-100/80 shadow-sm">
                      <div className="text-sm text-gray-900 whitespace-nowrap">
                        {r.Warehouse || "-"}
                      </div>
                      <div className="text-sm text-gray-900 whitespace-nowrap text-right min-w-[70px]">{r.OnHand}</div>
                      <div className="text-sm text-gray-900 whitespace-nowrap text-right min-w-[70px]">{r.Allocated}</div>
                      <div className="text-sm text-gray-900 whitespace-nowrap text-right min-w-[70px]">{r.Available}</div>
                    </div>
                    {idx < rows.length - 1 && <div className="h-px bg-gray-200/60 mx-1 my-1" />}
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {/* Full-screen spinner while loading */}
      {loading && <ScreenSpinner message={trans.loadingList} />}
    </div>
  );
};

export default InfoStockArticle;