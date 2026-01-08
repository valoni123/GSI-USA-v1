import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { dismissToast, showLoading, showSuccess } from "@/utils/toast";
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
  const [result, setResult] = useState<{ Item?: string; LocationFrom?: string; LocationTo?: string } | null>(null);
  const [errorOpen, setErrorOpen] = useState<boolean>(false);
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

  const onHUBlur = async () => {
    const hu = handlingUnit.trim();
    if (!hu) return;
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
    const first = data.first as { Item?: string; LocationFrom?: string; LocationTo?: string } | null;
    setResult(first || null);
    setVehicleEnabled(true);
    // Focus vehicle input
    setTimeout(() => vehicleRef.current?.focus(), 50);
  };

  const onErrorConfirm = () => {
    setErrorOpen(false);
    setResult(null);
    setVehicleEnabled(false);
    setHandlingUnit("");
    setVehicleId("");
    // Refocus HU
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
            <div className="font-bold text-lg tracking-wide text-center">{trans.transportLoad}</div>
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
            onChange={(e) => setHandlingUnit(e.target.value)}
            onBlur={onHUBlur}
          />
          <FloatingLabelInput
            id="vehicleId"
            label={trans.loadVehicleId}
            ref={vehicleRef}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!vehicleEnabled}
          />
          {/* Red result area */}
          <div className="mt-2 rounded-md min-h-28 p-3">
            {result ? (
              <div className="space-y-1 text-sm">
                <div><span className="font-semibold">{trans.itemLabel}:</span> <span className="break-all">{result.Item ?? "-"}</span></div>
                <div><span className="font-semibold">{trans.locationFromLabel}:</span> <span className="break-all">{result.LocationFrom ?? "-"}</span></div>
                <div><span className="font-semibold">{trans.locationToLabel}:</span> <span className="break-all">{result.LocationTo ?? "-"}</span></div>
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
            className="w-full h-12 text-base bg-gray-500 text-white !opacity-100 disabled:!opacity-100"
            disabled
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