import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import ScreenSpinner from "@/components/ScreenSpinner";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const cleanValue = (value: string) => {
  const trimmed = (value || "").trim();
  return trimmed || "-";
};

const TransportsList = () => {
  const navigate = useNavigate();
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Array<{
    TransportID: string;
    TransportType: string;
    Item: string;
    HandlingUnit: string;
    LocationFrom: string;
    LocationTo: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const selectedVehicleId = (localStorage.getItem("transports.vehicle.id") || localStorage.getItem("vehicle.id") || "").trim();

  const getTransportTypeClasses = (transportType: string) => {
    const normalized = (transportType || "").trim().toLowerCase();
    if (normalized === "aisleout" || normalized === "aisle out") {
      return "bg-yellow-100 text-yellow-900 border border-yellow-200";
    }
    if (normalized === "aislein" || normalized === "aisle in") {
      return "bg-green-100 text-green-900 border border-green-200";
    }
    if (normalized === "replenishment") {
      return "bg-orange-100 text-orange-900 border border-orange-200";
    }
    return "bg-gray-100 text-gray-800 border border-gray-200";
  };

  const loadItems = async () => {
    setLoading(true);
    setError(null);

    if (!selectedVehicleId) {
      setItems([]);
      setError("Missing vehicle");
      setLoading(false);
      return;
    }

    const { data } = await supabase.functions.invoke("ln-transports-list", {
      body: { vehicleId: selectedVehicleId, language: locale },
    });

    if (data && data.ok) {
      setItems(data.items || []);
      setError(null);
    } else {
      setItems([]);
      setError((data && (data.error?.message || data.error)) || "Failed to load");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [locale]);

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
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {loading && <ScreenSpinner message={trans.pleaseWait} />}

      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between gap-3">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu/transports")} />

          <div className="flex-1 font-bold text-lg text-center">
            {trans.appTransports}
            {selectedVehicleId && (
              <span className="ml-3 inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1 align-middle">
                {trans.loadVehicleId}: {selectedVehicleId}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-white/10"
            aria-label={trans.signOut}
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        {items.length === 0 ? (
          <div className="rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={`${it.TransportID}-${it.HandlingUnit}-${idx}`}
                className="rounded-xl border-2 border-gray-700 bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center gap-3 text-sm leading-5">
                  <span className="font-semibold text-gray-700 whitespace-nowrap">{cleanValue(it.TransportID)}</span>
                  <div className="min-w-0 text-gray-700 truncate">
                    <span className="text-gray-500">{trans.itemLabel}:</span>{" "}
                    <span className="font-semibold text-gray-800">{cleanValue(it.Item)}</span>
                  </div>
                </div>

                <div className="mt-1 text-sm leading-5 text-gray-700 truncate">
                  <span className="text-gray-500">{trans.loadHandlingUnit}:</span>{" "}
                  <span className="font-semibold text-gray-800">{cleanValue(it.HandlingUnit)}</span>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-3 text-sm leading-5 text-gray-700">
                  <div className="min-w-0 truncate">
                    <span className="text-gray-500">{trans.fromLabel}:</span>{" "}
                    <span className="font-medium text-gray-800">{cleanValue(it.LocationFrom)}</span>
                  </div>
                  <div className="min-w-0 truncate">
                    <span className="text-gray-500">{trans.toLabel}:</span>{" "}
                    <span className="font-medium text-gray-800">{cleanValue(it.LocationTo)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
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

export default TransportsList;