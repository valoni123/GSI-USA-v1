import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";

type TransportLineLoadState = {
  prefillValue?: string;
  vehicleId?: string;
};

const TransportLineLoad = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as TransportLineLoadState | null) || null;

  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);

  const [fullName, setFullName] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [transportValue, setTransportValue] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  useEffect(() => {
    const name = localStorage.getItem("gsi.full_name");
    if (name) setFullName(name);
  }, []);

  useEffect(() => {
    const storedPrefill = (sessionStorage.getItem("transport.line.load.prefill") || "").trim();
    const storedVehicle = (
      routeState?.vehicleId ||
      localStorage.getItem("transports.vehicle.id") ||
      localStorage.getItem("vehicle.id") ||
      sessionStorage.getItem("transport.line.load.vehicle") ||
      ""
    ).trim();
    const nextPrefill = (routeState?.prefillValue || storedPrefill).trim();

    setTransportValue(nextPrefill);
    setVehicleId(storedVehicle);

    sessionStorage.removeItem("transport.line.load.prefill");
    sessionStorage.removeItem("transport.line.load.vehicle");
  }, [routeState]);

  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
      localStorage.removeItem("vehicle.id");
      localStorage.removeItem("transports.vehicle.id");
      localStorage.removeItem("transport.count");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/transports/list")} />

          <div className="flex flex-col items-center flex-1">
            <button
              type="button"
              onClick={() => navigate("/menu/transports/list")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg tracking-wide text-black hover:opacity-80"
            >
              Transport-Load
            </button>
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

      <div className="mx-auto max-w-md px-4 py-6">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <FloatingLabelInput
            id="transportLineLoadValue"
            label="Handling Unit / Item"
            value={transportValue}
            onChange={(e) => setTransportValue(e.target.value)}
          />

          <FloatingLabelInput
            id="transportLineLoadVehicle"
            label={trans.loadVehicleId}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          />
        </Card>
      </div>

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

export default TransportLineLoad;
