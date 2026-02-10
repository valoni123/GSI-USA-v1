import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, Search } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
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
  const [linePickerOpen, setLinePickerOpen] = useState<boolean>(false);
  const [inboundLines, setInboundLines] = useState<Array<{ Line: number; Item?: string; ItemDesc?: string; tbrQty?: number; orderUnit?: string }>>([]);
  const [deliveryNote, setDeliveryNote] = useState<string>("");
  const [lot, setLot] = useState<string>("");
  const [bpLot, setBpLot] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [grItem, setGrItem] = useState<string>("");
  const [lastCheckedOrder, setLastCheckedOrder] = useState<string | null>(null);
  const [confirmOnly, setConfirmOnly] = useState<boolean>(false);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  // Friendly label for known OrderOrigin values
  const formatOriginLabel = (origin: string) => {
    const o = (origin || "").trim();
    if (lang === "de") {
      if (o === "JSCProduction") return "Produktion (JSC)";
      if (o === "Purchase") return "Einkauf";
      if (o === "Sales") return "Verkauf";
      if (o === "Transfer") return "Umbuchung";
      if (o === "TransferManual") return "Umbuchung (manuell)";
    } else if (lang === "es-MX") {
      if (o === "JSCProduction") return "Producción (JSC)";
      if (o === "Purchase") return "Compra";
      if (o === "Sales") return "Venta";
      if (o === "Transfer") return "Transferencia";
      if (o === "TransferManual") return "Transferencia (manual)";
    } else if (lang === "pt-BR") {
      if (o === "JSCProduction") return "Produção (JSC)";
      if (o === "Purchase") return "Compra";
      if (o === "Sales") return "Vendas";
      if (o === "Transfer") return "Transferência";
      if (o === "TransferManual") return "Transferência (manual)";
    } else {
      if (o === "JSCProduction") return "Production (JSC)";
      if (o === "Purchase") return "Purchase";
      if (o === "Sales") return "Sales";
      if (o === "Transfer") return "Transfer";
      if (o === "TransferManual") return "Transfer (manual)";
    }
    return o || "-";
  };

  // Hex color mapping for known origins (button background + text color)
  const originColorStyle = (origin: string) => {
    const o = (origin || "").toLowerCase();
    // Produktion (JSC)
    if (o.includes("production")) return { bg: "#2db329", text: "#ffffff" };
    // Purchase / Einkauf
    if (o.includes("purchase")) return { bg: "#9ed927", text: "#1a1a1a" };
    // Sales / Verkauf
    if (o.includes("sales")) return { bg: "#1d5f8a", text: "#ffffff" };
    // Transfer / Umbuchung (+ Manual)
    if (o.includes("transfer")) return { bg: "#ffd500", text: "#1a1a1a" };
    // Default
    return { bg: "#2db329", text: "#ffffff" };
  };

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

  // Search handler: call LN for InboundLines by Order (and optional Line)
  const checkOrder = async (ord: string, lineVal?: string) => {
    const trimmed = (ord || "").trim();
    if (!trimmed) return;
    // Allow re-check when line changes even if order is same
    const lineTrim = (lineVal || "").trim();
    if (lastCheckedOrder === `${trimmed}|${lineTrim}`) return;
    const tid = showLoading(trans.loadingDetails);
    // Include OrderOrigin in filter when we have a line and a known/selected orderType
    const originForFilter = lineTrim && orderType ? orderType : undefined;
    const { data, error } = await supabase.functions.invoke("ln-warehousing-orders", {
      body: {
        orderNumber: trimmed,
        line: lineTrim ? Number(lineTrim) : undefined,
        orderOrigin: originForFilter,
        language: locale,
        company: "4000",
      },
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
      // Clear inbound lines on error
      setInboundLines([]);
      return;
    }
    // Store inbound lines from raw payload for the picker
    const rawValues = Array.isArray(data.raw?.value) ? data.raw.value : [];
    const mappedLines: Array<{ Line: number; Item?: string; ItemDesc?: string; tbrQty?: number; orderUnit?: string }> =
      rawValues.map((v: any) => ({
        Line: Number(v?.Line ?? 0),
        Item: typeof v?.Item === "string" ? v.Item : (typeof v?.ItemRef?.Item === "string" ? v.ItemRef.Item : undefined),
        ItemDesc: typeof v?.ItemRef?.Description === "string" ? v.ItemRef.Description : undefined,
        tbrQty: typeof v?.ToBeReceivedQuantity === "number" ? v.ToBeReceivedQuantity : undefined,
        orderUnit: typeof v?.OrderUnit === "string" ? v.OrderUnit : (typeof v?.OrderUnitRef?.Unit === "string" ? v.OrderUnitRef.Unit : undefined),
      }))
      .filter((x) => Number.isFinite(x.Line) && x.Line > 0);
    setInboundLines(mappedLines);

    // If this was the first call (no line filter) and there is exactly one line, auto-fill the Line and re-check with the line filter
    if (!lineTrim && mappedLines.length === 1) {
      const singleLineStr = String(mappedLines[0].Line);
      setOrderPos(singleLineStr);
      setLastCheckedOrder(`${trimmed}|${singleLineStr}`);
      // Re-run with the specific line to resolve OrderOrigin accurately and narrow data
      await checkOrder(trimmed, singleLineStr);
      return;
    }

    const count = Number(data.count || 0);
    // Collect unique OrderOrigin values from raw payload (fallback to data.origin)
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
      setLastCheckedOrder(`${trimmed}|${lineTrim}`);
      return;
    }

    if (count > 1 && uniqueOrigins.length > 1) {
      // Multiple differing origins → user must select
      setOrderType("");
      setOrderTypeOptions(uniqueOrigins);
      setOrderTypeDisabled(false);
      setOrderTypeRequired(true);
      setShowOrderType(true);
      setLastCheckedOrder(`${trimmed}|${lineTrim}`);
      return;
    }

    // Default fallback: hide
    setShowOrderType(false);
    setOrderType("");
    setOrderTypeOptions([]);
    setOrderTypeDisabled(true);
    setOrderTypeRequired(false);
    setLastCheckedOrder(`${trimmed}|${lineTrim}`);
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
              <div className="space-y-1 mb-4">
                <div className="text-xs font-medium text-gray-700">{trans.incomingOrderTypeLabel}</div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const s = originColorStyle(orderType);
                    return (
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold shadow-sm"
                        style={{ backgroundColor: s.bg, color: s.text }}
                      >
                        {formatOriginLabel(orderType)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="space-y-1 mb-4">
                <div className="text-xs font-medium text-gray-700">
                  {trans.incomingOrderTypeLabel} {orderTypeRequired && <span className="text-red-600">*</span>}
                </div>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="h-12">
                    {orderType ? (
                      (() => {
                        const s = originColorStyle(orderType);
                        return (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm"
                            style={{ backgroundColor: s.bg, color: s.text }}
                          >
                            {formatOriginLabel(orderType)}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-gray-500">{trans.incomingOrderTypeLabel}</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {orderTypeOptions.map((opt) => {
                      const s = originColorStyle(opt);
                      return (
                        <SelectItem key={opt} value={opt}>
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                              style={{ backgroundColor: s.bg, color: s.text }}
                            >
                              {formatOriginLabel(opt)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
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
              setInboundLines([]);
              setTimeout(() => orderNoRef.current?.focus(), 0);
            }}
          />

          {/* Line with search icon aligned next to the field */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FloatingLabelInput
                id="incomingOrderPos"
                label={trans.incomingOrderPositionLabel}
                value={orderPos}
                onChange={(e) => setOrderPos(e.target.value)}
                onBlur={() => {
                  const ord = orderNo.trim();
                  const ln = orderPos.trim();
                  if (ord && ln) checkOrder(ord, ln);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const ord = orderNo.trim();
                    const ln = orderPos.trim();
                    if (ord && ln) checkOrder(ord, ln);
                  }
                }}
                onClear={() => setOrderPos("")}
              />
            </div>
            {inboundLines.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                aria-label="Search lines"
                onClick={async () => {
                  // Ensure we have lines; if not, fetch by order
                  const ord = orderNo.trim();
                  if (inboundLines.length === 0 && ord) {
                    await checkOrder(ord);
                  }
                  setLinePickerOpen(true);
                }}
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Line picker dialog with blurred background */}
          <Dialog open={linePickerOpen} onOpenChange={setLinePickerOpen}>
            <DialogPortal>
              <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
              <DialogPrimitive.Content
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg"
              >
                <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
                  {trans.incomingLinesLabel}
                </div>
                <div className="max-h-64 overflow-auto p-2">
                  {inboundLines.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                  ) : (
                    inboundLines.map((ln, idx) => (
                      <button
                        key={`${ln.Line}-${idx}`}
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-md border mb-2 bg-gray-50 hover:bg-gray-100"
                        onClick={async () => {
                          const ord = orderNo.trim();
                          const lineStr = String(ln.Line);
                          setOrderPos(lineStr);
                          setLinePickerOpen(false);
                          if (ord && lineStr) {
                            await checkOrder(ord, lineStr);
                          }
                        }}
                      >
                        <div className="grid grid-cols-[60px_1fr] gap-3 items-center">
                          <div className="inline-flex items-center rounded-full bg-gray-200 text-gray-800 px-3 py-1 text-xs font-semibold justify-center">
                            {ln.Line}
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-3 items-center w-full">
                            <div className="flex flex-col">
                              <div className="font-mono text-sm sm:text-base text-gray-900 break-all">
                                {(ln.Item || "").trim() || "-"}
                              </div>
                              {ln.ItemDesc && <div className="text-xs text-gray-700">{ln.ItemDesc}</div>}
                            </div>
                            {(ln.tbrQty != null || ln.orderUnit) && (
                              <div className="font-mono text-sm sm:text-base text-gray-900 text-right whitespace-nowrap">
                                {ln.tbrQty != null ? ln.tbrQty : ""} {ln.orderUnit || ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="absolute right-3 top-2 text-gray-600 hover:text-gray-900"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </DialogPrimitive.Close>
              </DialogPrimitive.Content>
            </DialogPortal>
          </Dialog>

          <FloatingLabelInput
            id="incomingItem"
            label={trans.itemLabel}
            value={grItem}
            onChange={(e) => setGrItem(e.target.value)}
            onClear={() => setGrItem("")}
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
            id="incomingBusinessPartnerLot"
            label={trans.businessPartnerLotLabel}
            value={bpLot}
            onChange={(e) => setBpLot(e.target.value)}
            onClear={() => setBpLot("")}
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