"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import InspectionResultsDialog from "@/components/InspectionResultsDialog";
import SignOutConfirm from "@/components/SignOutConfirm";
import { supabase } from "@/integrations/supabase/client";

const IncomingInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);

  const handleBack = () => navigate(-1);

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
    // Navigate to next step (placeholder: pass record via state)
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

  const handleSignOutConfirm = async () => {
    await supabase.auth.signOut();
    setShowSignOut(false);
    toast({
      title: "Signed out",
      description: "You have been signed out.",
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Warehouse Inspection</h1>
            <div className="text-xs opacity-75">Scan Order / Inspection / Handling Unit</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSignOut(true)} className="text-red-400 hover:bg-white/10">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-6">
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
        />
      </div>

      <SignOutConfirm open={showSignOut} onOpenChange={setShowSignOut} title="Sign out" question="Are you sure you want to sign out?" yesLabel="Sign out" noLabel="Cancel" onConfirm={handleSignOutConfirm} />
    </div>
  );
};

export default IncomingInspectionPage;