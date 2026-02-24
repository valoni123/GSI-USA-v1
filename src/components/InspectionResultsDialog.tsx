"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

type InspectionRecord = {
  Order?: string;
  Inspection?: string;
  HandlingUnit?: string;
  InspectionStatus?: string;
  OrderOrigin?: string;
  Line?: number;
  OrderLine?: number;
  Sequence?: number;
  OrderSequence?: number;
  InspectionSequence?: number;
  Item?: string;
  ItemRef?: { Item?: string; Description?: string };
  ToBeReceivedQuantity?: number;
  QuantityToInspect?: number;
  Quantity?: number;
  ReceiptUnit?: string;
  OrderUnit?: string;
  Unit?: string;
  QuantityToBeInspectedInStorageUnit?: number;
  StorageUnit?: string;
  [key: string]: any;
};

type PositionRecord = {
  Position?: number;
  QuantityToBeInspectedInStorageUnit?: number;
  StorageUnit?: string;
  Item?: string;
  ItemRef?: { Item?: string; Description?: string };
  [key: string]: any;
};

type Props = {
  open: boolean;
  records: InspectionRecord[];
  onSelect: (record: InspectionRecord) => void;
  onClose: () => void;
  headerOrder?: string;
  headerOrigin?: string;
};

const originColorStyle = (origin?: string) => {
  const o = (origin || "").toLowerCase();
  if (o.includes("production")) return { bg: "#2db329", text: "#ffffff", label: "Production" };
  if (o.includes("purchase") || o.includes("einkauf")) return { bg: "#9ed927", text: "#1a1a1a", label: "Purchase" };
  if (o.includes("sales") || o.includes("verkauf")) return { bg: "#1d5f8a", text: "#ffffff", label: "Sales" };
  if (o.includes("transfer")) return { bg: "#ffd500", text: "#1a1a1a", label: "Transfer" };
  return { bg: "#2db329", text: "#ffffff", label: origin || "-" };
};

const getLineNumber = (r: InspectionRecord) => {
  const n = Number(r.Line ?? r.OrderLine ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const getSequence = (r: InspectionRecord) => {
  const n = Number(r.Sequence ?? r.OrderSequence ?? r.InspectionSequence ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const getInspectionSequence = (r: InspectionRecord) => {
  const n = Number(r.InspectionSequence ?? r.Sequence ?? r.OrderSequence ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const getItem = (r: InspectionRecord) =>
  (typeof r.Item === "string" && r.Item) ||
  (typeof r.ItemRef?.Item === "string" && r.ItemRef.Item) ||
  "";
const getItemDesc = (r: InspectionRecord) =>
  (typeof r.ItemRef?.Description === "string" && r.ItemRef.Description) || "";
const getQty = (r: InspectionRecord) => {
  const n = Number(
    r.QuantityToInspect ?? r.ToBeReceivedQuantity ?? r.Quantity ?? 0
  );
  return Number.isFinite(n) ? n : 0;
};
const getUnit = (r: InspectionRecord) =>
  (typeof r.Unit === "string" && r.Unit) ||
  (typeof r.ReceiptUnit === "string" && r.ReceiptUnit) ||
  (typeof r.OrderUnit === "string" && r.OrderUnit) ||
  "";
const getInspectQtySU = (r: InspectionRecord) => {
  const n = Number(r.QuantityToBeInspectedInStorageUnit ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const getStorageUnit = (r: InspectionRecord) =>
  (typeof r.StorageUnit === "string" && r.StorageUnit) || "";

const groupByLine = (records: InspectionRecord[]) => {
  const map = new Map<number, InspectionRecord[]>();
  for (const r of records) {
    const ln = getLineNumber(r);
    if (ln === null) continue;
    const list = map.get(ln) || [];
    list.push(r);
    map.set(ln, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([line, list]) => {
      const sorted = list.sort((x, y) => (getInspectionSequence(x) || 0) - (getInspectionSequence(y) || 0));
      return { line, items: sorted };
    });
};

const InspectionResultsDialog: React.FC<Props> = ({ open, records, onSelect, onClose, headerOrder, headerOrigin }) => {
  const order = headerOrder || (records[0]?.Order || "");
  const origin = headerOrigin || (records[0]?.OrderOrigin || "");
  const s = originColorStyle(origin);
  const grouped = groupByLine(records);

  // Track expanded line and its positions
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [positionsByKey, setPositionsByKey] = useState<Record<string, PositionRecord[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const fetchPositions = async (inspection: string, sequence: number) => {
    const { data, error } = await supabase.functions.invoke("ln-inspection-lines", {
      body: { inspection, sequence, language: "en-US", company: "1100" },
    });
    if (error || !data || !data.ok) return { count: 0, value: [] as PositionRecord[] };
    const value = Array.isArray(data.value) ? data.value : [];
    return { count: Number(data.count ?? value.length ?? 0), value };
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select an inspection</DialogTitle>
        </DialogHeader>

        {/* Order header with origin chip */}
        <div className="rounded-md border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">Order: {order || "-"}</div>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
              style={{ backgroundColor: s.bg, color: s.text }}
              title={origin || ""}
            >
              {s.label}
            </span>
          </div>
        </div>

        {/* Lines + sequences list */}
        <ScrollArea className="max-h-80 mt-3">
          <div className="space-y-4">
            {grouped.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">No entries</div>
            ) : (
              grouped.map((grp) => (
                <div key={`line-${grp.line}`} className="space-y-2">
                  <div className="inline-flex items-center rounded-full bg-gray-200 text-gray-800 px-3 py-1 text-xs font-semibold">
                    Line {grp.line}
                  </div>
                  {grp.items.map((rec, idx) => {
                    const inspection = (rec.Inspection || "").trim();
                    const seq = getInspectionSequence(rec) || 0;
                    const item = getItem(rec);
                    const desc = getItemDesc(rec);
                    const qtySU = getInspectQtySU(rec);
                    const storageUnit = getStorageUnit(rec);

                    const rowKey = `line-${grp.line}-seq-${seq}-${idx}`;
                    const isExpanded = expandedKey === rowKey;
                    const positions = positionsByKey[rowKey] || [];

                    return (
                      <div key={rowKey} className="space-y-2">
                        <button
                          type="button"
                          className="w-full text-left rounded-md border border-gray-300 p-3 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10"
                          onClick={async () => {
                            // Expand row immediately and show loading
                            setExpandedKey(rowKey);
                            setLoadingKey(rowKey);

                            // Use strict sequence from record to avoid 0
                            const strictSeq = Number(rec.InspectionSequence ?? seq ?? 0);

                            const { value } = await fetchPositions(inspection, strictSeq);
                            setLoadingKey(null);

                            // Always show positions (even if only one)
                            setPositionsByKey((prev) => ({ ...prev, [rowKey]: value }));
                            setExpandedKey(rowKey);

                            // Do NOT auto-select; user must pick a position now.
                          }}
                        >
                          <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                            <div className="flex flex-col">
                              <div className="text-sm sm:text-base text-gray-900 font-medium break-all">
                                {(inspection || "-")}{seq ? ` - ${seq}` : ""}
                              </div>
                              {item && (
                                <div className="mt-1 text-sm sm:text-base text-gray-900 break-all">
                                  {item}
                                </div>
                              )}
                              {desc && <div className="text-xs text-gray-700">{desc}</div>}
                            </div>
                            {(qtySU || storageUnit) && (
                              <div className="text-sm sm:text-base text-gray-900 text-right whitespace-nowrap">
                                {qtySU} {storageUnit}
                              </div>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="space-y-2">
                            {loadingKey === rowKey ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">Loading...</div>
                            ) : positions.length === 0 ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">No positions</div>
                            ) : (
                              positions.map((pos, pidx) => {
                                const pnum = Number(pos?.Position ?? 0);
                                const pQty = Number(pos?.QuantityToBeInspectedInStorageUnit ?? 0) || 0;
                                const pSU = typeof pos?.StorageUnit === "string" ? pos.StorageUnit : "";
                                const pItem =
                                  (typeof pos?.Item === "string" && pos.Item) ||
                                  (typeof pos?.ItemRef?.Item === "string" && pos.ItemRef.Item) ||
                                  "";
                                const pDesc =
                                  (typeof pos?.ItemRef?.Description === "string" && pos.ItemRef.Description) ||
                                  "";

                                return (
                                  <button
                                    key={`${rowKey}-pos-${pidx}`}
                                    type="button"
                                    className="w-full text-left rounded-md border border-gray-300 p-3 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                                    onClick={() => {
                                      const combined = { ...rec, __position: pos };
                                      onSelect(combined);
                                    }}
                                  >
                                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                      <div className="flex flex-col">
                                        <div className="text-sm sm:text-base text-gray-900 font-medium break-all">
                                          {(inspection || "-")}{seq ? ` - ${seq}` : ""}{Number.isFinite(pnum) && pnum !== 0 ? ` - ${pnum}` : ""}
                                        </div>
                                        {pItem && (
                                          <div className="mt-1 text-sm sm:text-base text-gray-900 break-all">
                                            {pItem}
                                          </div>
                                        )}
                                        {pDesc && <div className="text-xs text-gray-700">{pDesc}</div>}
                                      </div>
                                      <div className="text-sm sm:text-base text-gray-900 text-right whitespace-nowrap">
                                        {pQty} {pSU}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionResultsDialog;