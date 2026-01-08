import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { dismissToast, showLoading, showSuccess, showError } from "@/utils/toast";
import { type LanguageKey, t } from "@/lib/i18n";

const TransportLoad = () => {
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
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const huRef = useRef<HTMLInputElement | null>(null);
  const vehicleRef = useRef<HTMLInputElement | null>(null);
  const [handlingUnit, setHandlingUnit] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleEnabled, setVehicleEnabled] = useState<boolean>(false);
  const [result, setResult] = useState<{ TransportID?: string; Item?: string; Warehouse?: string; LocationFrom?: string; LocationTo?: string; ETag?: string } | null>(null);
  const [errorOpen, setErrorOpen] = useState<boolean>(false);
  const [lastFetchedHu, setLastFetchedHu] = useState<string | null>(null);
  const [etag, setEtag] = useState<string>("");
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  useEffect(() => {
    // Focus the first field on mount
    huRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("ln-transport-count", {
        body: { vehicleId: "E-BC", language: locale, company: "1000" },
      });
      if (!active) return;
      if (error || !data || !data.ok) {
        setLoadedCount(0);
        return;
      }
      setLoadedCount(Number(data.count || 0));
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  const onHUBlur = async () => {
    const hu = handlingUnit.trim();
    if (!hu) return;
    
    // Only check if details are empty (first time) or the HU value changed
    const shouldCheck = result === null || lastFetchedHu !== hu;
    if (!shouldCheck) return;
    
    const tid = showLoading(trans.checkingHandlingUnit);
    const { data, error } = await supabase.functions.invoke("ln-transport-orders", {
      body: { handlingUnit: hu, language: locale, company: "1000" },
    });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      setErrorOpen(true);
      return;
    }
    if ((data.count ?? 0) === 0) {
      setErrorOpen(true);
      return;
    }
    const first = data.first as { TransportID?: string; Item?: string; Warehouse?: string; LocationFrom?: string; LocationTo?: string; ETag?: string } | null;
    setResult(first || null);
    // Capture ETag from the response (prefer normalized field; fallback to raw)
    const raw = (data.raw as any) || {};
    const rawFirst = Array.isArray(raw.value) && raw.value.length > 0 ? raw.value[0] : null;
    const etagValue =
      (first && typeof first.ETag === "string" && first.ETag) ||
      (rawFirst && typeof rawFirst?.["@odata.etag"] === "string" && rawFirst["@odata.etag"]) ||
      "";
    setEtag(etagValue);
    setVehicleEnabled(true);
    setLastFetchedHu(hu);
    // Focus vehicle input
    setTimeout(() => vehicleRef.current?.focus(), 50);
  };

  const onErrorConfirm = () => {
    setErrorOpen(false);
    setResult(null);
    setVehicleEnabled(false);
    setHandlingUnit("");
    setVehicleId("");
    setLastFetchedHu(null);
    setEtag("");
    // Refocus HU
    setTimeout(() => huRef.current?.focus(), 50);
  };

  const canLoad = vehicleEnabled && vehicleId.trim().length > 0;

  const onLoadClick = async () => {
    if (!canLoad || !result) return;
    const employeeCode = (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();
    const payload = {
      handlingUnit: handlingUnit.trim(),
      fromWarehouse: (result.Warehouse || "").trim(),
      fromLocation: (result.LocationFrom || "").trim(),
      toWarehouse: (result.Warehouse || "").trim(),
      toLocation: vehicleId.trim(),
      employee: employeeCode,
      language: locale,
      company: "1000",
    };
    const tid = showLoading("Bewegung wird ausgeführt…");
    const { data, error } = await supabase.functions.invoke("ln-move-to-location", { body: payload });
    dismissToast(tid as unknown as string);
    if (error || !data || !data.ok) {
      const err = (data && data.error) || error;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      return;
    }
    showSuccess("Erfolgreich auf Fahrzeug geladen");

    // PATCH Transport order to set VehicleID and LocationDevice = Fahrzeug-ID
    const patchTid = showLoading("Transportauftrag wird aktualisiert…");
    const { data: patchData, error: patchErr } = await supabase.functions.invoke("ln-update-transport-order", {
      body: {
        transportId: (result.TransportID || "").trim(),
        etag: etag.trim(),
        vehicleId: vehicleId.trim(),
        language: locale,
        company: "1000",
      },
    });
    dismissToast(patchTid as unknown as string);
    if (patchErr || !patchData || !patchData.ok) {
      const err = (patchData && patchData.error) || patchErr;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      return;
    }

    // Clear form and reset after successful PATCH
    setHandlingUnit("");
    setVehicleId("");
    setResult(null);
    setVehicleEnabled(false);
    setLastFetchedHu(null);
    setEtag("");
    setTimeout(() => huRef.current?.focus(), 50);
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
            onClick={() => navigate("/menu/transport")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center flex items-center gap-2">
              <span>{trans.transportLoad}</span>
              <span className="bg-red-600 text-white rounded-full min-w-5 h-5 px-2 flex items-center justify-center text-xs font-bold">
                {loadedCount}
              </span>
            </div>
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

      {/* Form area */}
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <FloatingLabelInput
            id="handlingUnit"
            label={trans.loadHandlingUnit}
            autoFocus
            ref={huRef}
            value={handlingUnit}
            onChange={(e) => {
              const v = e.target.value;
              setHandlingUnit(v);
              if (v.trim() === "") {
                // When HU is cleared, reset the info area and disable Vehicle ID
                setResult(null);
                setVehicleEnabled(false);
                setVehicleId("");
                setLastFetchedHu(null);
                setEtag("");
              }
            }}
            onBlur={onHUBlur}
            onFocus={(e) => {
              // Select the full value when focusing the field
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              // If user clicks while focused, keep the full selection
              if (e.currentTarget.value.length > 0) {
                e.currentTarget.select();
              }
            }}
          />
          <FloatingLabelInput
            id="vehicleId"
            label={trans.loadVehicleId}
            ref={vehicleRef}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!vehicleEnabled}
            onFocus={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
            onClick={(e) => {
              if (e.currentTarget.value.length > 0) e.currentTarget.select();
            }}
          />
          {/* Red result area */}
          <div className="mt-2 rounded-md min-h-28 p-3">
            {result ? (
              <div className="text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 items-start">
                  <div className="font-semibold text-gray-700">{trans.transportIdLabel}:</div>
                  <div className="break-all text-gray-900">{result.TransportID ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.itemLabel}:</div>
                  <div className="break-all text-gray-900">{result.Item ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                  <div className="break-all text-gray-900">{result.Warehouse ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.locationFromLabel}:</div>
                  <div className="break-all text-gray-900">{result.LocationFrom ?? "-"}</div>
                  <div className="font-semibold text-gray-700">{trans.locationToLabel}:</div>
                  <div className="break-all text-gray-900">{result.LocationTo ?? "-"}</div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm"> </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            className={
              canLoad
                ? "w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white"
                : "w-full h-12 text-base bg-gray-600 text-white disabled:opacity-100"
            }
            disabled={!canLoad}
            onClick={onLoadClick}
          >
            {trans.loadAction}
          </Button>
        </div>
      </div>

      {/* Error dialog: HU not found */}
      <AlertDialog open={errorOpen} onOpenChange={setErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{trans.huNotFound}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onErrorConfirm}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
};

export default TransportLoad;