"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import InspectionResultsDialog from "@/components/InspectionResultsDialog";
import SignOutConfirm from "@/components/SignOutConfirm";
import BackButton from "@/components/BackButton";

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

  const handleSelectRecord = (rec: any) => {
    setDialogOpen(false);
    navigate("/menu/incoming/inspection", { state: { inspection: rec } });
    toast({
      title: "Inspection selected",
      description: [
        rec?.Order ? `Order ${rec.Order}` : null,
        rec?.Inspection ? `Inspection ${rec.Inspection}` : null,
        rec?.HandlingUnit ? `HU ${rec.HandlingUnit}` : null,
      ].filter(Boolean).join(" • "),
    });
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

      <div className="mx-auto max-w-md px-4 py-4">
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

        <InspectionResultsDialog
          open={dialogOpen}
          records={records}
          onSelect={handleSelectRecord}
          onClose={() => setDialogOpen(false)}
          headerOrder={headerOrder}
          headerOrigin={headerOrigin}
        />
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
    </div>
  );
};

export default IncomingInspectionPage;