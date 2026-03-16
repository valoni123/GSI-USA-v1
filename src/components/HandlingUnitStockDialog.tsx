import { useMemo } from "react";
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
                const key = normalizeStatus(row.Status);
                return (
                  <div key={`${row.HandlingUnit}-${index}`} className="rounded-md border bg-gray-50 p-3">
                    <div className="grid grid-cols-[138px_1fr] gap-x-3 gap-y-2 text-sm">
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
