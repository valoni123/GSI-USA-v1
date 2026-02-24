"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import InspectionResultsDialog from "@/components/InspectionResultsDialog";
import SignOutConfirm from "@/components/SignOutConfirm";
import BackButton from "@/components/BackButton";
import ReasonPickerDialog from "@/components/ReasonPickerDialog";
import { supabase } from "@/integrations/supabase/client";

const IncomingInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [fullName, setFullName] = useState<string>("");
  const [headerOrder, setHeaderOrder] = useState<string>("");
  const [headerOrigin, setHeaderOrigin] = useState<string>("");

  // Selected inspection line (from dialog selection); may include __position payload
  const [selectedLine, setSelectedLine] = useState<any | null>(null);

  // Inputs for approval flow
  const [approvedQty, setApprovedQty] = useState<string>("0");
  const [rejectedQty, setRejectedQty] = useState<string>("0");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [allowedReasons, setAllowedReasons] = useState<Array<{ Reason: string; Description?: string }>>([]);
  // Track whether we've already shown the exceed toast to avoid spamming
  const [exceedToastShown, setExceedToastShown] = useState<boolean>(false);

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
        toast({
          title: "Quantity exceeded",
          description: "Approved + Rejected exceeds the quantity to be inspected.",
          variant: "destructive",
        });
        setExceedToastShown(true);
      }
    } else {
      // Reset once user corrects values
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

    setLoading(true);
    try {
      // Optionally derive company server-side; allow client override if needed.
      const company = "1100";

      // Invoke edge function that securely gets token and calls OData
      const url = "https://lkmdrhprvumenzzykmxu.supabase.co/functions/v1/ln-warehouse-inspections";
      const params = new URLSearchParams({ q, company });
      const resp = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await resp.json();
      if (!resp.ok) {
        toast({
          title: "Lookup failed",
          description: data?.error || "Unable to fetch inspections",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const count = data?.["@odata.count"] ?? 0;
      const value = Array.isArray(data?.value) ? data.value : [];
      if (count > 1 && value.length > 1) {
        // Prepare header info from first result
        const first = value[0] || {};
        const ord = typeof first?.Order === "string" ? first.Order : query.trim();
        const origin = typeof first?.OrderOrigin === "string" ? first.OrderOrigin : "";
        setHeaderOrder(ord || "");
        setHeaderOrigin(origin || "");
        setRecords(value);
        setDialogOpen(true);
      } else if (count === 1 && value.length === 1) {
        // Proceed with single record
        handleSelectRecord(value[0]);
      } else {
        toast({
          title: "No active inspections found",
          description: "The scanned code did not match any open inspections.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // When a record is selected from dialog, show details inline
  const handleSelectRecord = (rec: any) => {
    setDialogOpen(false);
    setSelectedLine(rec);
    setApprovedQty("0");
    setRejectedQty("0");
    setRejectReason("");
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
    setShowSignOut(false);
    toast({
      title: "Signed out",
      description: "You have been signed out.",
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel="Back" onClick={handleBack} />
          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">WAREHOUSE INSPECTION</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4" />
              <span className="line-clamp-1">{fullName || ""}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-white/10"
            aria-label="Sign out"
            onClick={() => setShowSignOut(true)}
          >
            <LogOut className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Scan input */}
        <div>
          <label className="text-sm text-gray-600">Order Number / Inspection / Handling Unit</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleBlurScan}
            placeholder=""
            className={`mt-2 h-12 text-lg w-full ${loading ? "opacity-60" : ""}`}
            disabled={loading}
            autoFocus
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

        {/* Dynamic details when one line is selected */}
        {selectedLine && (
          <div className="space-y-3">
            {/* Inspection - Sequence - Line */}
            <div className="rounded-md border bg-gray-100 px-3 py-2">
              <div className="grid grid-cols-[1fr_auto] items-center">
                <div className="text-sm sm:text-base text-gray-900 font-medium break-all">
                  {(getInspection(selectedLine) || "-")}
                  {(() => {
                    const seq = getSequence(selectedLine);
                    return seq ? ` - ${seq}` : "";
                  })()}
                  {(() => {
                    const ln = getInspectionLine(selectedLine);
                    return ln ? ` - ${ln}` : "";
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

            {/* Approved Quantity input */}
            <div>
              <label className="text-xs text-gray-600">Approved Quantity</label>
              <Input
                type="number"
                min={0}
                step="any"
                value={approvedQty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setApprovedQty("");
                    return;
                  }
                  const num = Number(v);
                  setApprovedQty(!Number.isNaN(num) && num >= 0 ? v : "0");
                }}
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === "e" || e.key === "+") {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const num = Number(text);
                  if (text.includes("-") || (!Number.isNaN(num) && num < 0)) {
                    e.preventDefault();
                    setApprovedQty("0");
                  }
                }}
                inputMode="decimal"
                className="mt-1 h-10"
              />
            </div>

            {/* Rejected Quantity input */}
            <div>
              <label className="text-xs text-gray-600">Rejected Quantity</label>
              <Input
                type="number"
                min={0}
                step="any"
                value={rejectedQty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setRejectedQty("");
                    return;
                  }
                  const num = Number(v);
                  setRejectedQty(!Number.isNaN(num) && num >= 0 ? v : "0");
                }}
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === "e" || e.key === "+") {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const num = Number(text);
                  if (text.includes("-") || (!Number.isNaN(num) && num < 0)) {
                    e.preventDefault();
                    setRejectedQty("0");
                  }
                }}
                inputMode="decimal"
                className="mt-1 h-10"
              />
            </div>

            {/* Reject Reason (visible only if rejected > 0) */}
            {isRejectReasonVisible && (
              <div>
                <label className="text-xs text-gray-600">Reject Reason</label>
                <div className="relative mt-1">
                  <Input
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
                    className="h-10 pr-10"
                    placeholder="Type or pick a valid reason"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setReasonDialogOpen(true)}
                    aria-label="Search reason"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Submit button */}
            <div className="pt-2">
              <Button
                className="h-12 w-full"
                variant={isSubmitEnabled ? "destructive" : "secondary"}
                disabled={!isSubmitEnabled}
                onClick={() => {
                  // Submit handler placeholder; integrate with LN post if needed
                  toast({
                    title: "Submitted",
                    description: "Your inspection quantities have been submitted.",
                  });
                }}
              >
                SUBMIT
              </Button>
            </div>
          </div>
        )}
      </div>

      <SignOutConfirm
        open={showSignOut}
        onOpenChange={setShowSignOut}
        title="Sign out"
        question="Are you sure you want to sign out?"
        yesLabel="Sign out"
        noLabel="Cancel"
        onConfirm={handleSignOutConfirm}
      />

      {/* Reason picker modal */}
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