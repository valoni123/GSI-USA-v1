import { useMemo } from "react";
import { ArrowRightLeft, ArrowUpRight, Eraser, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type LanguageKey, t } from "@/lib/i18n";

export type HandlingUnitStockRow = {
  HandlingUnit: string;
  Status: string | null;
  Unit: string | null;
  QuantityInInventoryUnit: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: LanguageKey;
  rows: HandlingUnitStockRow[];
  loading: boolean;
  location?: string;
  onOpenHandlingUnit: (handlingUnit: string) => void;
  onMoveHandlingUnit: (handlingUnit: string) => void;
  onAdjustHandlingUnit: (handlingUnit: string) => void;
  onPrintHandlingUnit: (row: HandlingUnitStockRow) => void;
};

const normalizeStatus = (raw?: string | null): string | null => {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (["im bestand", "instock", "in stock"].includes(s)) return "instock";
  if (["staged", "zum versand bereit", "bereit zum versand", "ready to ship"].includes(s)) return "staged";
  if (["tobeinspected", "toinspect", "zu prüfen", "zu pruefen", "to be inspected", "to inspect", "inspection"].includes(s)) return "tobeinspected";
  if (["intransit", "in transit"].includes(s)) return "intransit";
  if (["shipped", "versendet"].includes(s)) return "shipped";
  if (["blocked", "gesperrt"].includes(s)) return "blocked";
  if (["quarantine", "quarantäne", "quarantaene"].includes(s)) return "quarantine";
  if (["close", "geschlossen", "closed"].includes(s)) return "close";
  return s;
};

const statusLabel = (key: string | null, lang: LanguageKey) => {
  if (!key) return "-";
  switch (key) {
    case "instock":
      return lang === "de" ? "Im Bestand" : lang === "es-MX" ? "En inventario" : lang === "pt-BR" ? "Em estoque" : "In Stock";
    case "staged":
      return lang === "de" ? "Zum Versand Bereit" : lang === "es-MX" ? "Preparado para envío" : lang === "pt-BR" ? "Pronto para envio" : "Staged";
    case "tobeinspected":
      return lang === "de" ? "Zu prüfen" : lang === "es-MX" ? "Por inspeccionar" : lang === "pt-BR" ? "A inspecionar" : "To be inspected";
    case "intransit":
      return lang === "de" ? "Unterwegs" : lang === "es-MX" ? "En tránsito" : lang === "pt-BR" ? "Em trânsito" : "In Transit";
    case "shipped":
      return lang === "de" ? "Versendet" : lang === "es-MX" ? "Enviado" : lang === "pt-BR" ? "Enviado" : "Shipped";
    case "blocked":
    case "quarantine":
      return lang === "de" ? "Gesperrt / Quarantäne" : lang === "es-MX" ? "Bloqueado / Cuarentena" : lang === "pt-BR" ? "Bloqueado / Quarentena" : "Blocked / Quarantine";
    case "close":
      return lang === "de" ? "Geschlossen" : lang === "es-MX" ? "Cerrado" : lang === "pt-BR" ? "Fechado" : "Closed";
    default:
      return key.charAt(0).toUpperCase() + key.slice(1);
  }
};

const statusStyle = (key: string | null) => {
  if (!key) return "bg-gray-200 text-gray-800";
  switch (key) {
    case "instock":
      return "bg-[#78d8a3] text-black";
    case "staged":
      return "bg-[#fcc888] text-black";
    case "tobeinspected":
      return "bg-[#a876eb] text-white";
    case "intransit":
      return "bg-[#55a3f3] text-black";
    case "shipped":
      return "bg-[#8e8e95] text-white";
    case "blocked":
    case "quarantine":
      return "bg-[#e66467] text-white";
    case "close":
      return "bg-[#28282a] text-white";
    default:
      return "bg-gray-300 text-black";
  }
};

const actionButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md shadow disabled:cursor-not-allowed disabled:opacity-50";

const HandlingUnitStockDialog = ({
  open,
  onOpenChange,
  lang,
  rows,
  loading,
  location,
  onOpenHandlingUnit,
  onMoveHandlingUnit,
  onAdjustHandlingUnit,
  onPrintHandlingUnit,
}: Props) => {
  const trans = useMemo(() => t(lang), [lang]);
  const displayLocation = (location || "").trim();

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
                const key = normalizeStatus(row.Status);
                const stockActionsEnabled = key === "instock";

                return (
                  <div key={`${row.HandlingUnit}-${index}`} className="rounded-md border bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm items-center">
                          <div className="font-semibold text-gray-700">{trans.loadHandlingUnit}:</div>
                          <div className="break-all text-gray-900">{row.HandlingUnit || "-"}</div>

                          <div className="font-semibold text-gray-700">{trans.statusLabel}:</div>
                          <div>
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${statusStyle(key)}`}>
                              {statusLabel(key, lang)}
                            </span>
                          </div>

                          <div className="font-semibold text-gray-700">{trans.quantityLabel}:</div>
                          <div className="break-all text-gray-900">{quantityText}</div>

                          {displayLocation && (
                            <>
                              <div className="font-semibold text-gray-700">{trans.locationLabel}:</div>
                              <div className="break-all text-gray-900">{displayLocation}</div>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label={trans.infoStockLEInfo}
                        className={`${actionButtonClass} bg-zinc-700 text-white hover:bg-zinc-800`}
                        onClick={() => onOpenHandlingUnit(row.HandlingUnit)}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        aria-label={trans.leInfoMove}
                        className={`${actionButtonClass} bg-[#78d8a3] text-black hover:bg-[#69c892]`}
                        onClick={() => onMoveHandlingUnit(row.HandlingUnit)}
                        disabled={!stockActionsEnabled}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={trans.adjustAction}
                        className={`${actionButtonClass} bg-[#fdba74] text-black hover:bg-[#f7a959]`}
                        onClick={() => onAdjustHandlingUnit(row.HandlingUnit)}
                        disabled={!stockActionsEnabled}
                      >
                        <Eraser className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={trans.leInfoPrintLabel}
                        className={`${actionButtonClass} bg-[#3f3f46] text-white hover:bg-[#27272a]`}
                        onClick={() => onPrintHandlingUnit(row)}
                      >
                        <Printer className="h-4 w-4" />
                      </button>
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