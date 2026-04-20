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
import { Checkbox } from "@/components/ui/checkbox";
import ScreenSpinner from "@/components/ScreenSpinner";

const TransportGroup = () => {
  const { group } = useParams();
  const navigate = useNavigate();
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [items, setItems] = useState<Array<{
    TransportID: string;
    TransportType: string;
    Item: string;
    HandlingUnit: string;
    Warehouse: string;
    LocationFrom: string;
    LocationTo: string;
    VehicleID: string;
    PlannedVehicle: string;
    PlannedDeliveryDate: string;
    PlanningGroupTransport?: string;
    Description?: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const [groupDescriptions, setGroupDescriptions] = useState<Record<string, string>>({});
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

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
    const vehicleId = (localStorage.getItem("vehicle.id") || "").trim();
    const { data } = await supabase.functions.invoke("ln-transport-planning-list", {
      body: { planningGroup: showAll ? "" : pg, vehicleId, showAll, language: locale },
    });

    if (data && data.ok) {
      setItems(data.items || []);
      setPage(1);
      if (!silent) setError(null);
    } else {
      if (!silent) setError((data && (data.error?.message || data.error)) || "Failed to load");
    }
    if (!silent) {
      setLoading(false);
      setSwitching(false);
    }
  };

  const loadGroupDescriptions = async () => {
    const { data } = await supabase.functions.invoke("ln-transport-groups-list", {
      body: { language: locale },
    });
    if (data && data.ok) {
      const map: Record<string, string> = {};
      const arr = (data.items || []) as Array<{ PlanningGroupTransport: string; Description: string }>;
      for (const g of arr) {
        const key = (g.PlanningGroupTransport || "").trim();
        if (key) map[key] = g.Description || "";
      }
      setGroupDescriptions(map);
    } else {
      setGroupDescriptions({});
    }
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
  const [showAllSwitch, setShowAllSwitch] = useState(false);
  const [vehicleInput, setVehicleInput] = useState("");
  const [vehiclesList, setVehiclesList] = useState<Array<{ VehicleID: string; Description: string }>>([]);
  const [vehiclesQuery, setVehiclesQuery] = useState("");
  const [vehiclesDropdownOpen, setVehiclesDropdownOpen] = useState(false);
  const [vehiclesDropdownLoading, setVehiclesDropdownLoading] = useState(false);
  const filteredGroups = groupsList.filter((g) => {
    const q = groupsQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      g.PlanningGroupTransport.toLowerCase().includes(q) ||
      (g.Description || "").toLowerCase().includes(q)
    );
  });
  const filteredVehicles = vehiclesList.filter((v) => {
    const q = vehiclesQuery.trim().toLowerCase();
    if (!q) return true;
    return v.VehicleID.toLowerCase().includes(q) || (v.Description || "").toLowerCase().includes(q);
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
  const fetchVehicles = async () => {
    const { data } = await supabase.functions.invoke("ln-vehicles-list", { body: { language: locale } });
    if (data && data.ok) {
      setVehiclesList((data.items || []) as Array<{ VehicleID: string; Description: string }>);
      setVehiclesQuery("");
    } else {
      setVehiclesList([]);
    }
  };
  const onConfirmSwitch = async () => {
    const selectedVehicle = vehicleInput.trim();
    if (selectedVehicle) {
      localStorage.setItem("vehicle.id", selectedVehicle);
    } else {
      localStorage.removeItem("vehicle.id");
    }

    const targetGroup = showAllSwitch ? "ALL" : groupInput.trim();
    if (!targetGroup) return;

    setSwitchOpen(false);
    setError(null);
    setItems([]);
    setPage(1);
    setGroupPages({});
    setLoading(true);
    setSwitching(true);

    const currentGroup = ((group || "").toString() || "").trim().toUpperCase();
    const nextGroup = targetGroup.trim().toUpperCase();

    if (currentGroup === nextGroup) {
      await loadPlannings(false);
      return;
    }

    navigate(`/transportgroup/${encodeURIComponent(targetGroup)}`);
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
    if ((group || "").toUpperCase() === "ALL") {
      const init: Record<string, number> = {};
      Object.keys(grouped).forEach((k) => { init[k] = 1; });
      setGroupPages(init);
    } else {
      setGroupPages({});
    }
  }, [group, grouped]);

  const totalPages = useMemo(() => {
    if ((group || "").toUpperCase() === "ALL") return 1;
    return Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  }, [items, group]);

  const pagedItems = useMemo(() => {
    if ((group || "").toUpperCase() === "ALL") return items;
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page, group]);

  useEffect(() => {
    loadPlannings(false);
    loadGroupDescriptions();
    const intervalId = setInterval(() => {
      loadPlannings(true);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [group, locale]);

  const selectedVehicleId = (localStorage.getItem("vehicle.id") || "").trim();
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

  return (
    <div className="min-h-screen bg-gray-50">
      {(loading || switching) && <ScreenSpinner message={trans.pleaseWait} />}
      <div className="sticky top-0 z-10 bg-black text-white">

        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-lg">
            {trans.planningGroupTransport}{group?.toUpperCase() === "ALL" ? "" : `: ${group}`}
            {group?.toUpperCase() !== "ALL" && (
              <span className="ml-3 inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1">
                {groupDescriptions[(group || "").toString()] || ""}
              </span>
            )}
            {selectedVehicleId && (
              <span className="ml-3 inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1">
                {trans.loadVehicleId}: {selectedVehicleId}
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
                setVehiclesDropdownOpen(false);
                setGroupInput((group || "").toUpperCase() === "ALL" ? "" : (group || "").toString());
                setGroupsQuery((group || "").toUpperCase() === "ALL" ? "" : (group || "").toString());
                const storedVehicle = (localStorage.getItem("vehicle.id") || "").trim();
                setVehicleInput(storedVehicle);
                setVehiclesQuery(storedVehicle);
                setShowAllSwitch((group || "").toUpperCase() === "ALL");
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
            <div className="min-w-[1280px]">
              {(group || "").toUpperCase() === "ALL" ? (
                Object.keys(grouped).sort().map((gkey) => {
                  const rowsAll = grouped[gkey] || [];
                  const desc = groupDescriptions[gkey] || "";
                  const gPage = groupPages[gkey] ?? 1;
                  const gTotalPages = Math.max(1, Math.ceil(rowsAll.length / PAGE_SIZE));
                  const start = (gPage - 1) * PAGE_SIZE;
                  const rows = rowsAll.slice(start, start + PAGE_SIZE);
                  return (
                    <div key={gkey} className="mb-6">
                      <div className="flex items-center gap-3 font-bold text-lg mb-2">
                        <span>{gkey} [{rowsAll.length}]</span>
                        {desc && (
                          <span className="inline-block text-xs text-gray-700 bg-white rounded-md border px-2 py-1">
                            {desc}
                          </span>
                        )}
                      </div>
                      <div className="rounded-md bg-gray-50 p-1 border">
                        <div className="grid grid-cols-10 gap-3 px-4 py-2 bg-gray-100 border-b text-xs font-semibold text-gray-700">
                          <div className="whitespace-nowrap">{trans.transportIdLabel}</div>
                          <div className="whitespace-nowrap">{trans.transportTypeLabel}</div>
                          <div className="whitespace-nowrap">{trans.itemLabel}</div>
                          <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
                          <div className="whitespace-nowrap">{trans.warehouseLabel}</div>
                          <div className="whitespace-nowrap">{trans.locationFromLabel}</div>
                          <div className="whitespace-nowrap">{trans.locationToLabel}</div>
                          <div className="whitespace-nowrap">{trans.loadVehicleId}</div>
                          <div className="whitespace-nowrap">{trans.plannedVehicleLabel}</div>
                          <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
                        </div>
                        {rowsAll.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground">No entries</div>
                        ) : (
                          rows.map((it, idx) => (
                            <div
                              key={`${it.TransportID}-${idx}`}
                              className="grid grid-cols-10 gap-3 px-4 py-2 border-b text-sm"
                            >
                              <div className="break-all whitespace-nowrap">{it.TransportID || "-"}</div>
                              <div className="break-all whitespace-nowrap">
                                {it.TransportType ? (
                                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getTransportTypeClasses(it.TransportType)}`}>
                                    {it.TransportType}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </div>
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
                              <div className="break-all whitespace-nowrap">{it.PlannedVehicle || "-"}</div>
                              <div className="break-all whitespace-nowrap">
                                {it.PlannedDeliveryDate ? new Date(it.PlannedDeliveryDate).toLocaleString() : "-"}
                              </div>
                            </div>
                          ))
                        )}
                        {rowsAll.length > PAGE_SIZE && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="text-xs text-gray-600">
                              Page {gPage} of {gTotalPages} · Showing {rows.length} of {rowsAll.length}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                disabled={gPage <= 1}
                                onClick={() => setGroupPages((p) => ({ ...p, [gkey]: Math.max(1, gPage - 1) }))}
                              >
                                Previous
                              </Button>
                              {Array.from({ length: gTotalPages }).map((_, i) => {
                                const idx = i + 1;
                                const isCurrent = idx === gPage;
                                const show =
                                  idx === 1 ||
                                  idx === gTotalPages ||
                                  Math.abs(idx - gPage) <= 2 ||
                                  (gPage <= 3 && idx <= 5) ||
                                  (gPage >= gTotalPages - 2 && idx >= gTotalPages - 4);
                                if (!show) return null;
                                return (
                                  <Button
                                    key={`pg-${gkey}-${idx}`}
                                    variant={isCurrent ? "destructive" : "outline"}
                                    className="h-8 px-3"
                                    onClick={() => setGroupPages((p) => ({ ...p, [gkey]: idx }))}
                                  >
                                    {idx}
                                  </Button>
                                );
                              })}
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                disabled={gPage >= gTotalPages}
                                onClick={() => setGroupPages((p) => ({ ...p, [gkey]: Math.min(gTotalPages, gPage + 1) }))}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="grid grid-cols-10 gap-3 px-4 py-2 bg-gray-100 border-b text-xs font-semibold text-gray-700">
                    <div className="whitespace-nowrap">{trans.transportIdLabel}</div>
                    <div className="whitespace-nowrap">{trans.transportTypeLabel}</div>
                    <div className="whitespace-nowrap">{trans.itemLabel}</div>
                    <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
                    <div className="whitespace-nowrap">{trans.warehouseLabel}</div>
                    <div className="whitespace-nowrap">{trans.locationFromLabel}</div>
                    <div className="whitespace-nowrap">{trans.locationToLabel}</div>
                    <div className="whitespace-nowrap">{trans.loadVehicleId}</div>
                    <div className="whitespace-nowrap">{trans.plannedVehicleLabel}</div>
                    <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
                  </div>
                  {loading ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">Loading…</div>
                  ) : items.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No entries</div>
                  ) : (
                    pagedItems.map((it, idx) => (
                      <div
                        key={`${it.TransportID}-${idx}`}
                        className="grid grid-cols-10 gap-3 px-4 py-2 border-b text-sm"
                      >
                        <div className="break-all whitespace-nowrap">{it.TransportID || "-"}</div>
                        <div className="break-all whitespace-nowrap">
                          {it.TransportType ? (
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getTransportTypeClasses(it.TransportType)}`}>
                              {it.TransportType}
                            </span>
                          ) : (
                            "-"
                          )}
                        </div>
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
                        <div className="break-all whitespace-nowrap">{it.PlannedVehicle || "-"}</div>
                        <div className="break-all whitespace-nowrap">
                          {it.PlannedDeliveryDate ? new Date(it.PlannedDeliveryDate).toLocaleString() : "-"}
                        </div>
                      </div>
                    ))
                  )}
                  {items.length > 0 && (group || "").toUpperCase() !== "ALL" && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-xs text-gray-600">
                        Page {page} of {totalPages} · Showing {pagedItems.length} of {items.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="h-8 px-2"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                          const idx = i + 1;
                          const isCurrent = idx === page;
                          const show =
                            idx === 1 ||
                            idx === totalPages ||
                            Math.abs(idx - page) <= 2 ||
                            (page <= 3 && idx <= 5) ||
                            (page >= totalPages - 2 && idx >= totalPages - 4);
                          if (!show) return null;
                          return (
                            <Button
                              key={`pg-${idx}`}
                              variant={isCurrent ? "destructive" : "outline"}
                              className="h-8 px-3"
                              onClick={() => setPage(idx)}
                            >
                              {idx}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          className="h-8 px-2"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{trans.planningGroupTransport}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <FloatingLabelInput
                id="planningGroup"
                label={trans.planningGroupTransport}
                value={groupInput}
                onChange={(e) => {
                  setGroupInput(e.target.value);
                  setGroupsQuery(e.target.value);
                  if (!groupsDropdownOpen) setGroupsDropdownOpen(true);
                }}
                onFocus={async () => {
                  setGroupsDropdownOpen(true);
                  setVehiclesDropdownOpen(false);
                  if (groupsList.length === 0 && !groupsDropdownLoading) {
                    setGroupsDropdownLoading(true);
                    try {
                      await fetchGroups();
                    } finally {
                      setGroupsDropdownLoading(false);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (showAllSwitch) {
                      onConfirmSwitch();
                      return;
                    }
                    const q = groupInput.trim().toLowerCase();
                    const first = filteredGroups.find((g) =>
                      g.PlanningGroupTransport.toLowerCase().includes(q) ||
                      (g.Description || "").toLowerCase().includes(q)
                    );
                    if (first) {
                      setGroupInput(first.PlanningGroupTransport);
                      setGroupsDropdownOpen(false);
                    }
                  }
                }}
                onClick={() => {
                  if (!showAllSwitch) setGroupsDropdownOpen((o) => !o);
                }}
                className="pr-10"
                disabled={showAllSwitch}
              />
              <button
                type="button"
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 ${showAllSwitch ? "pointer-events-none opacity-40" : ""}`}
                onClick={async () => {
                  if (showAllSwitch) return;
                  setGroupsDropdownOpen((o) => !o);
                  setVehiclesDropdownOpen(false);
                  if (groupsList.length === 0 && !groupsDropdownLoading) {
                    setGroupsDropdownLoading(true);
                    try {
                      await fetchGroups();
                    } finally {
                      setGroupsDropdownLoading(false);
                    }
                  }
                }}
                aria-label="Toggle planning group list"
              >
                <Search className="h-5 w-5" />
              </button>
              {groupsDropdownOpen && !showAllSwitch && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow max-h-64 overflow-auto">
                  {groupsDropdownLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No entries</div>
                  ) : (
                    filteredGroups.map((v, idx) => (
                      <button
                        key={`${v.PlanningGroupTransport}-${idx}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                        onClick={() => {
                          setGroupInput(v.PlanningGroupTransport);
                          setGroupsQuery(v.PlanningGroupTransport);
                          setGroupsDropdownOpen(false);
                        }}
                      >
                        <div className="text-sm font-medium">{v.PlanningGroupTransport}</div>
                        <div className="text-xs text-gray-500">{v.Description}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <FloatingLabelInput
                id="vehicleId"
                label={trans.loadVehicleId}
                value={vehicleInput}
                onChange={(e) => {
                  setVehicleInput(e.target.value);
                  setVehiclesQuery(e.target.value);
                  if (!vehiclesDropdownOpen) setVehiclesDropdownOpen(true);
                }}
                onFocus={async () => {
                  setVehiclesDropdownOpen(true);
                  setGroupsDropdownOpen(false);
                  if (vehiclesList.length === 0 && !vehiclesDropdownLoading) {
                    setVehiclesDropdownLoading(true);
                    try {
                      await fetchVehicles();
                    } finally {
                      setVehiclesDropdownLoading(false);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = vehicleInput.trim().toLowerCase();
                    const first = filteredVehicles.find((v) =>
                      v.VehicleID.toLowerCase().includes(q) ||
                      (v.Description || "").toLowerCase().includes(q)
                    );
                    if (first) {
                      setVehicleInput(first.VehicleID);
                      setVehiclesQuery(first.VehicleID);
                      setVehiclesDropdownOpen(false);
                      return;
                    }
                    onConfirmSwitch();
                  }
                }}
                onClick={() => setVehiclesDropdownOpen((o) => !o)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700"
                onClick={async () => {
                  setVehiclesDropdownOpen((o) => !o);
                  setGroupsDropdownOpen(false);
                  if (vehiclesList.length === 0 && !vehiclesDropdownLoading) {
                    setVehiclesDropdownLoading(true);
                    try {
                      await fetchVehicles();
                    } finally {
                      setVehiclesDropdownLoading(false);
                    }
                  }
                }}
                aria-label="Toggle vehicle list"
              >
                <Search className="h-5 w-5" />
              </button>
              {vehiclesDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow max-h-64 overflow-auto">
                  {vehiclesDropdownLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                  ) : filteredVehicles.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No entries</div>
                  ) : (
                    filteredVehicles.map((v, idx) => (
                      <button
                        key={`${v.VehicleID}-${idx}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                        onClick={() => {
                          setVehicleInput(v.VehicleID);
                          setVehiclesQuery(v.VehicleID);
                          setVehiclesDropdownOpen(false);
                        }}
                      >
                        <div className="text-sm font-medium">{v.VehicleID}</div>
                        <div className="text-xs text-gray-500">{v.Description}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="showAllTransportGroups"
                checked={showAllSwitch}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setShowAllSwitch(next);
                  if (next) setGroupsDropdownOpen(false);
                }}
              />
              <label htmlFor="showAllTransportGroups" className="text-sm select-none cursor-pointer">
                {trans.showAllTransports}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!showAllSwitch && !groupInput.trim()}
              onClick={onConfirmSwitch}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

export default TransportGroup;