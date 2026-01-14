import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SignOutConfirm from "@/components/SignOutConfirm";
import { supabase } from "@/integrations/supabase/client";
import { dismissToast, showLoading, showSuccess, showError } from "@/utils/toast";
import { type LanguageKey, t } from "@/lib/i18n";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ScreenSpinner from "@/components/ScreenSpinner";

type LoadedItem = {
  TransportID?: string;
  HandlingUnit: string;
  Item: string;
  LocationFrom: string;
  LocationTo: string;
  Warehouse?: string;
  ETag?: string;
};

const TransportUnload = () => {
  const navigate = useNavigate();

  const [lang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });
  const trans = useMemo(() => t(lang), [lang]);
  // Build localized label for "From → To" without the word "Location"
  const fromToLabel = `${trans.fromLabel} --> ${trans.toLabel}`;

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

  const [items, setItems] = useState<LoadedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [processing, setProcessing] = useState<boolean>(false);
  // NEW: map HU → Quantity and Unit
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  // Simple sleep helper for pacing and retry waits
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const MAX_UNLOAD_RETRY = 3;

  const fetchLoaded = async () => {
    const vehicleId = (localStorage.getItem("vehicle.id") || "").trim();
    if (!vehicleId) {
      navigate("/menu/transport");
      return;
    }
    const tid = showLoading("Lade Einträge…");
    const { data } = await supabase.functions.invoke("ln-transport-list", {
      body: { vehicleId, language: locale, company: "1000" },
    });
    dismissToast(tid as unknown as string);
    if (data && data.ok) {
      const list = (data.items || []) as LoadedItem[];
      setItems(list);
      const nextCount = Number(data.count ?? list.length ?? 0);
      setLoadedCount(nextCount);
      try {
        localStorage.setItem("transport.count", String(nextCount));
      } catch {}
    } else {
      setItems([]);
      setLoadedCount(0);
      try {
        localStorage.setItem("transport.count", "0");
      } catch {}
    }
    setLoading(false);
  };

  const fetchCount = async () => {
    const vid = (localStorage.getItem("vehicle.id") || "").trim();
    if (!vid) {
      setLoadedCount(0);
      try { localStorage.setItem("transport.count", "0"); } catch {}
      return;
    }
    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId: vid, language: locale, company: "1000" },
    });
    const next = data && data.ok ? Number(data.count || 0) : 0;
    setLoadedCount(next);
    try {
      localStorage.setItem("transport.count", String(next));
    } catch {}
  };

  // NEW: fetch quantities and units for current items
  const fetchQuantities = async (list: LoadedItem[]) => {
    if (!list || list.length === 0) {
      setQuantities({});
      setUnits({});
      return;
    }
    const entries = await Promise.all(
      list.map(async (it) => {
        const hu = (it.HandlingUnit || "").trim();
        if (!hu) return [hu, "", ""] as const;
        const { data } = await supabase.functions.invoke("ln-handling-unit-info", {
          body: { handlingUnit: hu, language: locale, company: "1000" },
        });
        const qty = data && data.ok ? String(data.quantity ?? "") : "";
        const unit = data && data.ok ? String(data.unit ?? "") : "";
        return [hu, qty, unit] as const;
      })
    );
    const qtyMap: Record<string, string> = {};
    const unitMap: Record<string, string> = {};
    for (const [hu, qty, unit] of entries) {
      if (hu) {
        qtyMap[hu] = qty;
        unitMap[hu] = unit;
      }
    }
    setQuantities(qtyMap);
    setUnits(unitMap);
  };

  useEffect(() => {
    fetchLoaded();
    // Initialize badge from localStorage, no REST call
    const cached = Number(localStorage.getItem("transport.count") || "0");
    setLoadedCount(cached);
  }, [locale]);

  // NEW: when items change, refresh quantities
  useEffect(() => {
    fetchQuantities(items);
  }, [items, locale]);

  // Determine if all LocationTo values are identical and non-empty
  const allSameLocationTo = useMemo(() => {
    if (items.length === 0) return false;
    const first = (items[0]?.LocationTo || "").trim();
    if (!first) return false;
    return items.every((it) => (it.LocationTo || "").trim() === first);
  }, [items]);

  const getEmployeeCode = () => {
    return (
      (localStorage.getItem("gsi.employee") ||
        localStorage.getItem("gsi.username") ||
        localStorage.getItem("gsi.login") ||
        "") as string
    ).trim();
  };

  const unloadSingle = async (it: LoadedItem, attempt = 1): Promise<boolean> => {
    const employeeCode = getEmployeeCode();
    const payload = {
      handlingUnit: (it.HandlingUnit || "").trim(),
      fromWarehouse: (it.Warehouse || "").trim(),
      fromLocation: (it.LocationFrom || "").trim(),
      toWarehouse: (it.Warehouse || "").trim(),
      toLocation: (it.LocationTo || "").trim(),
      employee: employeeCode,
      language: locale,
      company: "1000",
    };
    const tid = showLoading("Bewegung wird ausgeführt…");
    const { data, error } = await supabase.functions.invoke("ln-move-to-location", { body: payload });
    dismissToast(tid as unknown as string);

    if (error || !data || !data.ok) {
      const errObj = (data && data.error) || error;
      const top = errObj?.message || "Unbekannter Fehler";
      const details = Array.isArray(errObj?.details) ? errObj.details.map((d: any) => d?.message).filter(Boolean) : [];
      const normalize = (s: any) => (s ? String(s).toLowerCase() : "");
      const topLower = normalize(top);
      const detailsLower = normalize(details.join(" "));
      const isQtyTimingIssue =
        topLower.includes("quantity to issue") ||
        detailsLower.includes("quantity to issue") ||
        topLower.includes("tibde0140.05");

      if (attempt < MAX_UNLOAD_RETRY && isQtyTimingIssue) {
        // Wait a moment to let LN commit the previous movement, then retry
        await sleep(900);
        return unloadSingle(it, attempt + 1);
      }

      const message = details.length > 0 ? `${top}\nDETAILS:\n${details.join("\n")}` : top;
      showError(message);
      return false;
    }

    // After successful move, PATCH the TransportOrder: Completed='Yes', clear VehicleID & LocationDevice
    const patchTid = showLoading("Transportauftrag wird aktualisiert…");
    const { data: patchData, error: patchErr } = await supabase.functions.invoke("ln-update-transport-order", {
      body: {
        transportId: (it.TransportID || "").trim(),
        etag: (it.ETag || "").trim(),
        vehicleId: "",            // clear VehicleID & LocationDevice
        completed: "Yes",         // mark as completed
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
      return false;
    }

    return true;
  };

  const unloadAll = async () => {
    if (!allSameLocationTo || items.length === 0) return;
    setProcessing(true);
    let successCount = 0;
    for (const it of items) {
      const ok = await unloadSingle(it);
      if (!ok) {
        break; // Stop on first error
      }
      successCount += 1;
      // Give LN more time to commit the previous movement
      await sleep(900);
    }
    if (successCount > 0) {
      showSuccess(`Erfolgreich entladen (${successCount})`);
      await fetchLoaded();
      await fetchCount(); // refresh via REST after UNLOAD
    }
    setProcessing(false);
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
              <span>{trans.transportUnload}</span>
              <span className="bg-red-700 text-white rounded-md h-5 px-2 min-w-[20px] inline-flex items-center justify-center text-xs font-bold">
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

      {/* List area */}
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-0">
          <div className="max-h-[50vh] overflow-x-hidden overflow-y-auto rounded-md">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No entries</div>
            ) : (
              <div className="w-full">
                {/* Black header row */}
                <div className="bg-black text-white rounded-t-md px-3 py-2 text-[11px] sm:text-xs font-semibold grid grid-cols-2">
                  <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
                  <div className="whitespace-nowrap">{trans.itemLabel}</div>
                </div>

                {/* Card list */}
                <div className="p-2 space-y-3">
                  {items.map((it, idx) => (
                    <div
                      key={`${it.HandlingUnit}-${idx}`}
                      className="relative rounded-lg border border-gray-200 bg-gray-100/80 shadow-sm px-3 py-2"
                    >
                      {/* Top line: HU (left), Item (left), reserve space for icon on right */}
                      <div className="grid grid-cols-[1fr_1fr] items-center gap-2">
                        <div className="font-mono text-[13px] sm:text-sm text-gray-900 whitespace-nowrap">
                          {it.HandlingUnit || "-"}
                        </div>
                        <div className="text-[13px] sm:text-sm text-gray-900 whitespace-nowrap pr-9">
                          {it.Item || "-"}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mt-2 h-px bg-gray-200" />

                      {/* Details block: From → To (left) and Quantity (right) */}
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[11px] font-semibold text-gray-700">{fromToLabel}</div>
                          <div className="text-sm text-gray-900">
                            {(it.LocationFrom || "-") + " \u2192 " + (it.LocationTo || "-")}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-gray-700">{trans.quantityLabel}</div>
                          <div className="text-sm text-gray-900">
                            {(() => {
                              const key = (it.HandlingUnit || "").trim();
                              const q = quantities[key] || "-";
                              const u = units[key] || "";
                              return (
                                <>
                                  {q} {u ? <span className="ml-1 text-gray-700">{u}</span> : ""}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Per-row unload icon (only when locations differ) */}
                      {!allSameLocationTo && (
                        <div className="absolute right-2 top-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="bg-red-600 hover:bg-red-700 text-white h-6 w-6 sm:h-7 sm:w-7 rounded-[3px] p-0 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Unload"
                                  disabled={processing}
                                  onClick={async () => {
                                    setProcessing(true);
                                    const ok = await unloadSingle(it);
                                    if (ok) {
                                      showSuccess("Erfolgreich entladen");
                                      await fetchLoaded();
                                      await fetchCount();
                                    }
                                    setProcessing(false);
                                  }}
                                >
                                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Unload</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  ))}
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
            className={
              allSameLocationTo && items.length > 0 && !processing
                ? "w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white"
                : "w-full h-12 text-base bg-gray-600 text-white disabled:opacity-100"
            }
            disabled={!allSameLocationTo || items.length === 0 || processing}
            onClick={unloadAll}
          >
            {trans.unloadAction} ({loadedCount})
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

      {/* Global blocking spinner */}
      {processing && <ScreenSpinner message="Please wait…" />}
    </div>
  );
};

export default TransportUnload;