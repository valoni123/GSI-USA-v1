"use client";

import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type LanguageKey, t } from "@/lib/i18n";

type LineRecord = {
  InspectionLine?: number;
  Position?: number;
  QuantityToBeInspectedInStorageUnit?: number;
  StorageUnit?: string;
  Item?: string;
  ItemRef?: { Item?: string; Description?: string };
  // Added optional fields that commonly exist on the inspection line payload
  Inspection?: string;
  InspectionSequence?: number;
  Sequence?: number;
  OrderSequence?: number;
};

type Props = {
  open: boolean;
  lines: LineRecord[];
  order?: string;
  origin?: string;
  onSelect: (line: LineRecord) => void;
  onClose: () => void;
};

const originStyle = (origin?: string) => {
  const o = (origin || "").toLowerCase();
  if (o.includes("production")) return { bg: "#2db329", text: "#ffffff", label: "Production" };
  if (o.includes("purchase") || o.includes("einkauf")) return { bg: "#9ed927", text: "#1a1a1a", label: "Purchase" };
  if (o.includes("sales") || o.includes("verkauf")) return { bg: "#1d5f8a", text: "#ffffff", label: "Sales" };
  if (o.includes("transfer")) return { bg: "#ffd500", text: "#1a1a1a", label: "Transfer" };
  return { bg: "#2db329", text: "#ffffff", label: origin || "-" };
};

const InspectionLinePickerDialog: React.FC<Props> = ({ open, lines, order, origin, onSelect, onClose }) => {
  const currentLang = (localStorage.getItem("app.lang") as LanguageKey) || "en";
  const trans = t(currentLang);
  const s = originStyle(origin);

  const safeNum = (n: any, def = 0) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : def;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
        {/* Header */}
        <div className="border-b bg-black text-white rounded-t-lg px-4 py-2 text-sm font-semibold">
          <div className="flex items-center justify-between pr-2">
            <span>{trans.selectInspectionTitle}</span>
          </div>
        </div>

        {/* Order header with origin chip */}
        <div className="rounded-none border-b bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">
              {trans.incomingOrderNumberLabel}: {order || "-"}
            </div>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
              style={{ backgroundColor: s.bg, color: s.text }}
              title={origin || ""}
            >
              {s.label}
            </span>
          </div>
        </div>

        {/* Lines list */}
        <ScrollArea className="max-h-72 p-2">
          {(!lines || lines.length === 0) ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
          ) : (
            lines.map((ln, idx) => {
              const lineNum = safeNum(ln?.InspectionLine ?? ln?.Position);
              const qty = safeNum(ln?.QuantityToBeInspectedInStorageUnit);
              const su = typeof ln?.StorageUnit === "string" ? ln.StorageUnit : "";

              const inspection = (typeof ln?.Inspection === "string" && ln.Inspection) || "";
              const sequenceNum = safeNum(
                ln?.InspectionSequence ??
                ln?.Sequence ??
                ln?.OrderSequence,
                0
              );

              const item =
                (typeof ln?.Item === "string" && ln.Item) ||
                (typeof ln?.ItemRef?.Item === "string" && ln.ItemRef.Item) ||
                "";
              const desc =
                (typeof ln?.ItemRef?.Description === "string" && ln.ItemRef.Description) ||
                "";

              return (
                <button
                  key={`${lineNum || "line"}-${idx}`}
                  type="button"
                  className="w-full text-left mb-2"
                  onClick={() => onSelect(ln)}
                >
                  <div className="rounded-md bg-gray-100/80 px-3 py-2 border shadow-sm">
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                      <div className="flex flex-col">
                        {/* Primary: Inspection - Sequence - Line */}
                        <div className="text-sm sm:text-base text-gray-900 font-medium break-all">
                          {inspection || "-"}
                          {sequenceNum ? <span className="ml-1 text-gray-900 font-medium">- {sequenceNum}</span> : null}
                          {Number.isFinite(lineNum) && lineNum > 0 ? (
                            <span className="ml-1 text-gray-900 font-medium">- {lineNum}</span>
                          ) : null}
                        </div>

                        {/* Secondary: Item beneath */}
                        <div className="font-mono text-xs sm:text-sm text-gray-800 break-all mt-0.5">
                          {(item || "").trim() || "-"}
                        </div>

                        {/* Optional description */}
                        {desc && <div className="text-xs text-gray-700">{desc}</div>}
                      </div>

                      <div className="text-sm text-gray-900 text-right whitespace-nowrap font-medium">
                        {qty} {su}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>

        {/* Footer */}
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