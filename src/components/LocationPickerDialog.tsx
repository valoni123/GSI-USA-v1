"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-lg bg-white p-0 [&>button]:hidden">
        <DialogHeader className="border-b bg-black px-4 py-2 text-left">
          <DialogTitle className="text-sm font-semibold text-white">{title}</DialogTitle>
        </DialogHeader>

        <button
          type="button"
          className="absolute right-3 top-2 text-gray-200 hover:text-white"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          ×
        </button>

        <div
          className="max-h-[70dvh] overflow-y-auto overscroll-contain p-2"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
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
                    style={{ touchAction: "pan-y" }}
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
      </DialogContent>
    </Dialog>
  );
};

export default LocationPickerDialog;
