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
  Unit?: string;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="flex h-[min(80dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-lg border bg-white shadow-lg">
            <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
              {title}
            </div>

            <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain touch-pan-y p-2 [WebkitOverflowScrolling:touch]">
              {loading ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">{loadingText}</div>
              ) : rows.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</div>
              ) : (
                <div className="space-y-2 pb-2">
                  {rows.map((r, idx) => {
                    const unit = r.Unit ? ` ${r.Unit}` : "";
                    return (
                      <button
                        key={`${r.Location}-${idx}`}
                        type="button"
                        className="w-full rounded-md border bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() => onPick(r.Location)}
                      >
                        <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                          <div className="flex flex-col">
                            <div className="text-sm text-gray-900">{r.Location}</div>
                            {r.Lot ? <div className="text-xs text-gray-700">Lot: {r.Lot}</div> : null}
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-xs text-gray-600 whitespace-nowrap">
                              On hand:{" "}
                              <span className="font-semibold text-gray-900">
                                {r.OnHand}
                                {unit}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 whitespace-nowrap">
                              Available:{" "}
                              <span className="font-semibold text-gray-900">
                                {typeof r.Available === "number" ? r.Available : ""}
                                {unit}
                              </span>
                            </div>
                          </div>
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
              className="absolute right-4 top-4 h-8 w-8 text-gray-200 hover:text-white"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              ×
            </Button>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
};

export default LocationPickerDialog;
