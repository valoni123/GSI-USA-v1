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
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center">
          <div className="font-bold text-lg">{trans.planningGroupTransport}: {group}</div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="rounded-md border bg-white overflow-hidden">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1100px]">
              {/* Header row */}
              <div className="grid grid-cols-8 gap-3 px-4 py-2 bg-gray-100 border-b text-xs font-semibold text-gray-700">
                <div className="whitespace-nowrap">{trans.transportIdLabel}</div>
                <div className="whitespace-nowrap">{trans.itemLabel}</div>
                <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
                <div className="whitespace-nowrap">{trans.warehouseLabel}</div>
                <div className="whitespace-nowrap">{trans.locationFromLabel}</div>
                <div className="whitespace-nowrap">{trans.locationToLabel}</div>
                <div className="whitespace-nowrap">{trans.loadVehicleId}</div>
                <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
              </div>
              {/* Rows */}
              {loading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No entries</div>
              ) : (
                items.map((it, idx) => (
                  <div
                    key={`${it.TransportID}-${idx}`}
                    className="grid grid-cols-8 gap-3 px-4 py-2 border-b text-sm"
                  >
                    <div className="break-all whitespace-nowrap">{it.TransportID || "-"}</div>
                    <div className="break-all whitespace-nowrap">{it.Item || "-"}</div>
                    <div className="break-all whitespace-nowrap">{it.HandlingUnit || "-"}</div>
                    <div className="break-all whitespace-nowrap">{it.Warehouse || "-"}</div>
                    <div className="break-all whitespace-nowrap">{it.LocationFrom || "-"}</div>
                    <div className="break-all whitespace-nowrap">{it.LocationTo || "-"}</div>
                    <div className="break-all whitespace-nowrap">{it.VehicleID || "-"}</div>
                    <div className="break-all whitespace-nowrap">
                      {it.PlannedDeliveryDate ? new Date(it.PlannedDeliveryDate).toLocaleString() : "-"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransportGroup;