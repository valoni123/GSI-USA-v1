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
        <div className="rounded-md border bg-white overflow-hidden">
          <div className="w-full overflow-x-auto">
            <div className="min-w-0">
              <div className="grid grid-cols-[110px_120px_minmax(0,1fr)] gap-3 px-4 py-2 bg-gray-100 border-b text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                <div>{trans.transportIdLabel}</div>
                <div>{trans.transportTypeLabel}</div>
                <div>{trans.itemLabel}</div>
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
              ) : (
                items.map((it, idx) => (
                  <div key={`${it.TransportID}-${it.HandlingUnit}-${idx}`} className="border-b px-4 py-2 text-xs">
                    <div className="grid grid-cols-[110px_120px_minmax(0,1fr)] gap-3 items-center">
                      <div className="font-medium text-gray-900 whitespace-nowrap">{cleanValue(it.TransportID)}</div>
                      <div className="whitespace-nowrap">
                        {it.TransportType ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getTransportTypeClasses(it.TransportType)}`}>
                            {cleanValue(it.TransportType)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </div>
                      <div className="text-gray-800 truncate">{cleanValue(it.Item)}</div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-gray-700">
                      <div>
                        <span className="font-semibold">{trans.loadHandlingUnit}:</span> {cleanValue(it.HandlingUnit)}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="truncate">
                          <span className="font-semibold">{trans.locationFromLabel}:</span> {cleanValue(it.LocationFrom)}
                        </div>
                        <div className="truncate">
                          <span className="font-semibold">{trans.locationToLabel}:</span> {cleanValue(it.LocationTo)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

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