import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type LanguageKey, t } from "@/lib/i18n";

export type HandlingUnitStockRow = {
  HandlingUnit: string;
  ParentHandlingUnit: string | null;
  Status: string | null;
  Lot: string | null;
  Location: string | null;
  MultiItemHandlingUnit: boolean;
  FullyBlocked: boolean;
  BlockedForOutbound: boolean;
  BlockedForTransferIssue: boolean;
  BlockedForCycleCounting: boolean;
  BlockedForAssembly: boolean;
  Unit: string | null;
  QuantityInInventoryUnit: number;
  GrossWeight: number | null;
  NetWeight: number | null;
  WeightUnit: string | null;
  Height: number | null;
  Width: number | null;
  Length: number | null;
  DimensionUnit: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: LanguageKey;
  rows: HandlingUnitStockRow[];
  loading: boolean;
};

const HandlingUnitStockDialog = ({ open, onOpenChange, lang, rows, loading }: Props) => {
  const trans = useMemo(() => t(lang), [lang]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-lg bg-white p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{trans.handlingUnitStockLabel}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">{trans.loadingList}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">{trans.noEntries}</div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => {
                const quantityText = `${row.QuantityInInventoryUnit}${row.Unit ? ` ${row.Unit}` : ""}`;
                return (
                  <div key={`${row.HandlingUnit}-${index}`} className="rounded-md border bg-gray-50 p-3">
                    <div className="grid grid-cols-[138px_1fr] gap-x-3 gap-y-1 text-sm">
                      <div className="font-semibold text-gray-700">{trans.loadHandlingUnit}:</div>
                      <div className="break-all text-gray-900">{row.HandlingUnit || "-"}</div>

                      <div className="font-semibold text-gray-700">{trans.statusLabel}:</div>
                      <div className="break-all text-gray-900">{row.Status || "-"}</div>

                      <div className="font-semibold text-gray-700">{trans.locationLabel}:</div>
                      <div className="break-all text-gray-900">{row.Location || "-"}</div>

                      <div className="font-semibold text-gray-700">{trans.lotLabel}:</div>
                      <div className="break-all text-gray-900">{row.Lot || "-"}</div>

                      <div className="font-semibold text-gray-700">{trans.quantityLabel}:</div>
                      <div className="break-all text-gray-900">{quantityText}</div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-semibold text-gray-700">{trans.blockedLabel}:</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${row.FullyBlocked ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                          {trans.blockedFullyLabel}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${row.BlockedForOutbound ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                          {trans.blockedOutboundLabel}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${row.BlockedForTransferIssue ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                          {trans.blockedTransferIssueLabel}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${row.BlockedForCycleCounting ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                          {trans.blockedCycleCountingLabel}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${row.BlockedForAssembly ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                          {trans.blockedAssemblyLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HandlingUnitStockDialog;
