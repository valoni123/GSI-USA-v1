import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { showSuccess, showError } from "@/utils/toast";
import { Loader2, ScanLine, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InspectionResultsDialog from "@/components/InspectionResultsDialog";
import InspectionLinePickerDialog from "@/components/InspectionLinePickerDialog";
import { cn } from "@/lib/utils";

type InspectionRow = {
  Order?: string;
  Inspection?: string;
  HandlingUnit?: string;
  Line?: number;
  Item?: string;
  Warehouse?: string;
  Location?: string;
  Quantity?: number;
  Unit?: string;
  Reason?: string;
  Remarks?: string;
  ["@odata.etag"]?: string;
};

const IncomingInspectionPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("1100");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedRow, setSelectedRow] = useState<InspectionRow | null>(null);
  const [openLinePicker, setOpenLinePicker] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Autofocus on mount for quicker scanning
    inputRef.current?.focus();
  }, []);

  const hasRows = rows.length > 0;

  const handleScan = async () => {
    const q = query.trim();
    if (!q) {
      showError("Bitte eine Nummer scannen oder eingeben.");
      return;
    }

    setScanValue(q);
    setLoading(true);

    try {
      // Call ln-warehouse-inspections directly (the page already uses hardcoded URL elsewhere)
      const url = "https://lkmdrhprvumenzzykmxu.supabase.co/functions/v1/ln-warehouse-inspections";
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("company", company);

      const res = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok || data?.error) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
            ? data.message
            : "Serverfehler bei der Abfrage";
        showError(msg);
        setRows([]);
        setLoading(false);
        return;
      }

      const value = Array.isArray(data?.value) ? data.value : [];
      setRows(value);

      if (value.length === 0) {
        showError("Keine Einträge gefunden.");
      } else {
        showSuccess(`${value.length} Einträge gefunden.`);
      }
    } catch (e: any) {
      showError("Netzwerkfehler. Bitte erneut versuchen.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = (row: InspectionRow) => {
    setSelectedRow(row);
    setOpenDetails(true);
  };

  const handleSelectLine = () => {
    setOpenLinePicker(true);
  };

  const onCloseDetails = () => {
    setOpenDetails(false);
    setSelectedRow(null);
  };

  const onCloseLinePicker = () => {
    setOpenLinePicker(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="HU, Auftrag oder Prüfnummer scannen"
          className="flex-1"
        />
        <Button onClick={handleScan} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
          Suchen
        </Button>
      </div>

      {/* Results list */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Daten werden geladen…
            </div>
          ) : hasRows ? (
            <div className="divide-y">
              {rows.map((r, idx) => {
                const title = r.Item ? `${r.Item}` : r.Order || r.Inspection || r.HandlingUnit || "Eintrag";
                const sub = [
                  r.Order ? `Auftrag: ${r.Order}` : null,
                  r.Inspection ? `Prüfung: ${r.Inspection}` : null,
                  r.HandlingUnit ? `HU: ${r.HandlingUnit}` : null,
                  r.Location ? `Lokation: ${r.Location}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <button
                    key={`${r.Inspection || r.Order || r.HandlingUnit || "row"}-${idx}`}
                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => handleOpenDetails(r)}
                  >
                    <div className="text-sm font-medium">{title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Keine Einträge
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details dialog */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prüfdetails</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <InspectionResultsDialog
              row={selectedRow}
              onClose={onCloseDetails}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Line picker dialog */}
      <Dialog open={openLinePicker} onOpenChange={setOpenLinePicker}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Zeile auswählen</DialogTitle>
          </DialogHeader>
          <InspectionLinePickerDialog onClose={onCloseLinePicker} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncomingInspectionPage;