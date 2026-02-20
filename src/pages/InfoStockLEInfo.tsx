import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, Search } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showError, showLoading, showSuccess, dismissToast } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import ScreenSpinner from "@/components/ScreenSpinner";

type HUInfo = {
  handlingUnit?: string | null;
  item?: string | null;
  warehouse?: string | null;
  location?: string | null;
  lot?: string | null;
  status?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  fullyBlocked?: boolean | null;
  blockedForOutbound?: boolean | null;
  blockedForTransferIssue?: boolean | null;
  blockedForCycleCounting?: boolean | null;
  blockedForAssembly?: boolean | null;
};

const InfoStockLEInfo = () => {
  const navigate = useNavigate();

  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);

  const [fullName, setFullName] = useState<string>("");
  useEffect(() => {
    const name = localStorage.getItem("gsi.full_name");
    if (name) setFullName(name);
  }, []);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const huRef = useRef<HTMLInputElement | null>(null);
  const [handlingUnit, setHandlingUnit] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<HUInfo | null>(null);
  const [lastFetchedHu, setLastFetchedHu] = useState<string | null>(null);

  useEffect(() => {
    huRef.current?.focus();
  }, []);

  const fetchHU = async (hu: string) => {
    const trimmed = (hu || "").trim();
    if (!trimmed) {
      setData(null);
      setLastFetchedHu(null);
      return;
    }
    setLoading(true);
    const tid = showLoading(trans.loadingDetails);
    const { data, error } = await supabase.functions.invoke("ln-handling-unit-info", {
      body: { handlingUnit: trimmed, language: locale, company: "1100" },
    });
    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      showError(trans.huNotFoundGeneric);
      setData(null);
      setLoading(false);
      return;
    }

    const info: HUInfo = {
      handlingUnit: data.handlingUnit ?? trimmed,
      item: data.item ?? null,
      warehouse: data.warehouse ?? null,
      location: data.location ?? null,
      lot: data.lot ?? null,
      status: data.status ?? null,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      fullyBlocked: !!data.fullyBlocked,
      blockedForOutbound: !!data.blockedForOutbound,
      blockedForTransferIssue: !!data.blockedForTransferIssue,
      blockedForCycleCounting: !!data.blockedForCycleCounting,
      blockedForAssembly: !!data.blockedForAssembly,
    };
    setData(info);
    setLastFetchedHu(trimmed);
    setLoading(false);
  };

  // Normalize LN status to internal key
  const normalizeStatus = (raw?: string | null): string | null => {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    // Common raw values mapping
    if (["im bestand", "instock", "in stock"].includes(s)) return "instock";
    if (["staged", "zum versand bereit", "bereit zum versand", "ready to ship"].includes(s)) return "staged";
    if (["toinspect", "zu prüfen", "zu pruefen", "to inspect", "inspection"].includes(s)) return "toinspect";
    if (["intransit", "in transit"].includes(s)) return "intransit";
    if (["shipped", "versendet"].includes(s)) return "shipped";
    if (["blocked", "gesperrt"].includes(s)) return "blocked";
    if (["quarantine", "quarantäne", "quarantaene"].includes(s)) return "quarantine";
    if (["close", "geschlossen", "closed"].includes(s)) return "close";
    return s; // fallback to raw normalized text for unknown values
  };

  // Localized label for status key
  const statusLabel = (key: string | null) => {
    if (!key) return "-";
    switch (key) {
      case "instock":
        return lang === "de" ? "Im Bestand" : lang === "es-MX" ? "En inventario" : lang === "pt-BR" ? "Em estoque" : "In Stock";
      case "staged":
        return lang === "de" ? "Zum Versand Bereit" : lang === "es-MX" ? "Preparado para envío" : lang === "pt-BR" ? "Pronto para envio" : "Staged";
      case "toinspect":
        return lang === "de" ? "Zu prüfen" : lang === "es-MX" ? "Por inspeccionar" : lang === "pt-BR" ? "A inspecionar" : "To Inspect";
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
        // Fallback: show original (capitalized)
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  };

  // Style for status key
  const statusStyle = (key: string | null) => {
    if (!key) return "bg-gray-200 text-gray-800";
    switch (key) {
      case "instock":
        return "bg-[#78d8a3] text-black";
      case "staged":
        return "bg-[#fcc888] text-black";
      case "toinspect":
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

  const onHUBlur = async () => {
    const hu = handlingUnit.trim();
    if (!hu) return;
    if (lastFetchedHu !== hu) {
      await fetchHU(hu);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/info-stock")} />

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.infoStockLEInfo}</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4" />
              <span className="line-clamp-1">{fullName || ""}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-white/10"
            aria-label={trans.signOut}
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Form + Results */}
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FloatingLabelInput
                id="leInfoHandlingUnit"
                label={trans.loadHandlingUnit}
                ref={huRef}
                value={handlingUnit}
                onChange={(e) => {
                  const v = e.target.value;
                  setHandlingUnit(v);
                  if (v.trim() === "") {
                    setData(null);
                    setLastFetchedHu(null);
                  }
                }}
                onBlur={onHUBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const hu = handlingUnit.trim();
                    if (hu) fetchHU(hu);
                  }
                }}
                autoFocus
                onFocus={(e) => {
                  if (e.currentTarget.value.length > 0) e.currentTarget.select();
                }}
                onClick={(e) => {
                  if (e.currentTarget.value.length > 0) e.currentTarget.select();
                }}
                onClear={() => {
                  setHandlingUnit("");
                  setData(null);
                  setLastFetchedHu(null);
                  huRef.current?.focus();
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={
                handlingUnit.trim()
                  ? "h-10 w-10 bg-red-600 hover:bg-red-700 text-white"
                  : "h-10 w-10 text-gray-700 hover:text-gray-900"
              }
              aria-label={trans.searchLabel}
              onClick={() => {
                const hu = handlingUnit.trim();
                if (hu) fetchHU(hu);
              }}
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>

          {/* Details */}
          <div className="mt-2 rounded-md min-h-28 p-3">
            {loading ? (
              <div className="text-muted-foreground text-sm">{trans.loadingDetails}</div>
            ) : !data ? (
              (handlingUnit.trim() === "" && lastFetchedHu === null) ? null : (
                <div className="text-muted-foreground text-sm">{trans.noEntries}</div>
              )
            ) : (
              <div className="text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 items-start">
                  <div className="font-semibold text-gray-700">{trans.itemLabel}:</div>
                  <div className="break-all text-gray-900">{data.item ?? "-"}</div>

                  <div className="font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                  <div className="break-all text-gray-900">{data.warehouse ?? "-"}</div>

                  <div className="font-semibold text-gray-700">{trans.locationLabel}:</div>
                  <div className="break-all text-gray-900">{data.location ?? "-"}</div>

                  <div className="font-semibold text-gray-700">{trans.quantityLabel}:</div>
                  <div className="break-all text-gray-900">
                    {data.quantity ?? "-"} {data.unit ? <span className="ml-2 text-gray-700">{data.unit}</span> : ""}
                  </div>

                  <div className="font-semibold text-gray-700">{trans.lotLabel}:</div>
                  <div className="break-all text-gray-900">{data.lot ?? "-"}</div>

                  <div className="font-semibold text-gray-700">{trans.statusLabel}:</div>
                  <div className="break-all text-gray-900">
                    {(() => {
                      const key = normalizeStatus(data.status as string | null);
                      const label = statusLabel(key);
                      const cls = statusStyle(key);
                      return (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Blocked flags */}
                <div className="mt-4">
                  <div className="text-base font-semibold text-gray-800">{trans.blockedLabel}:</div>
                  <ul className="mt-1 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.fullyBlocked ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-xs text-gray-800">{trans.blockedFullyLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForOutbound ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-xs text-gray-800">{trans.blockedOutboundLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForTransferIssue ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-xs text-gray-800">{trans.blockedTransferIssueLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForCycleCounting ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-xs text-gray-800">{trans.blockedCycleCountingLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForAssembly ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-xs text-gray-800">{trans.blockedAssemblyLabel}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Sign-out confirmation dialog */}
      <SignOutConfirm
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={trans.signOutTitle}
        question={trans.signOutQuestion}
        yesLabel={trans.yes}
        noLabel={trans.no}
        onConfirm={onConfirmSignOut}
      />

      {/* Overlay spinner if needed */}
      {loading && <ScreenSpinner message={trans.loadingDetails} />}
    </div>
  );
};

export default InfoStockLEInfo;