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
  const count = Array.isArray(lines) ? lines.length : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
        {/* Black header bar */}
        <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
          <div className="flex items-center justify-between pr-2">
            <span>Inspection Lines</span>
            <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs">
              {count} {count === 1 ? "line" : "lines"}
            </span>
          </div>
        </div>

        {/* List area */}
        <div className="max-h-64 overflow-auto p-2">
          {!lines || lines.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">No entries</div>
          ) : (
            lines.map((ln: any, idx: number) => {
              const lineNum = Number(ln?.InspectionLine ?? ln?.Line ?? 0);
              const item =
                typeof ln?.Item === "string"
                  ? ln.Item
                  : typeof ln?.ItemRef?.Item === "string"
                  ? ln.ItemRef.Item
                  : "";
              const desc = typeof ln?.ItemRef?.Description === "string" ? ln.ItemRef.Description : "";
              const qty = Number(ln?.QuantityToBeInspectedInStorageUnit ?? 0);
              const su = typeof ln?.StorageUnit === "string" ? ln.StorageUnit : "";

              return (
                <button
                  key={`${lineNum}-${idx}`}
                  type="button"
                  className="w-full text-left mb-2"
                  onClick={() => onSelect(ln)}
                >
                  <div className="rounded-md bg-gray-100/80 px-3 py-2 border shadow-sm">
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
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer action */}
        <div className="px-4 pb-3">
          <Button variant="outline" className="w-full h-10" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionLinePickerDialog;