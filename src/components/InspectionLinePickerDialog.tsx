"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type InspectionLinePickerDialogProps = {
  open: boolean;
  lines: any[];
  onSelect: (line: any) => void;
  onClose: () => void;
};

const InspectionLinePickerDialog: React.FC<InspectionLinePickerDialogProps> = ({
  open,
  lines,
  onSelect,
  onClose,
}) => {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-w-md rounded-lg border bg-white p-0 shadow-lg">
        <DialogHeader className="px-4 pt-3 pb-2">
          <DialogTitle className="text-sm">Select inspection line</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 overflow-auto p-2">
          {(!lines || lines.length === 0) ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">No entries</div>
          ) : (
            lines.map((ln: any, idx: number) => {
              const lineNum = Number(ln?.InspectionLine ?? ln?.Line ?? 0);
              const item = typeof ln?.Item === "string" ? ln.Item : (typeof ln?.ItemRef?.Item === "string" ? ln.ItemRef.Item : "");
              const desc = typeof ln?.ItemRef?.Description === "string" ? ln.ItemRef.Description : "";
              const qty = Number(ln?.QuantityToBeInspectedInStorageUnit ?? 0);
              const su = typeof ln?.StorageUnit === "string" ? ln.StorageUnit : "";

              return (
                <button
                  key={`${lineNum}-${idx}`}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md border mb-2 bg-gray-50 hover:bg-gray-100"
                  onClick={() => onSelect(ln)}
                >
                  <div className="grid grid-cols-[60px_1fr_auto] gap-3 items-center">
                    <div className="inline-flex items-center rounded-full bg-gray-200 text-gray-800 px-3 py-1 text-xs font-semibold justify-center">
                      {lineNum || "-"}
                    </div>
                    <div className="flex flex-col">
                      <div className="font-mono text-sm sm:text-base text-gray-900 break-all">
                        {(item || "").trim() || "-"}
                      </div>
                      {desc && <div className="text-xs text-gray-700">{desc}</div>}
                    </div>
                    <div className="font-mono text-xs sm:text-sm text-gray-900 text-right whitespace-nowrap">
                      {qty} {su}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 pb-3">
          <Button
            variant="outline"
            className="w-full h-10"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionLinePickerDialog;