"use client";

import React from "react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Row = {
  Location: string;
  OnHand: number;
  Allocated?: number;
  Available?: number;
  Lot?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  rows: Row[];
  onPick: (loc: string) => void;
  title?: string;
  emptyText?: string;
  loadingText?: string;
};

const LocationPickerDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  loading,
  rows,
  onPick,
  title = "Locations",
  emptyText = "No entries",
  loadingText = "Loading list...",
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
        <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-0 shadow-lg">
          <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
            {title}
          </div>
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-2">
            {loading ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">{loadingText}</div>
            ) : rows.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              <div className="space-y-2">
                {rows.map((r, idx) => {
                  const right = [
                    typeof r.OnHand === "number" ? `On hand: ${r.OnHand}` : null,
                    typeof r.Available === "number" ? `Avail: ${r.Available}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      key={`${r.Location}-${idx}`}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md border mb-1.5 bg-gray-50 hover:bg-gray-100"
                      onClick={() => onPick(r.Location)}
                    >
                      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                        <div className="flex flex-col">
                          <div className="text-sm text-gray-900">{r.Location}</div>
                          {r.Lot ? <div className="text-xs text-gray-700">Lot: {r.Lot}</div> : null}
                        </div>
                        {right ? <div className="text-xs text-gray-700 whitespace-nowrap">{right}</div> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="absolute right-1 top-1.5 h-8 w-8 text-gray-200 hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            ×
          </Button>
        </div>
      </DialogPortal>
    </Dialog>
  );
};

export default LocationPickerDialog;