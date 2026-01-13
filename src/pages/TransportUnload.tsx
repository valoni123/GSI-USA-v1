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
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

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

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const fetchLoaded = async () => {
    const vehicleId = (localStorage.getItem("vehicle.id") || "").trim();
    if (!vehicleId) {
      // No vehicle selected; go back to transport menu to select one
      navigate("/menu/transport");
      return;
    }
    const tid = showLoading("Lade Einträge…");
    const { data } = await supabase.functions.invoke("ln-transport-list", {
      body: { vehicleId, language: locale, company: "1000" },
    });
    dismissToast(tid as unknown as string);
    if (data && data.ok) {
      setItems((data.items || []) as LoadedItem[]);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const fetchCount = async () => {
    const vehicleId = (localStorage.getItem("vehicle.id") || "").trim();
    if (!vehicleId) {
      setLoadedCount(0);
      return;
    }
    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId, language: locale, company: "1000" },
    });
    if (data && data.ok) {
      setLoadedCount(Number(data.count || 0));
    } else {
      setLoadedCount(0);
    }
  };

  useEffect(() => {
    fetchLoaded();
    fetchCount();
  }, [locale]);

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

  const unloadSingle = async (it: LoadedItem) => {
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
      const err = (data && data.error) || error;
      const top = err?.message || "Unbekannter Fehler";
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d?.message).filter(Boolean) : [];
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
    let successCount = 0;
    for (const it of items) {
      const ok = await unloadSingle(it);
      if (!ok) {
        // Stop on first error
        break;
      }
      successCount += 1;
    }
    if (successCount > 0) {
      showSuccess(`Erfolgreich entladen (${successCount})`);
      await fetchLoaded();
      await fetchCount();
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
            onClick={() => navigate("/menu/transport")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center flex items-center gap-2">
              <span>{trans.transportUnload}</span>
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

      {/* List area */}
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-0">
          <div className="max-h-[50vh] overflow-x-auto overflow-y-auto rounded-md">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No entries</div>
            ) : (
              <Table className="text-[11px] sm:text-xs w-full table-fixed">
                <TableHeader className="sticky top-0 bg-black text-white z-[1] shadow-sm">
                  <TableRow>
                    <TableHead className="w-[36%] whitespace-nowrap text-white px-2 py-1.5">{trans.loadHandlingUnit}</TableHead>
                    <TableHead className="w-[20%] whitespace-nowrap text-white px-2 py-1.5">{trans.itemLabel}</TableHead>
                    <TableHead className="sm:hidden w-[40%] whitespace-nowrap text-white px-2 py-1.5">From → To</TableHead>
                    <TableHead className="hidden sm:table-cell w-[22%] whitespace-nowrap text-white px-2 py-1.5">From</TableHead>
                    <TableHead className="hidden sm:table-cell w-[22%] whitespace-nowrap text-white px-2 py-1.5">To</TableHead>
                    {!allSameLocationTo && <TableHead className="w-[52px] px-2 py-1.5"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={`${it.HandlingUnit}-${idx}`} className="odd:bg-white even:bg-gray-50">
                      <TableCell
                        title={it.HandlingUnit || "-"}
                        className="font-mono whitespace-nowrap px-2 py-3"
                      >
                        {it.HandlingUnit || "-"}
                      </TableCell>
                      <TableCell
                        title={it.Item || "-"}
                        className="whitespace-nowrap px-2 py-3"
                      >
                        {it.Item || "-"}
                      </TableCell>
                      {/* Mobile: combined From → To */}
                      <TableCell
                        title={`${it.LocationFrom || "-"} → ${it.LocationTo || "-"}`}
                        className="sm:hidden whitespace-nowrap px-2 py-3"
                      >
                        {(it.LocationFrom || "-") + " → " + (it.LocationTo || "-")}
                      </TableCell>
                      {/* Desktop/tablet: separate From and To */}
                      <TableCell
                        title={it.LocationFrom || "-"}
                        className="hidden sm:table-cell whitespace-nowrap px-2 py-3"
                      >
                        {it.LocationFrom || "-"}
                      </TableCell>
                      <TableCell
                        title={it.LocationTo || "-"}
                        className="hidden sm:table-cell whitespace-nowrap px-2 py-3"
                      >
                        {it.LocationTo || "-"}
                      </TableCell>
                      {!allSameLocationTo && (
                        <TableCell className="text-right px-2 py-3 pl-3">
                          <div className="flex justify-end items-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="bg-red-600 hover:bg-red-700 text-white h-6 w-6 sm:h-7 sm:w-7 rounded-[3px] p-0 shadow"
                                    aria-label="Unload"
                                    onClick={async () => {
                                      const ok = await unloadSingle(it);
                                      if (ok) {
                                        showSuccess("Erfolgreich entladen");
                                        await fetchLoaded();
                                        await fetchCount();
                                      }
                                    }}
                                  >
                                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Unload</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            className={
              allSameLocationTo && items.length > 0
                ? "w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white"
                : "w-full h-12 text-base bg-gray-600 text-white disabled:opacity-100"
            }
            disabled={!allSameLocationTo || items.length === 0}
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
    </div>
  );
};

export default TransportUnload;