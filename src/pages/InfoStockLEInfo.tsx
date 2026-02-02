import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
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
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label={trans.back}
            onClick={() => navigate("/menu/info-stock")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

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

          {/* Details */}
          <div className="mt-2 rounded-md min-h-28 p-3">
            {loading ? (
              <div className="text-muted-foreground text-sm">{trans.loadingDetails}</div>
            ) : !data ? (
              <div className="text-muted-foreground text-sm">{trans.noEntries}</div>
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
                  <div className="break-all text-gray-900">{data.status ?? "-"}</div>
                </div>

                {/* Blocked flags */}
                <div className="mt-4">
                  <div className="text-[11px] font-semibold text-gray-700">{trans.blockedLabel}:</div>
                  <ul className="mt-1 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.fullyBlocked ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-sm text-gray-800">{trans.blockedFullyLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForOutbound ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-sm text-gray-800">{trans.blockedOutboundLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForTransferIssue ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-sm text-gray-800">{trans.blockedTransferIssueLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForCycleCounting ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-sm text-gray-800">{trans.blockedCycleCountingLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${data.blockedForAssembly ? "bg-red-600" : "bg-gray-300"}`} />
                      <span className="text-sm text-gray-800">{trans.blockedAssemblyLabel}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            onClick={() => fetchHU(handlingUnit)}
            disabled={handlingUnit.trim() === ""}
          >
            {trans.searchLabel}
          </Button>
        </div>
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