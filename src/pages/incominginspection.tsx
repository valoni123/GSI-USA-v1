"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, LogOut, User, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InspectionResultsDialog from "@/components/InspectionResultsDialog";
import InspectionLinePickerDialog from "@/components/InspectionLinePickerDialog";
import SignOutConfirm from "@/components/SignOutConfirm";
import BackButton from "@/components/BackButton";
import ReasonPickerDialog from "@/components/ReasonPickerDialog";
import { supabase } from "@/integrations/supabase/client";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { t, type LanguageKey } from "@/lib/i18n";
import { showSuccess, showLoading, dismissToast, showError } from "@/utils/toast";

const IncomingInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [fullName, setFullName] = useState<string>("");
  const [headerOrder, setHeaderOrder] = useState<string>("");
  const [headerOrigin, setHeaderOrigin] = useState<string>("");
  // Dynamic label for the scan field
  const [scanLabel, setScanLabel] = useState<string>(trans.inspectionQueryLabel);

  // Selected inspection line (from dialog selection); may include __position payload
  const [selectedLine, setSelectedLine] = useState<any | null>(null);

  // Inputs for approval flow
  const [approvedQty, setApprovedQty] = useState<string>("0");
  const [rejectedQty, setRejectedQty] = useState<string>("0");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [allowedReasons, setAllowedReasons] = useState<Array<{ Reason: string; Description?: string }>>([]);
  const [exceedToastShown, setExceedToastShown] = useState<boolean>(false);
  // NEW: track if only one inspection line exists (to show '- 1' when needed)
  const [singleLineOnly, setSingleLineOnly] = useState<boolean>(false);
  // NEW: toggle to approve entire quantity
  const [approveAll, setApproveAll] = useState<boolean>(false);
  const [rejectAll, setRejectAll] = useState<boolean>(false);
  // ADD: line picker state
  const [linePickerOpen, setLinePickerOpen] = useState<boolean>(false);
  const [lineOptions, setLineOptions] = useState<any[]>([]);
  // NEW: lock details until a specific inspection line is chosen
  const [detailsLocked, setDetailsLocked] = useState<boolean>(false);

  // Reset all form and fetched state when starting a new scan
  const resetAllForNewScan = () => {
    setSelectedLine(null);
    setRecords([]);
    setDialogOpen(false);
    setHeaderOrder("");
    setHeaderOrigin("");
    setApprovedQty("0");
    setRejectedQty("0");
    setRejectReason("");
    setReasonDialogOpen(false);
    setAllowedReasons([]);
    setExceedToastShown(false);
    // Ensure details are unlocked for a fresh scan
    setDetailsLocked(false);
  };

  // Helper to extract quantities/units from selected line
  const getInspectQtySU = (r: any) => {
    const src = r?.__position || r;
    const n = Number(src?.QuantityToBeInspectedInStorageUnit ?? r?.QuantityToBeInspectedInStorageUnit ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const getStorageUnit = (r: any) => {
    const src = r?.__position || r;
    return (src?.StorageUnit || r?.StorageUnit || "").toString();
  };
  const getInspection = (r: any) => (r?.Inspection || "").toString();
  const getSequence = (r: any) => {
    const src = r?.__position ? r : r;
    const n = Number(src?.InspectionSequence ?? src?.Sequence ?? src?.OrderSequence ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const getInspectionLine = (r: any) => {
    const src = r?.__position || {};
    const n = Number(src?.InspectionLine ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const getItem = (r: any) => {
    const src = r?.__position || r;
    return (src?.Item || src?.ItemRef?.Item || r?.Item || r?.ItemRef?.Item || "").toString();
  };
  const getItemDesc = (r: any) => {
    const src = r?.__position || r;
    return (src?.ItemRef?.Description || r?.ItemRef?.Description || "").toString();
  };

  const totalToInspect = selectedLine ? getInspectQtySU(selectedLine) : 0;
  const storageUnit = selectedLine ? getStorageUnit(selectedLine) : "";

  // Helpers to extract order-related fields from selectedLine
  const getOrderOrigin = (r: any) => (r?.OrderOrigin || headerOrigin || "").toString();
  const getOrderNumber = (r: any) => (r?.Order || headerOrder || "").toString();
  const getOrderPosition = (r: any) => {
    const src = r?.__position || r;
    const n = Number(
      src?.OrderLine ?? 
      src?.Position ?? 
      r?.OrderLine ?? 
      r?.Line ?? 0
    );
    return Number.isFinite(n) ? n : 0;
  };
  const getOrderSequence = (r: any) => {
    const src = r?.__position || r;
    const n = Number(src?.OrderSequence ?? r?.OrderSequence ?? 1);
    return Number.isFinite(n) ? n : 1;
  };
  const getOrderSet = (r: any) => {
    const src = r?.__position || r;
    const n = Number(src?.OrderSet ?? r?.OrderSet ?? 1);
    return Number.isFinite(n) ? n : 1;
  };
  const getOrderUnit = (r: any) => {
    const src = r?.__position || r;
    return (
      (src?.StorageUnit || "").toString() ||
      (src?.ReceiptUnit || "").toString() ||
      (src?.OrderUnit || "").toString() ||
      (r?.Unit || "").toString()
    );
  };

  const routerLocation = useLocation() as any;
  useEffect(() => {
    const hu = (routerLocation?.state?.initialHandlingUnit || "").toString().trim();
    if (!hu) return;
    setQuery(hu);
    // Defer to let input mount, then trigger blur handler logic to fetch
    const t = setTimeout(() => {
      void handleBlurScan();
    }, 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAfterSubmit = () => {
    // Keep scan input intact, clear the rest
    setSelectedLine(null);
    setRecords([]);
    setDialogOpen(false);
    setHeaderOrder("");
    setHeaderOrigin("");
    setApprovedQty("0");
    setRejectedQty("0");
    setRejectReason("");
    setReasonDialogOpen(false);
    setAllowedReasons([]);
    setExceedToastShown(false);
    setApproveAll(false);
    setRejectAll(false);
    setSingleLineOnly(false);
    // Unlock details after submission
    setDetailsLocked(false);
  };

  const doSubmit = async () => {
    if (!isSubmitEnabled || !selectedLine) return;

    const inspection = getInspection(selectedLine);
    const inspectionSeq = getSequence(selectedLine);
    const inspectionLine = getInspectionLine(selectedLine) || (singleLineOnly ? 1 : 0);

    const emp = (localStorage.getItem("gsi.employee") || "").toString();

    const payload = {
      TransactionID: "",
      Inspection: inspection,
      InspectionSequence: inspectionSeq,
      InspectionLine: inspectionLine,
      OrderOrigin: getOrderOrigin(selectedLine),
      Order: getOrderNumber(selectedLine),
      Position: getOrderPosition(selectedLine),
      Sequence: getOrderSequence(selectedLine),
      Set: getOrderSet(selectedLine),
      Quantity: totalToInspect,
      QuantityApproved: Number(approvedQty || "0"),
      QuantityRejected: Number(rejectedQty || "0"),
      RejectReason: (rejectReason || "").trim(),
      Approve: "Yes",
      Employee: emp || "",
      FromAPI: "Yes",
      Unit: getOrderUnit(selectedLine) || storageUnit || "",
    };

    const tid = showLoading(trans.pleaseWait);
    const { data, error } = await supabase.functions.invoke("ln-submit-inspection", {
      body: { language: "en-US", company: "1100", payload },
    });
    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      showError((data && (data.error?.message || data.error)) || "Submission failed");
      return;
    }

    showSuccess(trans.receivedSuccessfully);
    clearAfterSubmit();
  };

  const approvedNum = Number(approvedQty);
  const rejectedNum = Number(rejectedQty);

  const isRejectReasonVisible = rejectedNum > 0;

  const isReasonValid =
    !isRejectReasonVisible ||
    (rejectReason.trim().length > 0 &&
      allowedReasons.some((r) => r.Reason.toLowerCase() === rejectReason.trim().toLowerCase()));

  const isSubmitEnabled =
    selectedLine &&
    Number.isFinite(approvedNum) &&
    Number.isFinite(rejectedNum) &&
    (approvedNum + rejectedNum === totalToInspect) &&
    isReasonValid;

  // Show error toast if the sum exceeds the quantity to inspect
  useEffect(() => {
    if (!selectedLine) {
      setExceedToastShown(false);
      return;
    }
    const sum = approvedNum + rejectedNum;
    if (Number.isFinite(sum) && sum > totalToInspect) {
      if (!exceedToastShown) {
        showError("Approved + Rejected exceeds the quantity to be inspected.");
        setExceedToastShown(true);
      }
    } else {
      if (exceedToastShown) setExceedToastShown(false);
    }
  }, [selectedLine, approvedNum, rejectedNum, totalToInspect]);

  useEffect(() => {
    const name = localStorage.getItem("gsi.full_name");
    if (name) setFullName(name);
  }, []);

  const handleBack = () => navigate("/menu/incoming");

  const handleBlurScan = async () => {
    const q = query.trim();
    if (!q) return;

    const tid = showLoading(trans.pleaseWait);
    setLoading(true);
    try {
      const company = "1100";
      const url = "https://lkmdrhprvumenzzykmxu.supabase.co/functions/v1/ln-warehouse-inspections";
      const params = new URLSearchParams({ q, company });
      const resp = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await resp.json();
      if (!resp.ok) {
        showError(data?.error || "Unable to fetch inspections");
        return;
      }

      const count = data?.["@odata.count"] ?? 0;
      const value = Array.isArray(data?.value) ? data.value : [];

      const hasInspectionMatch = value.some((v: any) => typeof v?.Inspection === "string" && v.Inspection === q);
      const hasOrderMatch = value.some((v: any) => typeof v?.Order === "string" && v.Order === q);
      const hasHandlingUnitMatch = value.some((v: any) => typeof v?.HandlingUnit === "string" && v.HandlingUnit === q);
      if (hasInspectionMatch) setScanLabel(trans.inspectionLabel);
      else if (hasOrderMatch) setScanLabel(trans.incomingOrderNumberLabel);
      else if (hasHandlingUnitMatch) setScanLabel(trans.loadHandlingUnit);
      else setScanLabel(trans.inspectionQueryLabel);

      if (count > 1 && value.length > 1) {
        const first = value[0] || {};
        const ord = typeof first?.Order === "string" ? first.Order : query.trim();
        const origin = typeof first?.OrderOrigin === "string" ? first.OrderOrigin : "";
        setHeaderOrder(ord || "");
        setHeaderOrigin(origin || "");
        setRecords(value);
        setDialogOpen(true);
      } else if (count === 1 && value.length === 1) {
        handleSelectRecord(value[0]);
      } else {
        showError(trans.noEntries);
        setScanLabel(trans.inspectionQueryLabel);
      }
    } finally {
      dismissToast(tid as unknown as string);
      setLoading(false);
    }
  };

  // When a record is selected from dialog, show details inline
  const handleSelectRecord = (rec: any) => {
    setDialogOpen(false);
    setSelectedLine(rec);
    // Lock details until we know if there's 1 line or multiple
    setDetailsLocked(true);
    setApprovedQty("0");
    setRejectedQty("0");
    setRejectReason("");
  };

  // If a selected record has multiple Inspection Lines, open the popup to pick one
  useEffect(() => {
    const run = async () => {
      if (!selectedLine || selectedLine.__position) {
        setSingleLineOnly(Boolean(selectedLine?.__position));
        // If position is already chosen, unlock details
        if (selectedLine?.__position) setDetailsLocked(false);
        return;
      }
      const insp = (selectedLine?.Inspection || "").toString().trim();
      const seq = Number(
        selectedLine?.InspectionSequence ??
        selectedLine?.Sequence ??
        selectedLine?.OrderSequence ??
        0
      );
      if (!insp || !seq) {
        setSingleLineOnly(false);
        setDetailsLocked(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("ln-inspection-lines", {
        body: { inspection: insp, sequence: seq, language: "en-US", company: "1100" },
      });
      const list = Array.isArray(data?.value) ? data.value : [];
      if (!error && list.length === 1) {
        // Exactly one line → attach and unlock details
        setSelectedLine({ ...selectedLine, __position: list[0] });
        setSingleLineOnly(true);
        setLinePickerOpen(false);
        setLineOptions([]);
        setDetailsLocked(false);
      } else if (!error && list.length > 1) {
        // Multiple lines → open picker; keep details locked until user selects
        setLineOptions(list);
        setLinePickerOpen(true);
        setSingleLineOnly(false);
        setDetailsLocked(true);
      } else {
        // On error or no lines, unlock to show basic info
        setSingleLineOnly(false);
        setLinePickerOpen(false);
        setLineOptions([]);
        setDetailsLocked(false);
      }
    };
    void run();
  }, [selectedLine]);

  // Reset toggles when a new line is selected
  useEffect(() => {
    setApproveAll(false);
    setRejectAll(false);
  }, [selectedLine]);

  // Helpers to render origin chip like Goods Receipt
  const formatOriginLabel = (origin: string) => {
    const o = (origin || "").trim();
    if (!o) return "-";
    const lower = o.toLowerCase();
    if (lower.includes("production")) return lang === "de" ? "Produktion" : trans.incomingOrderTypeLabel.replace("type", "Production");
    if (lower.includes("purchase")) return trans.incomingOrderTypePurchase;
    if (lower.includes("sales")) return lang === "de" ? "Verkauf" : "Sales";
    if (lower.includes("transfermanual")) return lang === "de" ? "Umbuchung (manuell)" : "Transfer (manual)";
    if (lower.includes("transfer")) return lang === "de" ? "Umbuchung" : "Transfer";
    return o;
  };

  const originColorStyle = (origin: string) => {
    const o = (origin || "").toLowerCase();
    if (o.includes("production")) return { bg: "#2db329", text: "#ffffff" };
    if (o.includes("purchase")) return { bg: "#9ed927", text: "#1a1a1a" };
    if (o.includes("sales")) return { bg: "#1d5f8a", text: "#ffffff" };
    if (o.includes("transfer")) return { bg: "#ffd500", text: "#1a1a1a" };
    return { bg: "#2db329", text: "#ffffff" };
  };

  const handleSignOutConfirm = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
    } catch {}
    showSuccess(trans.signedOut);
    setShowSignOut(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={handleBack} />
          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.incomingWarehouseInspection.toUpperCase()}</div>
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
            onClick={() => setShowSignOut(true)}
          >
            <LogOut className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Scan input */}
        <div>
          <FloatingLabelInput
            id="inspectionScan"
            label={scanLabel}
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              setScanLabel(trans.inspectionQueryLabel);
              if (
                selectedLine ||
                records.length > 0 ||
                approvedQty !== "0" ||
                rejectedQty !== "0" ||
                rejectReason.trim().length > 0
              ) {
                resetAllForNewScan();
              }
            }}
            onBlur={handleBlurScan}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            onClear={() => {
              setQuery("");
              setScanLabel(trans.inspectionQueryLabel);
              resetAllForNewScan();
            }}
          />
        </div>

        {/* Selection dialog */}
        <InspectionResultsDialog
          open={dialogOpen}
          records={records}
          onSelect={handleSelectRecord}
          onClose={() => setDialogOpen(false)}
          headerOrder={headerOrder}
          headerOrigin={headerOrigin}
        />

        {/* Old-style line picker popup when a single record has multiple Inspection Lines */}
        <InspectionLinePickerDialog
          open={linePickerOpen}
          lines={lineOptions}
          order={headerOrder || (selectedLine?.Order || "")}
          origin={headerOrigin || (selectedLine?.OrderOrigin || "")}
          onSelect={(ln) => {
            setSelectedLine((prev) => (prev ? { ...prev, __position: ln } : prev));
            setSingleLineOnly(true);
            setLinePickerOpen(false);
            setLineOptions([]);
            // Unlock details after user chooses a specific line
            setDetailsLocked(false);
          }}
          onClose={() => {
            setLinePickerOpen(false);
            setLineOptions([]);
          }}
        />

        {/* Dynamic details when one line is selected */}
        {selectedLine && !detailsLocked && (
          <div className="space-y-3">
            {/* Order header (same line) */}
            {(() => {
              const ord = (selectedLine?.Order || headerOrder || "").trim();
              const originRaw = (selectedLine?.OrderOrigin || headerOrigin || "").trim();
              if (!ord && !originRaw) return null;
              const s = originColorStyle(originRaw);
              return (
                <div className="rounded-md border bg-white px-3 py-2">
                  <div className="relative">
                    <FloatingLabelInput
                      id="orderHeader"
                      label={trans.orderLabel}
                      value={ord}
                      disabled
                      className="pl-28 pr-3"
                    />
                    {originRaw && (
                      <span
                        className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                        style={{ backgroundColor: s.bg, color: s.text }}
                        title={originRaw}
                      >
                        {formatOriginLabel(originRaw)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Inspection - Sequence - Line */}
            <div className="rounded-md border bg-gray-100 px-3 pt-5 pb-2 relative">
              <span className="absolute left-3 top-1 text-[11px] leading-none text-gray-600">{trans.inspectionLabel}</span>
              <span className="absolute right-3 top-1 text-[11px] leading-none text-gray-600">{trans.quantityLabel}</span>

              <div className="grid grid-cols-[1fr_auto] items-center">
                <div className="text-sm sm:text-base text-gray-900 font-medium break-all">
                  {(getInspection(selectedLine) || "-")}
                  {(() => {
                    const seq = getSequence(selectedLine);
                    return seq ? ` - ${seq}` : "";
                  })()}
                  {(() => {
                    const ln = getInspectionLine(selectedLine);
                    return ln ? ` - ${ln}` : (singleLineOnly ? " - 1" : "");
                  })()}
                </div>
                <div className="text-sm text-gray-900 text-right whitespace-nowrap font-medium">
                  {totalToInspect} {storageUnit}
                </div>
              </div>
            </div>

            {/* Item and description */}
            <div className="rounded-md border bg-white px-3 py-2">
              <div className="text-sm sm:text-base text-gray-900 break-all">{getItem(selectedLine) || "-"}</div>
              {getItemDesc(selectedLine) && (
                <div className="text-xs text-gray-700">{getItemDesc(selectedLine)}</div>
              )}
            </div>

            {/* Approved Quantity input (with green check toggle) */}
            {!rejectAll && (
              <div className="relative">
                <FloatingLabelInput
                  id="approvedQty"
                  label={trans.approvedQuantityLabel}
                  value={approvedQty}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setApprovedQty("");
                      setApproveAll(false);
                      return;
                    }
                    const num = Number(v);
                    setApprovedQty(!Number.isNaN(num) && num >= 0 ? v : "0");
                    const allStr = String(totalToInspect || 0);
                    if (v !== allStr) setApproveAll(false);
                  }}
                  onClear={() => {
                    setApprovedQty("0");
                    setApproveAll(false);
                  }}
                  inputMode="decimal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={[
                    "absolute right-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md border border-gray-300 shadow-sm",
                    approveAll ? "bg-green-600 text-white hover:bg-green-700" : "bg-white text-green-600 hover:text-green-700"
                  ].join(" ").trim()}
                  aria-label={trans.approvedQuantityLabel}
                  onClick={() => {
                    if (!approveAll) {
                      const all = String(totalToInspect || 0);
                      setApprovedQty(all);
                      setRejectedQty("0");
                      setApproveAll(true);
                      setRejectAll(false);
                    } else {
                      setApprovedQty("0");
                      setApproveAll(false);
                    }
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Rejected Quantity input (with red check toggle) */}
            {!approveAll && (
              <div className="relative">
                <FloatingLabelInput
                  id="rejectedQty"
                  label={trans.rejectedQuantityLabel}
                  value={rejectedQty}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setRejectedQty("");
                      setRejectAll(false);
                      return;
                    }
                    const num = Number(v);
                    setRejectedQty(!Number.isNaN(num) && num >= 0 ? v : "0");
                    const allStr = String(totalToInspect || 0);
                    if (v !== allStr) setRejectAll(false);
                  }}
                  onClear={() => {
                    setRejectedQty("0");
                    setRejectAll(false);
                  }}
                  inputMode="decimal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={[
                    "absolute right-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md border border-gray-300 shadow-sm",
                    rejectAll ? "bg-red-600 text-white hover:bg-red-700" : "bg-white text-red-600 hover:text-red-700"
                  ].join(" ").trim()}
                  aria-label={trans.rejectedQuantityLabel}
                  onClick={() => {
                    if (!rejectAll) {
                      const all = String(totalToInspect || 0);
                      setRejectedQty(all);
                      setApprovedQty("0");
                      setRejectAll(true);
                      setApproveAll(false);
                    } else {
                      setRejectedQty("0");
                      setRejectAll(false);
                    }
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Reject Reason (visible only if rejected > 0) */}
            {isRejectReasonVisible && (
              <div className="relative">
                <FloatingLabelInput
                  id="rejectReason"
                  label={trans.rejectReasonLabel}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onFocus={async () => {
                    if (allowedReasons.length === 0) {
                      const { data } = await supabase.functions.invoke("ln-reasons-list", {
                        body: { company: "1100", language: "en-US" },
                      });
                      const list = Array.isArray(data?.value) ? data.value : [];
                      setAllowedReasons(list);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setReasonDialogOpen(true)}
                  aria-label={trans.searchLabel}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Submit button */}
            <div className="pt-2">
              <Button
                className="h-12 w-full"
                variant={isSubmitEnabled ? "destructive" : "secondary"}
                disabled={!isSubmitEnabled}
                onClick={doSubmit}
              >
                {trans.submitLabel}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SignOutConfirm
        open={showSignOut}
        onOpenChange={setShowSignOut}
        title={trans.signOutTitle}
        question={trans.signOutQuestion}
        yesLabel={trans.yes}
        noLabel={trans.no}
        onConfirm={handleSignOutConfirm}
      />

      <ReasonPickerDialog
        open={reasonDialogOpen}
        onOpenChange={setReasonDialogOpen}
        onSelect={(code) => {
          setRejectReason(code);
          setReasonDialogOpen(false);
        }}
        onLoaded={(list) => {
          setAllowedReasons(list.map((r: any) => ({ Reason: r.Reason, Description: r.Description })));
        }}
        company="1100"
        language="en-US"
      />
    </div>
  );
};

export default IncomingInspectionPage;