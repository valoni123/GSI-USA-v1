import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const IncomingGoodsReceipt = () => {
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

  const orderTypeRef = useRef<HTMLInputElement | null>(null);
  const orderNoRef = useRef<HTMLInputElement | null>(null);

  const [orderType, setOrderType] = useState<string>("");
  const [showOrderType, setShowOrderType] = useState<boolean>(false);
  const [orderTypeOptions, setOrderTypeOptions] = useState<string[]>([]);
  const [orderTypeDisabled, setOrderTypeDisabled] = useState<boolean>(true);
  const [orderTypeRequired, setOrderTypeRequired] = useState<boolean>(false);
  const [orderNo, setOrderNo] = useState<string>("");
  const [orderPos, setOrderPos] = useState<string>("");
  const [deliveryNote, setDeliveryNote] = useState<string>("");
  const [lot, setLot] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [lastCheckedOrder, setLastCheckedOrder] = useState<string | null>(null);
  const [confirmOnly, setConfirmOnly] = useState<boolean>(false);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  useEffect(() => {
    // Focus first editable field on open
    orderNoRef.current?.focus();
  }, []);

  // Read parameter (on mount and when screen regains focus)
  useEffect(() => {
    let active = true;

    const readParams = async () => {
      const { data, error } = await supabase.functions.invoke("gsi-get-params", {
        body: { company: "4000" },
      });
      if (!active) return;
      if (error || !data || !data.ok) {
        // keep default false (both buttons)
        return;
      }
      const aure = Boolean(data.params?.aure);
      setConfirmOnly(aure);
    };

    readParams();
    const onFocus = () => readParams();
    const onVisible = () => {
      if (document.visibilityState === "visible") readParams();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Search handler: call LN for the entered order number; if exactly one, reveal read-only Order Type
  const checkOrder = async (ord: string) => {
    const trimmed = (ord || "").trim();
    if (!trimmed) return;
    if (lastCheckedOrder === trimmed) return;
    const tid = showLoading(trans.loadingDetails);
    const { data, error } = await supabase.functions.invoke("ln-warehousing-orders", {
      body: { orderNumber: trimmed, language: locale, company: "4000" },
    });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      // Stay hidden, do not show an error as per spec; user can re-enter
      setShowOrderType(false);
      setOrderType("");
      setOrderTypeOptions([]);
      setOrderTypeDisabled(true);
      setOrderTypeRequired(false);
      setLastCheckedOrder(null);
      return;
    }
    const count = Number(data.count || 0);
    // Collect unique OrderOrigin values from raw payload (fallback to data.origin)
    const rawValues = Array.isArray(data.raw?.value) ? data.raw.value : [];
    const origins: string[] = rawValues
      .map((v: any) => (v?.OrderOrigin ? String(v.OrderOrigin) : null))
      .filter((v: string | null): v is string => !!v);
    const uniqueOrigins = Array.from(new Set(origins.length ? origins : (data.origin ? [String(data.origin)] : [])));

    if (count === 1 || uniqueOrigins.length === 1) {
      // Single origin → read-only
      const origin = uniqueOrigins[0] || (data.origin ? String(data.origin) : "");
      setOrderType(origin || "");
      setOrderTypeOptions([]);
      setOrderTypeDisabled(true);
      setOrderTypeRequired(false);
      setShowOrderType(true);
      setLastCheckedOrder(trimmed);
      return;
    }

    if (count > 1 && uniqueOrigins.length > 1) {
      // Multiple differing origins → user must select
      setOrderType("");
      setOrderTypeOptions(uniqueOrigins);
      setOrderTypeDisabled(false);
      setOrderTypeRequired(true);
      setShowOrderType(true);
      setLastCheckedOrder(trimmed);
      return;
    }

    // Default fallback: hide
    setShowOrderType(false);
    setOrderType("");
    setOrderTypeOptions([]);
    setOrderTypeDisabled(true);
    setOrderTypeRequired(false);
    setLastCheckedOrder(trimmed);
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
            onClick={() => navigate("/menu/incoming")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.incomingGoodsReceipt.toUpperCase()}</div>
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
      <div className="mx-auto max-w-md px-4 py-4 pb-24">
        <Card className="rounded-md border-0 bg-transparent shadow-none p-0 space-y-3">
          {showOrderType && (
            orderTypeDisabled ? (
              <FloatingLabelInput
                id="incomingOrderType"
                label={trans.incomingOrderTypeLabel}
                ref={orderTypeRef}
                value={orderType}
                disabled
              />
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-700">
                  {trans.incomingOrderTypeLabel} {orderTypeRequired && <span className="text-red-600">*</span>}
                </div>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={trans.incomingOrderTypeLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {orderTypeOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          )}

          <FloatingLabelInput
            id="incomingOrderNo"
            label={trans.incomingOrderNumberLabel}
            ref={orderNoRef}
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            onBlur={() => {
              const v = orderNo.trim();
              if (v) checkOrder(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = orderNo.trim();
                if (v) checkOrder(v);
              }
            }}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            onClear={() => {
              setOrderNo("");
              setShowOrderType(false);
              setOrderType("");
              setOrderTypeOptions([]);
              setOrderTypeDisabled(true);
              setOrderTypeRequired(false);
              setLastCheckedOrder(null);
              setTimeout(() => orderNoRef.current?.focus(), 0);
            }}
          />

          <FloatingLabelInput
            id="incomingOrderPos"
            label={trans.incomingOrderPositionLabel}
            value={orderPos}
            onChange={(e) => setOrderPos(e.target.value)}
            onClear={() => setOrderPos("")}
          />

          <FloatingLabelInput
            id="incomingDeliveryNote"
            label={trans.incomingDeliveryNoteLabel}
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            onClear={() => setDeliveryNote("")}
          />

          <FloatingLabelInput
            id="incomingLot"
            label={trans.lotLabel}
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            onClear={() => setLot("")}
          />

          <FloatingLabelInput
            id="incomingQty"
            label={trans.quantityLabel}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onClear={() => setQty("")}
          />
        </Card>
      </div>

      {/* Bottom buttons (disabled at startup like screenshot) */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t">
        {confirmOnly ? (
          <div className="mx-auto max-w-md px-3 py-3">
            <Button className="h-12 w-full" variant="secondary" disabled>
              {trans.incomingConfirm}
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-md px-3 py-3 grid grid-cols-2 gap-3">
            <Button className="h-12" variant="secondary" disabled>
              {trans.incomingConfirmAndPost}
            </Button>
            <Button className="h-12" variant="secondary" disabled>
              {trans.incomingConfirm}
            </Button>
          </div>
        )}
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

export default IncomingGoodsReceipt;