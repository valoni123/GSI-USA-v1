import { useMemo, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type LanguageKey, t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const TransportGroup = () => {
  const { group } = useParams();
  const navigate = useNavigate();
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Array<{
    TransportID: string;
    Item: string;
    HandlingUnit: string;
    Warehouse: string;
    LocationFrom: string;
    LocationTo: string;
    VehicleID: string;
    PlannedDeliveryDate: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const pg = (group || "").toString();
      const { data } = await supabase.functions.invoke("ln-transport-planning-list", {
        body: { planningGroup: pg, language: locale, company: "1000" },
      });
      if (!active) return;
      if (data && data.ok) {
        setItems(data.items || []);
      } else {
        setError((data && (data.error?.message || data.error)) || "Failed to load");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [group, locale]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label={trans.back}
            onClick={() => navigate("/menu")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="font-bold text-lg">{trans.planningGroupTransport}: {group}</div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-md border bg-white p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-100">
            <div className="text-sm font-medium">
              {loading ? "Loading…" : `${items.length} ${items.length === 1 ? "entry" : "entries"}`}
            </div>
            {error && <div className="text-sm text-red-600 mt-1">{error}</div>}
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No entries</div>
            ) : (
              items.map((it, idx) => (
                <div key={`${it.TransportID}-${idx}`} className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <div className="font-semibold text-gray-700">{trans.transportIdLabel}:</div>
                    <div className="break-all text-gray-900">{it.TransportID || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.itemLabel}:</div>
                    <div className="break-all text-gray-900">{it.Item || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.loadHandlingUnit}:</div>
                    <div className="break-all text-gray-900">{it.HandlingUnit || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.warehouseLabel}:</div>
                    <div className="break-all text-gray-900">{it.Warehouse || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.locationFromLabel}:</div>
                    <div className="break-all text-gray-900">{it.LocationFrom || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.locationToLabel}:</div>
                    <div className="break-all text-gray-900">{it.LocationTo || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.loadVehicleId}:</div>
                    <div className="break-all text-gray-900">{it.VehicleID || "-"}</div>

                    <div className="font-semibold text-gray-700">{trans.plannedDateLabel}:</div>
                    <div className="break-all text-gray-900">
                      {it.PlannedDeliveryDate ? new Date(it.PlannedDeliveryDate).toLocaleString() : "-"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransportGroup;