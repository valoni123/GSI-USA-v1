"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type InspectionRecord = {
  Order?: string;
  Inspection?: string;
  HandlingUnit?: string;
  InspectionStatus?: string;
  [key: string]: any;
};

type Props = {
  open: boolean;
  records: InspectionRecord[];
  onSelect: (record: InspectionRecord) => void;
  onClose: () => void;
};

const InspectionResultsDialog: React.FC<Props> = ({ open, records, onSelect, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Select an inspection</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80 mt-2">
          <div className="space-y-2">
            {records.map((rec, idx) => {
              const summary = [
                rec.Order ? `Order: ${rec.Order}` : null,
                rec.Inspection ? `Inspection: ${rec.Inspection}` : null,
                rec.HandlingUnit ? `HU: ${rec.HandlingUnit}` : null,
                rec.InspectionStatus ? `Status: ${rec.InspectionStatus}` : null,
              ].filter(Boolean).join(" • ");

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="text-sm">{summary || "Inspection record"}</div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelect(rec)}
                  >
                    Select
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionResultsDialog;