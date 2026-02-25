import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, Search } from "lucide-react";
import BackButton from "@/components/BackButton";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess, showLoading, dismissToast, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import ScreenSpinner from "@/components/ScreenSpinner";

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
  const orderPosRef = useRef<HTMLInputElement | null>(null);
  const lotRef = useRef<HTMLInputElement | null>(null);
  const bpLotRef = useRef<HTMLInputElement | null>(null);
  const deliveryNoteRef = useRef<HTMLInputElement | null>(null);
  const qtyRef = useRef<HTMLInputElement | null>(null);

  const [orderType, setOrderType] = useState<string>("");
  const [showOrderType, setShowOrderType] = useState<boolean>(false);
  const [orderTypeOptions, setOrderTypeOptions] = useState<string[]>([]);
  const [orderTypeDisabled, setOrderTypeDisabled] = useState<boolean>(true);
  const [orderTypeRequired, setOrderTypeRequired] = useState<boolean>(false);
  const [orderNo, setOrderNo] = useState<string>("");
  const [orderPos, setOrderPos] = useState<string>("");
  const [linePickerOpen, setLinePickerOpen] = useState<boolean>(false);
  const [inboundLinesAll, setInboundLinesAll] = useState<Array<{ Line: number; Item?: string; ItemDesc?: string; tbrQty?: number; orderUnit?: string }>>([]);
  const [hasMultipleLines, setHasMultipleLines] = useState<boolean>(false);
  const [inboundLinesGrouped, setInboundLinesGrouped] = useState<Array<{ origin: string; lines: Array<{ Line: number; Item?: string; ItemDesc?: string; tbrQty?: number; orderUnit?: string }> }>>([]);
  const [buyFromBusinessPartner, setBuyFromBusinessPartner] = useState<string>("");
  const [lotsAvailableCount, setLotsAvailableCount] = useState<number>(0);
  const [lotsPickerOpen, setLotsPickerOpen] = useState<boolean>(false);
  const [existingLots, setExistingLots] = useState<any[]>([]);
  const [lotsOrigin, setLotsOrigin] = useState<string>("");
  const [deliveryNote, setDeliveryNote] = useState<string>("");
  const [lot, setLot] = useState<string>("");
  const [bpLot, setBpLot] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [grItem, setGrItem] = useState<string>("");
  const [orderUnit, setOrderUnit] = useState<string>("");
  const [grItemDesc, setGrItemDesc] = useState<string>("");
  const [grItemRaw, setGrItemRaw] = useState<string>("");
  const [lotTracking, setLotTracking] = useState<boolean>(false);
  const [lastCheckedOrder, setLastCheckedOrder] = useState<string | null>(null);
  const [confirmOnly, setConfirmOnly] = useState<boolean>(false);
  const [receivedLinesCount, setReceivedLinesCount] = useState<number>(0);
  const [receivedLines, setReceivedLines] = useState<any[]>([]);
  const [receivedLinesOpen, setReceivedLinesOpen] = useState<boolean>(false);
  const [suppressAutoFillLine, setSuppressAutoFillLine] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  // NEW: control whether the line picker can auto-open
  const [allowLinePickerAutoOpen, setAllowLinePickerAutoOpen] = useState<boolean>(true);

  // Handle QR scans like "200000066/10", "200000066|10", "200000066-10", "200000066\\10", "200000066,10", "200000066;10"
  const splitSeparators = /[\/|\\,;\-]/;
  const parseOrderLinePair = (input: string): { order: string; line: string } | null => {
    const txt = (input || "").trim();
    if (!txt || !splitSeparators.test(txt)) return null;
    const parts = txt.split(/[\/|\\,;\-]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    return { order: parts[0], line: parts[1] };
  };

  const isPurchaseOrigin = useMemo(() => {
    return (orderType || lotsOrigin || "").toLowerCase().includes("purchase");
  }, [orderType, lotsOrigin]);

  const actionEnabled = useMemo(() => {
    const hasOrder = (orderNo || "").trim().length > 0;
    const hasLine = (orderPos || "").trim().length > 0;
    const hasItem = (grItemRaw || "").toString().length > 0;
    const hasRequiredOrigin = !showOrderType || !orderTypeRequired || (orderType || "").trim().length > 0;
    const hasDeliveryNote = (deliveryNote || "").trim().length > 0;
    const hasQty = (qty || "").trim().length > 0;

    if (!hasOrder || !hasLine || !hasItem) return false;
    if (!hasRequiredOrigin) return false;
    if (!hasDeliveryNote) return false;
    if (!hasQty) return false;

    return true;
  }, [orderNo, orderPos, grItemRaw, showOrderType, orderTypeRequired, orderType, deliveryNote, qty]);

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

  const originColorStyle = (origin: string) => {
    const o = (origin || "").toLowerCase();
    if (o.includes("production")) return { bg: "#2db329", text: "#ffffff" };
    if (o.includes("purchase")) return { bg: "#9ed927", text: "#1a1a1a" };
    if (o.includes("sales")) return { bg: "#1d5f8a", text: "#ffffff" };
    if (o.includes("transfer")) return { bg: "#ffd500", text: "#1a1a1a" };
    return { bg: "#2db329", text: "#ffffff" };
  };

  useEffect(() => {
    orderNoRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;

    const readParams = async () => {
      const { data, error } = await supabase.functions.invoke("gsi-get-params", {
        body: { company: "4000" },
      });
      if (!active) return;
      if (error || !data || !data.ok) return;
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

  const loadReceivedLines = async (ord: string, originSelected: string): Promise<number> => {
    if (!ord || !originSelected || confirmOnly) {
      setReceivedLinesCount(0);
      setReceivedLines([]);
      return 0;
    }
    setIsSubmitting(true);
    const { data, error } = await supabase.functions.invoke("ln-received-lines", {
      body: {
        orderNumber: ord,
        origin: originSelected,
        language: locale,
        company: "4000",
      },
    });
    setIsSubmitting(false);
    if (error || !data || !data.ok) {
      setReceivedLinesCount(0);
      setReceivedLines([]);
      return 0;
    }
    const count = Number(data.count || 0);
    const value = Array.isArray(data.value) ? data.value : [];
    setReceivedLinesCount(count);
    setReceivedLines(value);
    return count;
  };

  const confirmReceiptLine = async (opts: {
    transactionId?: string;
    etag?: string;
    origin: string;
    order: string;
    position: number;
    sequence: number;
    set: number;
    packingSlip: string;
    receiptNumber?: string;
    receiptLine?: number;
    quantity?: number;
    unit?: string;
    lot?: string;
    businessPartnerLot?: string;
  }) => {
    setIsSubmitting(true);
    const tid = showLoading(trans.pleaseWait);

    const { data, error } = await supabase.functions.invoke("ln-confirm-receipt", {
      body: {
        transactionId: opts.transactionId,
        etag: opts.etag,
        origin: opts.origin,
        order: opts.order,
        position: opts.position,
        sequence: opts.sequence,
        set: opts.set,
        packingSlip: opts.packingSlip,
        receiptNumber: opts.receiptNumber,
        receiptLine: opts.receiptLine,
        quantity: typeof opts.quantity === "number" ? opts.quantity : Number((qty || "").trim() || "0"),
        unit: (opts.unit || orderUnit || "").trim(),
        lot: (opts.lot || lot || "").trim(),
        businessPartnerLot: (opts.businessPartnerLot || bpLot || "").trim(),
        language: locale,
        company: "4000",
      },
    });
    dismissToast(tid as unknown as string);
    setIsSubmitting(false);
    if (error || !data || !data.ok) {
      showError("Confirm failed");
      return;
    }
    showSuccess("Confirmed");
    const ord = (orderNo || "").trim();
    const originSelected = (orderType || "").trim();
    if (ord && originSelected) {
      const count = await loadReceivedLines(ord, originSelected);
      if (count <= 0) {
        setReceivedLinesOpen(false);
      }
    }
  };

  const confirmAllReceivedLines = async () => {
    if (receivedLines.length === 0) return;

    setIsSubmitting(true);
    const tid = showLoading(trans.pleaseWait);

    const originSelected = (orderType || "").trim();
    const ord = (orderNo || "").trim();
    let confirmed = 0;

    for (const ln of receivedLines) {
      const pos = Number(ln?.OrderLine ?? ln?.ReceiptLine ?? 0);
      const seq = Number(ln?.OrderSequence ?? 0) || 1;
      const setNum = Number(ln?.OrderSet ?? 0) || 1;
      const pSlip = typeof ln?.PackingSlip === "string" ? ln.PackingSlip : "";

      const receipt = typeof ln?.ReceiptNumber === "string" ? ln.ReceiptNumber : (typeof ln?.Receipt === "string" ? ln.Receipt : "");
      const receiptLine = Number(ln?.ReceiptLine ?? ln?.OrderLine ?? 0);
      const lineQty = Number(ln?.ReceivedQuantityInReceiptUnit ?? 0);
      const lineUnit = typeof ln?.ReceiptUnit === "string" ? ln.ReceiptUnit : "";

      const lotCode =
        (typeof ln?.Lot === "string" && ln.Lot) ||
        (typeof ln?.LotByWarehouseRef?.Lot === "string" && ln.LotByWarehouseRef.Lot) ||
        "";
      const bpLotCode = (typeof ln?.BusinessPartnersLotCode === "string" && ln.BusinessPartnersLotCode) || "";

      const { data, error } = await supabase.functions.invoke("ln-confirm-receipt", {
        body: {
          origin: originSelected,
          order: ord,
          position: pos,
          sequence: seq,
          set: setNum,
          packingSlip: pSlip,
          receiptNumber: receipt,
          receiptLine,
          quantity: lineQty,
          unit: lineUnit,
          lot: (lotCode || lot || "").trim(),
          businessPartnerLot: (bpLotCode || bpLot || "").trim(),
          language: locale,
          company: "4000",
        },
      });

      if (error || !data || !data.ok) {
        showError("Confirm failed");
        break;
      } else {
        confirmed++;
      }
    }

    dismissToast(tid as unknown as string);
    setIsSubmitting(false);

    if (confirmed === receivedLines.length) {
      showSuccess("All confirmed");
    } else {
      showSuccess(`${confirmed}/${receivedLines.length} confirmed`);
    }

    if (ord && originSelected) {
      const count = await loadReceivedLines(ord, originSelected);
      if (count <= 0) {
        setReceivedLinesOpen(false);
      }
    }
  };

  useEffect(() => {
    const ord = (orderNo || "").trim();
    const originSelected = (orderType || "").trim();
    if (!confirmOnly && ord && originSelected) {
      void loadReceivedLines(ord, originSelected);
    } else {
      setReceivedLinesCount(0);
      setReceivedLines([]);
    }
  }, [orderNo, orderType, confirmOnly, locale]);

  useEffect(() => {
    const ord = (orderNo || "").trim();
    const ln = (orderPos || "").trim();
    if (ord && ln && (orderType || "").trim()) {
      void checkOrder(ord, ln);
    }
  }, [orderType]);

  const checkOrder = async (ord: string, lineVal?: string) => {
    const trimmed = (ord || "").trim();
    if (!trimmed) return;
    const lineTrim = (lineVal || "").trim();
    const originKey = (orderType || "").trim() || "";
    if (lastCheckedOrder === `${trimmed}|${lineTrim}|${originKey}`) return;

    const tid = showLoading(trans.pleaseWait);
    const originForFilter = (orderType || "").trim() ? orderType : undefined;
    const { data, error } = await supabase.functions.invoke("ln-warehousing-orders", {
      body: {
        orderNumber: trimmed,
        line: lineTrim ? Number(lineTrim) : undefined,
        orderOrigin: originForFilter,
        language: locale,
        company: "4000",
      },
    });
    // Keep spinner visible while we hydrate additional data below; dismiss on each return path.
    if (error || !data || !data.ok) {
      dismissToast(tid as unknown as string);

      setShowOrderType(false);
      setOrderType("");
      setOrderTypeOptions([]);
      setOrderTypeDisabled(true);
      setOrderTypeRequired(false);
      setLastCheckedOrder(null);
      setInboundLinesAll([]);
      return;
    }

    // Abort if user changed/cleared the order while we were loading
    const ordNow = (orderNo || "").trim();
    const lnNow = (orderPos || "").trim();
    // Abort only if the order number changed; allow line mismatches (React state may not have flushed yet)
    if (ordNow !== trimmed) {
      dismissToast(tid as unknown as string);
      return;
    }

    const rawValues = Array.isArray(data.raw?.value) ? data.raw.value : [];
    const mappedLines: Array<{ Line: number; Item?: string; ItemDesc?: string; tbrQty?: number; orderUnit?: string }> =
      rawValues.map((v: any) => ({
        Line: Number(v?.Line ?? 0),
        Item: typeof v?.Item === "string" ? v.Item : (typeof v?.ItemRef?.Item === "string" ? v.ItemRef.Item : undefined),
        ItemDesc: typeof v?.ItemRef?.Description === "string" ? v.ItemRef.Description : undefined,
        tbrQty: typeof v?.ToBeReceivedQuantity === "number" ? v.ToBeReceivedQuantity : undefined,
        orderUnit: typeof v?.OrderUnit === "string" ? v.OrderUnit : (typeof v?.OrderUnitRef?.Unit === "string" ? v.OrderUnitRef.Unit : undefined),
      }))
      .filter((x) => Number.isFinite(x.Line));

    // Fallback: if no open inbound lines were found, try received lines by origin(s) to avoid false "Order not found"
    if (mappedLines.length === 0) {
      const tryOrigins = (orderType || lotsOrigin)
        ? [ (orderType || lotsOrigin).trim() ]
        : [ "Purchase", "Sales", "Transfer", "TransferManual", "JSCProduction" ];
      for (const originCandidate of tryOrigins) {
        if (!originCandidate) continue;
        const count = await loadReceivedLines(trimmed, originCandidate);
        if (count > 0) {
          // We have received lines; show Order Type chip and enable the Received Lines button
          setOrderType(originCandidate);
          setShowOrderType(true);
          setOrderTypeOptions([]);
          setOrderTypeDisabled(true);
          setOrderTypeRequired(false);
          setInboundLinesAll([]);
          setInboundLinesGrouped([]);
          setHasMultipleLines(false);
          setLastCheckedOrder(`${trimmed}|${lineTrim}|${originCandidate}`);
          dismissToast(tid as unknown as string);
          return;
        }

      }
      // No open lines and no received lines found for known origins → show not found
      setShowOrderType(false);
      setOrderType("");
      setOrderTypeOptions([]);
      setOrderTypeDisabled(true);
      setOrderTypeRequired(false);
      setInboundLinesAll([]);
      setInboundLinesGrouped([]);
      setHasMultipleLines(false);
      setLastCheckedOrder(null);
      showError("Order not found");
      setTimeout(() => orderNoRef.current?.focus(), 0);
      dismissToast(tid as unknown as string);
      return;
    }

    if (!lineTrim) {
      setInboundLinesAll(mappedLines);
      setHasMultipleLines(mappedLines.length > 1);
    }

    if (lineTrim) {
      const lnNum = Number(lineTrim);
      const picked = mappedLines.find((x) => x.Line === lnNum) || mappedLines[0];
      const pickedRaw = rawValues.find((rv: any) => Number(rv?.Line) === lnNum) || rawValues[0];
      if (picked) {
        const itemCode = (picked.Item || "").trim();
        const itemRaw = (picked.Item || "");
        setGrItem(itemCode);
        setQty(picked.tbrQty != null ? String(picked.tbrQty) : "");
        setOrderUnit(picked.orderUnit || "");
        setGrItemDesc(picked.ItemDesc || "");
        setGrItemRaw(itemRaw);

        const bpCode =
          (() => {
            const candidates = [
              pickedRaw?.BuyfromBusinessPartner,
              pickedRaw?.BuyFromBusinessPartner,
              pickedRaw?.ShipfromBusinessPartner,
              pickedRaw?.ShipFromBusinessPartner,
              pickedRaw?.ShipfromBusinessPartnerRef?.BusinessPartner,
              pickedRaw?.ShipFromBusinessPartnerRef?.BusinessPartner,
            ];
            const first = candidates.find((v: any) => typeof v === "string" && v.trim().length > 0);
            return (first || "").trim();
          })();
        setBuyFromBusinessPartner(bpCode);

        const isTracked = await fetchLotTracking(itemRaw || "");
        const originCandidate =
          (typeof pickedRaw?.OrderOrigin === "string" && pickedRaw.OrderOrigin) || orderType || "";

        if (isTracked) {
          const originLower = (originCandidate || "").toLowerCase();
          if (originLower.includes("purchase")) {
            if ((bpCode || "").trim()) {
              await checkExistingLots(itemRaw, originCandidate, bpCode);
            } else {
              setLotsAvailableCount(0);
              setExistingLots([]);
              setLotsOrigin(originCandidate);
            }
          } else {
            await checkExistingLots(itemRaw, originCandidate);
          }
        } else {
          setLotsAvailableCount(0);
          setExistingLots([]);
          setLotsOrigin("");
        }

        setTimeout(() => {
          if (isTracked) {
            lotRef.current?.focus();
          } else {
            deliveryNoteRef.current?.focus();
          }
        }, 50);
      }
    }

    dismissToast(tid as unknown as string);

    if (!lineTrim) {

      setInboundLinesAll(mappedLines);
    }

    if (!lineTrim && mappedLines.length === 1 && !suppressAutoFillLine) {
      const singleLineStr = String(mappedLines[0].Line);
      setOrderPos(singleLineStr);
      setLastCheckedOrder(`${trimmed}|${singleLineStr}|${originKey}`);
      // Dismiss current spinner before recursive call.
      dismissToast(tid as unknown as string);
      await checkOrder(trimmed, singleLineStr);
      return;
    }

    const origins: string[] = rawValues
      .map((v: any) => (v?.OrderOrigin ? String(v.OrderOrigin) : null))
      .filter((v: string | null): v is string => !!v);
    const uniqueOrigins = Array.from(new Set(origins.length ? origins : (data.origin ? [String(data.origin)] : [])));

    if (uniqueOrigins.length === 1) {
      const origin = uniqueOrigins[0] || (data.origin ? String(data.origin) : "");
      setOrderType(origin || "");
      setOrderTypeOptions([]);
      setOrderTypeDisabled(true);
      setOrderTypeRequired(false);
      setShowOrderType(true);

      if (!lineTrim) {
        setInboundLinesAll(mappedLines);
        setHasMultipleLines(mappedLines.length > 1);
        // Only auto-open the picker if allowed
        if (mappedLines.length > 1 && allowLinePickerAutoOpen) {
          setLinePickerOpen(true);
        }
      }

      setLastCheckedOrder(`${trimmed}|${lineTrim}|${origin || ""}`);
      dismissToast(tid as unknown as string);
      return;
    }

    if (uniqueOrigins.length > 1) {
      const grouped = uniqueOrigins.map((org) => {
        const linesForOrigin = rawValues
          .filter((rv: any) => String(rv?.OrderOrigin || "") === org)
          .map((v: any) => ({
            Line: Number(v?.Line ?? 0),
            Item: typeof v?.Item === "string" ? v.Item : (typeof v?.ItemRef?.Item === "string" ? v.ItemRef.Item : undefined),
            ItemDesc: typeof v?.ItemRef?.Description === "string" ? v.ItemRef.Description : undefined,
            tbrQty: typeof v?.ToBeReceivedQuantity === "number" ? v.ToBeReceivedQuantity : undefined,
            orderUnit: typeof v?.OrderUnit === "string" ? v.OrderUnit : (typeof v?.OrderUnitRef?.Unit === "string" ? v.OrderUnitRef.Unit : undefined),
          }))
          .filter((x) => Number.isFinite(x.Line));
        return { origin: org, lines: linesForOrigin };
      });

      setInboundLinesGrouped(grouped);
      setInboundLinesAll(mappedLines);
      setHasMultipleLines(mappedLines.length > 1);

      setShowOrderType(false);
      setOrderType("");
      setOrderTypeOptions([]);
      setOrderTypeDisabled(true);
      setOrderTypeRequired(false);

      // Only auto-open the grouped picker if allowed
      if (!lineTrim && allowLinePickerAutoOpen) {
        setLinePickerOpen(true);
      }
      setLastCheckedOrder(`${trimmed}|${lineTrim}|`);
      return;
    }

    setShowOrderType(false);
    setOrderType("");
    setOrderTypeOptions([]);
    setOrderTypeDisabled(true);
    setOrderTypeRequired(false);
    setLastCheckedOrder(`${trimmed}|${lineTrim}|${originKey}`);
    dismissToast(tid as unknown as string);
  };

  const checkExistingLots = async (itm: string, originStr: string, bp?: string) => {
    const origin = (originStr || "").toString();
    if (!itm || !origin) {
      setLotsAvailableCount(0);
      setExistingLots([]);
      setLotsOrigin("");
      return;
    }
    if (origin.toLowerCase().includes("purchase") && !(bp || "").trim()) {
      setLotsAvailableCount(0);
      setExistingLots([]);
      setLotsOrigin(origin);
      return;
    }
    const { data, error } = await supabase.functions.invoke("ln-item-existing-lots", {
      body: {
        item: itm,
        origin,
        buyFromBusinessPartner: (bp || "").trim() || undefined,
        language: locale,
        company: "4000",
      },
    });
    if (error || !data || !data.ok) {
      setLotsAvailableCount(0);
      setExistingLots([]);
      setLotsOrigin(origin);
      return;
    }
    const value = Array.isArray(data.value) ? data.value : [];
    const count = Number(data.count ?? value.length ?? 0);
    setLotsAvailableCount(count);
    setExistingLots(value);
    setLotsOrigin(origin);
  };

  const fetchLotTracking = async (rawItem: string): Promise<boolean> => {
    const itm = (rawItem || "").toString();
    if (!itm) {
      setLotTracking(false);
      return false;
    }
    const { data } = await supabase.functions.invoke("ln-item-lot-tracking", {
      body: { item: itm, language: locale, company: "4000" },
    });
    if (data && data.ok) {
      setLotTracking(Boolean(data.lotTracking));
      return Boolean(data.lotTracking);
    } else {
      setLotTracking(false);
      return false;
    }
  };

  const validateManualLot = async (enteredLot: string) => {
    const lotValue = (enteredLot || "").trim();
    if (!lotValue) return true;

    const origin = (orderType || lotsOrigin || "").toString();
    const item = (grItemRaw || "").toString();
    if (!origin || !item) return true;

    const isPurchase = origin.toLowerCase().includes("purchase");
    const bp = isPurchase ? (buyFromBusinessPartner || "").trim() : "";
    if (isPurchase && !bp) return true;

    const { data, error } = await supabase.functions.invoke("ln-item-existing-lots", {
      body: {
        item,
        origin,
        buyFromBusinessPartner: isPurchase ? bp : undefined,
        lot: lotValue,
        language: locale,
        company: "4000",
      },
    });

    if (error || !data || !data.ok) {
      return true;
    }

    return Number(data.count || 0) > 0;
  };

  const handleConfirmOnly = async () => {
    const ready =
      (orderNo || "").trim() &&
      (orderPos || "").trim() &&
      (grItemRaw || "").toString() &&
      (deliveryNote || "").trim() &&
      (qty || "").trim() &&
      (!showOrderType || !orderTypeRequired || (orderType || "").trim());
    if (!ready) return;

    const preservedOrderNo = (orderNo || "").trim();
    const preservedOrderType = (orderType || "").trim();

    const originToSend = (orderType || lotsOrigin || "").trim();
    const tid = showLoading(trans.pleaseWait);
    setIsSubmitting(true);

    const { data: recvData, error: recvError } = await supabase.functions.invoke("ln-receive-goods", {
      body: {
        OrderOrigin: originToSend,
        Order: (orderNo || "").trim(),
        Position: Number((orderPos || "").trim()),
        Sequence: 1,
        Set: 1,
        PackingSlip: (deliveryNote || "").trim(),
        Lot: (lot || "").trim(),
        BusinessPartnerLot: (bpLot || "").trim(),
        Quantity: Number((qty || "").trim()),
        Unit: (orderUnit || "").trim(),
        Confirm: "No",
        FromWebservice: "Yes",
        language: locale,
        company: "4000",
      },
    });

    if (recvError || !recvData || !recvData.ok) {
      dismissToast(tid as unknown as string);
      setIsSubmitting(false);
      showError(trans.loadingDetails);
      return;
    }

    const rb: any = recvData.body;
    let receiptNumber = "";
    let receiptLine = 0;

    if (rb && typeof rb === "object") {
      if (typeof rb.ReceiptNumber === "string") receiptNumber = rb.ReceiptNumber;
      else if (typeof rb.Receipt === "string") receiptNumber = rb.Receipt;

      if (typeof rb.ReceiptLine === "number") receiptLine = Number(rb.ReceiptLine);

      if ((!receiptNumber || !receiptLine) && Array.isArray(rb.value) && rb.value.length > 0) {
        const first = rb.value[0];
        if (typeof first?.ReceiptNumber === "string") receiptNumber = first.ReceiptNumber;
        else if (typeof first?.Receipt === "string") receiptNumber = first.Receipt;
        if (typeof first?.ReceiptLine === "number") receiptLine = Number(first.ReceiptLine);
        if (!receiptLine && typeof first?.OrderLine === "number") receiptLine = Number(first.OrderLine);
      }

      if (!receiptLine && typeof rb.OrderLine === "number") receiptLine = Number(rb.OrderLine);
    }

    const { data: confData, error: confError } = await supabase.functions.invoke("ln-confirm-receipt", {
      body: {
        origin: originToSend,
        order: (orderNo || "").trim(),
        position: Number((orderPos || "").trim()),
        sequence: 1,
        set: 1,
        packingSlip: (deliveryNote || "").trim(),
        quantity: Number((qty || "").trim()),
        unit: (orderUnit || "").trim(),
        lot: (lot || "").trim(),
        businessPartnerLot: (bpLot || "").trim(),
        receiptNumber: receiptNumber || "",
        receiptLine: receiptLine || 0,
        language: locale,
        company: "4000",
      },
    });

    dismissToast(tid as unknown as string);
    setIsSubmitting(false);

    if (confError || !confData || !confData.ok) {
      showError("Confirm failed");
      return;
    }

    showSuccess("Confirmed");

    setOrderNo(preservedOrderNo);
    setOrderType(preservedOrderType);
    setShowOrderType(Boolean(preservedOrderType));
    if (preservedOrderType) {
      setOrderTypeDisabled(true);
      setOrderTypeOptions([]);
      setOrderTypeRequired(false);
    }

    // Prevent auto-opening the picker after confirm
    setAllowLinePickerAutoOpen(false);

    setLastCheckedOrder(null);
    setSuppressAutoFillLine(false);
    setInboundLinesAll([]);
    setInboundLinesGrouped([]);
    setHasMultipleLines(false);
    setLinePickerOpen(false);

    setOrderPos("");
    setGrItem("");
    setGrItemDesc("");
    setQty("");
    setOrderUnit("");
    setGrItemRaw("");
    setLot("");
    setBpLot("");
    setDeliveryNote("");
    setLotTracking(false);
    setBuyFromBusinessPartner("");
    setLotsAvailableCount(0);
    setExistingLots([]);
    setLotsOrigin("");

    setTimeout(() => orderPosRef.current?.focus(), 0);
  };

  const handleReceive = async () => {
    if (confirmOnly) return;
    const ready =
      (orderNo || "").trim() &&
      (orderPos || "").trim() &&
      (grItemRaw || "").toString() &&
      (deliveryNote || "").trim() &&
      (qty || "").trim() &&
      (!showOrderType || !orderTypeRequired || (orderType || "").trim());
    if (!ready) return;

    const preservedOrderNo = (orderNo || "").trim();
    const preservedOrderType = (orderType || "").trim();

    const originToSend = (orderType || lotsOrigin || "").trim();
    const tid = showLoading(trans.pleaseWait);
    setIsSubmitting(true);

    const { data, error } = await supabase.functions.invoke("ln-receive-goods", {
      body: {
        OrderOrigin: originToSend,
        Order: (orderNo || "").trim(),
        Position: Number((orderPos || "").trim()),
        Sequence: 1,
        Set: 1,
        PackingSlip: (deliveryNote || "").trim(),
        Lot: (lot || "").trim(),
        BusinessPartnerLot: (bpLot || "").trim(),
        Quantity: Number((qty || "").trim()),
        Unit: (orderUnit || "").trim(),
        Confirm: "No",
        FromWebservice: "Yes",
        language: locale,
        company: "4000",
      },
    });

    dismissToast(tid as unknown as string);
    setIsSubmitting(false);

    if (error || !data || !data.ok) {
      showError(trans.loadingDetails);
      return;
    }

    showSuccess(trans.receivedSuccessfully);

    setOrderNo(preservedOrderNo);
    setOrderType(preservedOrderType);
    setShowOrderType(Boolean(preservedOrderType));
    if (preservedOrderType) {
      setOrderTypeDisabled(true);
      setOrderTypeOptions([]);
      setOrderTypeRequired(false);
    }

    // Prevent auto-opening the picker after receive
    setAllowLinePickerAutoOpen(false);

    setLastCheckedOrder(null);
    setSuppressAutoFillLine(false);
    setInboundLinesAll([]);
    setInboundLinesGrouped([]);
    setHasMultipleLines(false);
    setLinePickerOpen(false);

    setOrderPos("");
    setGrItem("");
    setGrItemDesc("");
    setQty("");
    setOrderUnit("");
    setGrItemRaw("");
    setLot("");
    setBpLot("");
    setDeliveryNote("");
    setLotTracking(false);
    setBuyFromBusinessPartner("");
    setLotsAvailableCount(0);
    setExistingLots([]);
    setLotsOrigin("");

    if (preservedOrderNo && preservedOrderType) {
      void loadReceivedLines(preservedOrderNo, preservedOrderType);
    }

    setTimeout(() => orderNoRef.current?.focus(), 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/incoming")} />

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

      <div className="mx-auto max-w-md px-4 py-4 pb-24">
        <Card className="rounded-md border-0 bg-transparent shadow-none p-0 space-y-3">
          {showOrderType && (
            orderTypeDisabled ? (
              <div className="space-y-1 mb-4">
                <div className="text-xs font-medium text-gray-700">{trans.incomingOrderTypeLabel}</div>
                <div className="flex items-center justify-between w-full">
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
                  {receivedLinesCount > 0 && (
                    <Button
                      variant="destructive"
                      className="rounded-full px-3 py-1 h-auto text-sm font-semibold shadow-sm"
                      onClick={async () => {
                        const ord = (orderNo || "").trim();
                        const originSelected = (orderType || "").trim();
                        if (ord && originSelected) {
                          await loadReceivedLines(ord, originSelected);
                        }
                        setReceivedLinesOpen(true);
                      }}
                    >
                      {receivedLinesCount} Received Lines
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1 mb-4">
                <div className="text-xs font-medium text-gray-700">
                  {trans.incomingOrderTypeLabel} {orderTypeRequired && <span className="text-red-600">*</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={orderType} onValueChange={(val) => {
                      setOrderType(val);
                      const ord = (orderNo || "").trim();
                      const ln = (orderPos || "").trim();
                      if (ord && ln) {
                        void checkOrder(ord, ln);
                      }
                    }}>
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
                  {receivedLinesCount > 0 && !!orderType && (
                    <Button
                      variant="destructive"
                      className="h-12 px-3"
                      onClick={async () => {
                        const ord = (orderNo || "").trim();
                        const originSelected = (orderType || "").trim();
                        if (ord && originSelected) {
                          await loadReceivedLines(ord, originSelected);
                        }
                        setReceivedLinesOpen(true);
                      }}
                    >
                      {receivedLinesCount} Received Lines
                    </Button>
                  )}
                </div>
              </div>
            )
          )}

          <FloatingLabelInput
            id="incomingOrderNo"
            label={trans.incomingOrderNumberLabel}
            ref={orderNoRef}
            value={orderNo}
            onChange={(e) => {
              const v = e.target.value;
              const parsed = parseOrderLinePair(v);
              setAllowLinePickerAutoOpen(true);
              if (parsed) {
                setOrderNo(parsed.order);
                setOrderPos(parsed.line);
                setSuppressAutoFillLine(false);
                void checkOrder(parsed.order, parsed.line);
              } else {
                setOrderNo(v);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              const parsed = parseOrderLinePair(text);
              setAllowLinePickerAutoOpen(true);
              if (parsed) {
                e.preventDefault();
                setOrderNo(parsed.order);
                setOrderPos(parsed.line);
                setSuppressAutoFillLine(false);
                void checkOrder(parsed.order, parsed.line);
              }
            }}
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
              setAllowLinePickerAutoOpen(true);
              setShowOrderType(false);
              setOrderType("");
              setOrderTypeOptions([]);
              setOrderTypeDisabled(true);
              setOrderTypeRequired(false);
              setLastCheckedOrder(null);
              setSuppressAutoFillLine(false);
              setInboundLinesAll([]);
              setInboundLinesGrouped([]);
              setHasMultipleLines(false);
              setOrderPos("");
              setGrItem("");
              setGrItemDesc("");
              setQty("");
              setOrderUnit("");
              setGrItemRaw("");
              setLotTracking(false);
              setTimeout(() => orderNoRef.current?.focus(), 0);
            }}
          />

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FloatingLabelInput
                id="incomingOrderPos"
                label={trans.incomingOrderPositionLabel}
                ref={orderPosRef}
                value={orderPos}
                onChange={(e) => {
                  const v = e.target.value;
                  const parsed = parseOrderLinePair(v);
                  if (parsed) {
                    setOrderNo(parsed.order);
                    setOrderPos(parsed.line);
                    setSuppressAutoFillLine(false);
                    void checkOrder(parsed.order, parsed.line);
                  } else {
                    setOrderPos(v);
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const parsed = parseOrderLinePair(text);
                  if (parsed) {
                    e.preventDefault();
                    setOrderNo(parsed.order);
                    setOrderPos(parsed.line);
                    setSuppressAutoFillLine(false);
                    void checkOrder(parsed.order, parsed.line);
                  }
                }}
                onBlur={() => {
                  const ord = orderNo.trim();
                  const ln = orderPos.trim();
                  if (ord && ln) {
                    void checkOrder(ord, ln);
                  } else if (ord) {
                    void checkOrder(ord);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const ord = orderNo.trim();
                    const ln = orderPos.trim();
                    if (ord && ln) {
                      void checkOrder(ord, ln);
                    } else if (ord) {
                      void checkOrder(ord);
                    }
                  }
                }}
                onClear={() => {
                  setOrderPos("");
                  setSuppressAutoFillLine(true);
                  setGrItem("");
                  setGrItemDesc("");
                  setQty("");
                  setOrderUnit("");
                  setGrItemRaw("");
                  setLotTracking(false);
                  setBuyFromBusinessPartner("");
                  setLotsAvailableCount(0);
                  setExistingLots([]);
                  setLotsOrigin("");
                }}
              />
            </div>
            {hasMultipleLines && !!(orderType || "").trim() && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                aria-label="Search lines"
                onClick={async () => {
                  const ord = orderNo.trim();
                  const originSelected = (orderType || "").trim();
                  if (!originSelected) {
                    showError("Select order type first");
                    return;
                  }
                  if (ord) {
                    await checkOrder(ord);
                  }
                  setLinePickerOpen(true);
                }}
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>

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
                  {inboundLinesGrouped.length > 0 ? (
                    inboundLinesGrouped.map((grp, gidx) => (
                      <div key={`grp-${grp.origin}-${gidx}`} className="mb-3">
                        <div className="bg-white px-3 py-2 border-b">
                          {(() => {
                            const s = originColorStyle(grp.origin);
                            return (
                              <span
                                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                                style={{ backgroundColor: s.bg, color: s.text }}
                              >
                                {formatOriginLabel(grp.origin)}
                              </span>
                            );
                          })()}
                        </div>
                        {grp.lines.length === 0 ? (
                          <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                        ) : (
                          grp.lines.map((ln, idx) => (
                            <button
                              key={`${grp.origin}-${ln.Line}-${idx}`}
                              type="button"
                              className="w-full text-left px-3 py-2 rounded-md border mb-2 bg-gray-50 hover:bg-gray-100"
                              onClick={async () => {
                                const ord = (orderNo || "").trim();
                                const lineStr = String(ln.Line);
                                setOrderType(grp.origin);
                                setOrderPos(lineStr);
                                setSuppressAutoFillLine(false);
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
                    ))
                  ) : (
                    <>
                      {inboundLinesAll.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                      ) : (
                        inboundLinesAll.map((ln, idx) => (
                          <button
                            key={`${ln.Line}-${idx}`}
                            type="button"
                            className="w-full text-left px-3 py-2 rounded-md border mb-2 bg-gray-50 hover:bg-gray-100"
                            onClick={async () => {
                              const ord = (orderNo || "").trim();
                              const lineStr = String(ln.Line);
                              setOrderPos(lineStr);
                              setSuppressAutoFillLine(false);
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
                    </>
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
            value={[grItem, grItemDesc].filter(Boolean).join(" - ")}
            disabled
          />

          {lotTracking && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <FloatingLabelInput
                    id="incomingLot"
                    label={trans.lotLabel}
                    value={lot}
                    onChange={(e) => setLot(e.target.value)}
                    onClear={() => setLot("")}
                    ref={lotRef}
                    onBlur={() => {
                      const next = async () => {
                        const entered = (lot || "").trim();
                        if (!entered) return;

                        const ok = await validateManualLot(entered);
                        if (!ok) {
                          showError("Lot does not exist");
                          setLot("");
                          setTimeout(() => lotRef.current?.focus(), 0);
                          return;
                        }

                        if (isPurchaseOrigin) {
                          bpLotRef.current?.focus();
                        } else {
                          deliveryNoteRef.current?.focus();
                        }
                      };
                      void next();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const next = async () => {
                          const entered = (lot || "").trim();
                          if (!entered) return;

                          const ok = await validateManualLot(entered);
                          if (!ok) {
                            showError("Lot does not exist");
                            setLot("");
                            setTimeout(() => lotRef.current?.focus(), 0);
                            return;
                          }

                          if (isPurchaseOrigin) {
                            bpLotRef.current?.focus();
                          } else {
                            deliveryNoteRef.current?.focus();
                          }
                        };
                        void next();
                      }
                    }}
                  />
                </div>
                {lotsAvailableCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    aria-label="Lots by Item"
                    onClick={() => setLotsPickerOpen(true)}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {isPurchaseOrigin && (
                <FloatingLabelInput
                  id="incomingBusinessPartnerLot"
                  label={trans.businessPartnerLotLabel}
                  value={bpLot}
                  onChange={(e) => setBpLot(e.target.value)}
                  onClear={() => setBpLot("")}
                  ref={bpLotRef}
                  onBlur={() => {
                    if ((bpLot || "").trim()) {
                      deliveryNoteRef.current?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if ((bpLot || "").trim()) {
                        deliveryNoteRef.current?.focus();
                      }
                    }
                  }}
                />
              )}

              <Dialog open={lotsPickerOpen} onOpenChange={setLotsPickerOpen}>
                <DialogPortal>
                  <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
                  <DialogPrimitive.Content
                    className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg"
                  >
                    <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
                      <div className="flex flex-col">
                        <span>Lots by Item</span>
                        {(lotsOrigin || "").toLowerCase().includes("purchase") && (buyFromBusinessPartner || "").trim() && (
                          <span className="mt-1 text-xs text-gray-200">
                            Business Partner: {(buyFromBusinessPartner || "").trim()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-auto">
                      {(() => {
                        const isPurchase = (lotsOrigin || "").toLowerCase().includes("purchase");
                        return (
                          <div className="bg-white px-3 py-2 border-b">
                            {isPurchase ? (
                              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                <div className="text-xs font-semibold text-gray-600">Lot</div>
                                <div className="text-xs font-semibold text-gray-600 text-right">Businesspartner Lot</div>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-gray-600">Lot</div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="p-2">
                        {existingLots.length === 0 ? (
                          <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                        ) : (
                          existingLots.map((ln: any, idx: number) => {
                            const lotCode =
                              (typeof ln?.Lot === "string" && ln.Lot) ||
                              (typeof ln?.LotByWarehouseRef?.Lot === "string" && ln.LotByWarehouseRef.Lot) ||
                              "";
                            const bpLotCode =
                              (typeof ln?.BusinessPartnersLotCode === "string" && ln.BusinessPartnersLotCode) ||
                              "";
                            const isPurchase = (lotsOrigin || "").toLowerCase().includes("purchase");
                            return (
                              <button
                                key={`${lotCode || "lot"}-${idx}`}
                                type="button"
                                className="w-full text-left px-3 py-2 rounded-md border mb-2 bg-gray-50 hover:bg-gray-100"
                                onClick={() => {
                                  const selectedLot = (lotCode || "").trim();
                                  const selectedBpLot = isPurchase ? (bpLotCode || "").trim() : "";
                                  if (selectedLot) setLot(selectedLot);
                                  if (selectedBpLot) setBpLot(selectedBpLot);
                                  setLotsPickerOpen(false);
                                  if (isPurchase) {
                                    if (selectedBpLot) {
                                      deliveryNoteRef.current?.focus();
                                    } else {
                                      bpLotRef.current?.focus();
                                    }
                                  } else {
                                    deliveryNoteRef.current?.focus();
                                  }
                                }}
                              >
                                {isPurchase ? (
                                  <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                    <div className="font-mono text-sm sm:text-base text-gray-900 break-all">
                                      {lotCode || "-"}
                                    </div>
                                    <div className="font-mono text-xs sm:text-sm text-gray-900 text-right whitespace-nowrap">
                                      {bpLotCode}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="font-mono text-sm sm:text-base text-gray-900 break-all">
                                    {lotCode || "-"}
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
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
            </>
          )}

          <div className="mb-4">
            <FloatingLabelInput
              id="incomingDeliveryNote"
              label={`${trans.incomingDeliveryNoteLabel} *`}
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              onClear={() => setDeliveryNote("")}
              ref={deliveryNoteRef}
              onBlur={() => {
                if ((deliveryNote || "").trim()) {
                  qtyRef.current?.focus();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if ((deliveryNote || "").trim()) {
                    qtyRef.current?.focus();
                  }
                }
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FloatingLabelInput
                id="incomingQty"
                label={trans.quantityLabel}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onClear={() => setQty("")}
                ref={qtyRef}
              />
            </div>
            <div className="w-32">
              <FloatingLabelInput
                id="incomingUnit"
                label={trans.unitLabel}
                value={orderUnit}
                disabled
              />
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={receivedLinesOpen} onOpenChange={setReceivedLinesOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg"
          >
            <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
              <div className="flex items-center justify-between pr-8">
                <span>{receivedLinesCount} Received Lines</span>
                <Button
                  className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white rounded-full"
                  variant="default"
                  disabled={isSubmitting || receivedLinesCount <= 0}
                  onClick={confirmAllReceivedLines}
                >
                  Confirm All
                </Button>
              </div>
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {receivedLines.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
              ) : (
                receivedLines.map((ln: any, idx: number) => {
                  const receipt = typeof ln?.ReceiptNumber === "string" ? ln.ReceiptNumber : (typeof ln?.Receipt === "string" ? ln.Receipt : "");
                  const receiptLine = Number(ln?.ReceiptLine ?? ln?.OrderLine ?? 0);
                  const item = typeof ln?.Item === "string" ? ln.Item : (typeof ln?.ItemRef?.Item === "string" ? ln.ItemRef.Item : "");
                  const desc = typeof ln?.ItemRef?.Description === "string" ? ln.ItemRef.Description : "";
                  const lineQty = Number(ln?.ReceivedQuantityInReceiptUnit ?? 0);
                  const lineUnit = typeof ln?.ReceiptUnit === "string" ? ln.ReceiptUnit : "";
                  const txId = typeof ln?.gsiTransactionID === "string" ? ln.gsiTransactionID : "";
                  const etag = typeof ln?.gsiEtag === "string" ? ln.gsiEtag : "";
                  const originSelected = (orderType || "").trim();
                  const ord = (orderNo || "").trim();
                  const pos = Number(ln?.OrderLine ?? ln?.ReceiptLine ?? 0);
                  const seq = Number(ln?.OrderSequence ?? 0);
                  const setNum = Number(ln?.OrderSet ?? 0);
                  const pSlip = typeof ln?.PackingSlip === "string" ? ln.PackingSlip : "";

                  const lotCode =
                    (typeof ln?.Lot === "string" && ln.Lot) ||
                    (typeof ln?.LotByWarehouseRef?.Lot === "string" && ln.LotByWarehouseRef.Lot) ||
                    "";
                  const bpLotCode = (typeof ln?.BusinessPartnersLotCode === "string" && ln.BusinessPartnersLotCode) || "";

                  return (
                    <div
                      key={`${receipt}-${receiptLine}-${idx}`}
                      className="w-full text-left px-3 py-2 rounded-md border mb-2 bg-gray-50"
                    >
                      <div className="grid grid-cols-[1fr_140px] gap-3 items-start">
                        <div className="flex flex-col">
                          <div className="font-mono text-sm sm:text-base text-gray-900 break-all">
                            {item || "-"}
                          </div>
                          {desc && <div className="text-xs text-gray-700">{desc}</div>}
                          <div className="mt-1 text-xs text-gray-600">
                            Receipt: {receipt} · Line: {receiptLine}
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className="font-mono text-sm sm:text-base text-gray-900 text-right whitespace-nowrap">
                            {lineQty} {lineUnit}
                          </div>
                          <Button
                            className="mt-2 h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                            variant="default"
                            onClick={async () => {
                              await confirmReceiptLine({
                                transactionId: txId || undefined,
                                etag: etag || undefined,
                                origin: originSelected,
                                order: ord,
                                position: pos,
                                sequence: (seq || 1),
                                set: (setNum || 1),
                                packingSlip: pSlip,
                                receiptNumber: receipt,
                                receiptLine: receiptLine,
                                quantity: lineQty,
                                unit: lineUnit,
                                lot: (lotCode || lot || "").trim(),
                                businessPartnerLot: (bpLotCode || bpLot || "").trim(),
                              });
                            }}
                          >
                            {trans.incomingConfirm}
                          </Button>

                        </div>
                      </div>
                    </div>
                  );
                })
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

      <div className="fixed inset-x-0 bottom-0 bg-white border-t">
        <div className="mx-auto max-w-md px-3 py-3">
          <Button
            className="h-12 w-full"
            variant={actionEnabled && !isSubmitting ? "destructive" : "secondary"}
            disabled={!actionEnabled || isSubmitting}
            onClick={() => {
              if (confirmOnly) {
                void handleConfirmOnly();
              } else {
                void handleReceive();
              }
            }}
          >
            {confirmOnly ? "CONFIRM" : "Receive"}
          </Button>
        </div>
      </div>

      {isSubmitting && <ScreenSpinner />}

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