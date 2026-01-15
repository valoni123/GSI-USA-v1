import { useMemo, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, LogOut, Search } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignOutConfirm from "@/components/SignOutConfirm";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Input } from "@/components/ui/input";
import { showSuccess } from "@/utils/toast";
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
    TransportType: string;
    Item: string;
    HandlingUnit: string;
    Warehouse: string;
    LocationFrom: string;
    LocationTo: string;
    VehicleID: string;
    PlannedDeliveryDate: string;
    PlanningGroupTransport?: string;
    Description?: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const loadPlannings = async (silent: boolean) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const pg = (group || "").toString();
    const showAll = pg.toUpperCase() === "ALL";
    const { data } = await supabase.functions.invoke("ln-transport-planning-list", {
      body: { planningGroup: showAll ? "" : pg, showAll, language: locale, company: "1000" },
    });
    if (data && data.ok) {
      setItems(data.items || []);
      if (!silent) setError(null);
    } else {
      if (!silent) setError((data && (data.error?.message || data.error)) || "Failed to load");
    }
    if (!silent) setLoading(false);
  };

  const [signOutOpen, setSignOutOpen] = useState(false);
  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      localStorage.removeItem("gsi.username");
      localStorage.removeItem("gsi.employee");
      localStorage.removeItem("gsi.login");
      localStorage.removeItem("vehicle.id");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const [switchOpen, setSwitchOpen] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const [groupsList, setGroupsList] = useState<Array<{ PlanningGroupTransport: string; Description: string }>>([]);
  const [groupsQuery, setGroupsQuery] = useState("");
  const [groupsDropdownOpen, setGroupsDropdownOpen] = useState(false);
  const [groupsDropdownLoading, setGroupsDropdownLoading] = useState(false);
  const filteredGroups = groupsList.filter((g) => {
    const q = groupsQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      g.PlanningGroupTransport.toLowerCase().includes(q) ||
      (g.Description || "").toLowerCase().includes(q)
    );
  });
  const fetchGroups = async () => {
    const { data } = await supabase.functions.invoke("ln-transport-groups-list", { body: {} });
    if (data && data.ok) {
      setGroupsList((data.items || []) as Array<{ PlanningGroupTransport: string; Description: string }>);
      setGroupsQuery("");
    } else {
      setGroupsList([]);
    }
  };
  const onConfirmSwitch = () => {
    const val = groupInput.trim();
    if (!val) return;
    setSwitchOpen(false);
    navigate(`/transportgroup/${encodeURIComponent(val)}`);
  };

  const grouped = useMemo(() => {
    const map: Record<string, typeof items> = {};
    for (const it of items) {
      const key = (it.PlanningGroupTransport || "").trim() || "_";
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [items]);

  useEffect(() => {
    loadPlannings(false);
    const intervalId = setInterval(() => {
      loadPlannings(true);
    }, 30000);
    return () => clearInterval(intervalId);
  }, [group, locale]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-lg">
            {trans.planningGroupTransport}{group?.toUpperCase() === "ALL" ? "" : `: ${group}`}
            {/* Single-group: show description next to title */}
            {group?.toUpperCase() !== "ALL" && items.length > 0 && (
              <span className="ml-3 inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1">
                {items[0]?.Description || ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="bg-red-600 hover:bg-red-700 text-white h-8 px-3"
              onClick={async () => {
                setSwitchOpen(true);
                setGroupsDropdownOpen(false);
                setGroupInput("");
                await fetchGroups();
              }}
              aria-label="Switch planning group"
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              SWITCH
            </Button>
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
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="rounded-md border bg-white overflow-hidden">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1100px]">
              { (group || "").toUpperCase() === "ALL" ? (
                Object.keys(grouped).sort().map((gkey) => {
                  const rows = grouped[gkey] || [];
                  const desc = rows.length > 0 ? (rows[0]?.Description || "") : "";
                  return (
                    <div key={gkey} className="mb-6">
                      <div className="flex items-center gap-3 font-bold text-lg mb-2">
                        <span>{gkey} [{rows.length}]</span>
                        {desc && (
                          <span className="inline-block text-xs text-gray-700 bg-white rounded-md border px-2 py-1">
                            {desc}
                          </span>
                        )}
                      </div>
                      <div className="rounded-md bg-gray-50 p-1 border">
                        <div className="grid grid-cols-9 gap-3 px-4 py-2 bg-gray-100 border-b text-xs font-semibold text-gray-700">
                          <div className="whitespace-nowrap">{trans.transportIdLabel}</div>
                          <div className="whitespace-nowrap">{trans.transportTypeLabel}</div>
                          <div className="whitespace-nowrap">{trans.itemLabel}</div>
                          <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
                          <div className="whitespace-nowrap">{trans.warehouseLabel}</div>
                          <div className="whitespace-nowrap">{trans.locationFromLabel}</div>
                          <div className="whitespace-nowrap">{trans.locationToLabel}</div>
                          <div className="whitespace-nowrap">{trans.loadVehicleId}</div>
                          <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
                        </div>
                        {rows.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground">No entries</div>
                        ) : (
                          rows.map((it, idx) => (
                            <div
                              key={`${it.TransportID}-${idx}`}
                              className="grid grid-cols-9 gap-3 px-4 py-2 border-b text-sm"
                            >
                              <div className="break-all whitespace-nowrap">{it.TransportID || "-"}</div>
                              <div className="break-all whitespace-nowrap">{it.TransportType || "-"}</div>
                              <div className="break-all whitespace-nowrap">{it.Item || "-"}</div>
                              <div className="break-all whitespace-nowrap">{it.HandlingUnit || "-"}</div>
                              <div className="break-all whitespace-nowrap">{it.Warehouse || "-"}</div>
                              <div className="break-all whitespace-nowrap">{it.LocationFrom || "-"}</div>
                              <div className="break-all whitespace-nowrap">{it.LocationTo || "-"}</div>
                              <div className="break-all whitespace-nowrap">
                                {it.VehicleID ? (
                                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
                                    {it.VehicleID}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </div>
                              <div className="break-all whitespace-nowrap">
                                {it.PlannedDeliveryDate ? new Date(it.PlannedDeliveryDate).toLocaleString() : "-"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="grid grid-cols-9 gap-3 px-4 py-2 bg-gray-100 border-b text-xs font-semibold text-gray-700">
                    <div className="whitespace-nowrap">{trans.transportIdLabel}</div>
                    <div className="whitespace-nowrap">{trans.transportTypeLabel}</div>
                    <div className="whitespace-nowrap">{trans.itemLabel}</div>
                    <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
                    <div className="whitespace-nowrap">{trans.warehouseLabel}</div>
                    <div className="whitespace-nowrap">{trans.locationFromLabel}</div>
                    <div className="whitespace-nowrap">{trans.locationToLabel}</div>
                    <div className="whitespace-nowrap">{trans.loadVehicleId}</div>
                    <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
                  </div>
                  {loading ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">Loading…</div>
                  ) : items.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No entries</div>
                  ) : (
                    items.map((it, idx) => (
                      <div
                        key={`${it.TransportID}-${idx}`}
                        className="grid grid-cols-9 gap-3 px-4 py-2 border-b text-sm"
                      >
                        <div className="break-all whitespace-nowrap">{it.TransportID || "-"}</div>
                        <div className="break-all whitespace-nowrap">{it.TransportType || "-"}</div>
                        <div className="break-all whitespace-nowrap">{it.Item || "-"}</div>
                        <div className="break-all whitespace-nowrap">{it.HandlingUnit || "-"}</div>
                        <div className="break-all whitespace-nowrap">{it.Warehouse || "-"}</div>
                        <div className="break-all whitespace-nowrap">{it.LocationFrom || "-"}</div>
                        <div className="break-all whitespace-nowrap">{it.LocationTo || "-"}</div>
                        <div className="break-all whitespace-nowrap">
                          {it.VehicleID ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
                              {it.VehicleID}
                            </span>
                          ) : (
                            "-"
                          )}
                        </div>
                        <div className="break-all whitespace-nowrap">
                          {it.PlannedDeliveryDate ? new Date(it.PlannedDeliveryDate).toLocaleString() : "-"}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
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

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>{trans.planningGroupTransport}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 pb-4 pt-2 relative">
            <FloatingLabelInput
              id="planningGroup"
              label={trans.planningGroupTransport}
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              autoFocus
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-6 top-2 text-gray-700 hover:text-gray-900 h-8 w-8 flex items-center justify-center"
              aria-label="Search groups"
              onClick={async () => {
                if (!groupsDropdownOpen) {
                  setGroupsDropdownOpen(true);
                  setGroupsDropdownLoading(true);
                  fetchGroups().finally(() => setGroupsDropdownLoading(false));
                } else {
                  setGroupsDropdownOpen(false);
                }
              }}
            >
              <Search className="h-6 w-6" />
            </Button>
            {groupsDropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-50">
                <div className="space-y-2">
                  <Input
                    placeholder="Search…"
                    value={groupsQuery}
                    onChange={(e) => setGroupsQuery(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="max-h-56 overflow-auto space-y-1">
                    {groupsDropdownLoading ? (
                      <div className="text-xs text-muted-foreground px-1">Loading…</div>
                    ) : filteredGroups.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-1">No groups</div>
                    ) : (
                      filteredGroups.map((v, idx) => (
                        <button
                          key={`${v.PlanningGroupTransport}-${idx}`}
                          type="button"
                          className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                          onClick={() => {
                            setGroupInput(v.PlanningGroupTransport);
                            setGroupsDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm font-medium">{v.PlanningGroupTransport}</div>
                          <div className="text-xs text-gray-600">{v.Description}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-4 pb-4">
            <Button
              className="w-full h-10 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              disabled={!groupInput.trim()}
              onClick={onConfirmSwitch}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportGroup;