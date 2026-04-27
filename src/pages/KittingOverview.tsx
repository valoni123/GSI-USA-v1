import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import ScreenSpinner from "@/components/ScreenSpinner";
import SignOutConfirm from "@/components/SignOutConfirm";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredGsiAuth } from "@/lib/gsi-auth-storage";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";

type PlanningItem = {
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
};

type VehicleItem = {
  VehicleID: string;
  Description: string;
};

type GroupItem = {
  PlanningGroupTransport: string;
  Description: string;
};

const PAGE_SIZE = 20;

const KittingOverview = () => {
  const { kittingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const [groupDescriptions, setGroupDescriptions] = useState<Record<string, string>>({});

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupDropdownLoading, setGroupDropdownLoading] = useState(false);
  const [kittingInput, setKittingInput] = useState("");
  const [showAllSwitch, setShowAllSwitch] = useState(false);
  const [kittingItems, setKittingItems] = useState<VehicleItem[]>([]);
  const [kittingQuery, setKittingQuery] = useState("");
  const [kittingDropdownOpen, setKittingDropdownOpen] = useState(false);
  const [kittingDropdownLoading, setKittingDropdownLoading] = useState(false);

  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  const selectedKittingId = decodeURIComponent((kittingId || "").toString()).trim();
  const selectedGroup = (searchParams.get("group") || "").trim();
  const showAll = searchParams.get("showAll") === "true";

  const filteredGroups = groupItems.filter((item) => {
    const query = groupQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      item.PlanningGroupTransport.toLowerCase().includes(query) ||
      (item.Description || "").toLowerCase().includes(query)
    );
  });

  const filteredKittings = kittingItems.filter((item) => {
    const query = kittingQuery.trim().toLowerCase();
    if (!query) return true;
    return item.VehicleID.toLowerCase().includes(query) || (item.Description || "").toLowerCase().includes(query);
  });

  const grouped = useMemo(() => {
    const map: Record<string, PlanningItem[]> = {};
    for (const item of items) {
      const key = (item.PlanningGroupTransport || "").trim() || "_";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items]);

  const totalPages = useMemo(() => {
    if (showAll) return 1;
    return Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  }, [items, showAll]);

  const pagedItems = useMemo(() => {
    if (showAll) return items;
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page, showAll]);

  useEffect(() => {
    if (!showAll) {
      setGroupPages({});
      return;
    }
    const nextPages: Record<string, number> = {};
    Object.keys(grouped).forEach((key) => {
      nextPages[key] = groupPages[key] || 1;
    });
    setGroupPages(nextPages);
  }, [showAll, grouped]);

  const fetchGroups = async () => {
    const { data } = await supabase.functions.invoke("ln-transport-groups-list", {
      body: { language: locale },
    });
    if (data && data.ok) {
      setGroupItems((data.items || []) as GroupItem[]);
      setGroupQuery("");
    } else {
      setGroupItems([]);
    }
  };

  const fetchKittingVehicles = async () => {
    const { data } = await supabase.functions.invoke("ln-vehicles-list", {
      body: { language: locale, vehicleType: "KITTING" },
    });
    if (data && data.ok) {
      setKittingItems((data.items || []) as VehicleItem[]);
      setKittingQuery("");
    } else {
      setKittingItems([]);
    }
  };

  const loadGroupDescriptions = async () => {
    const { data } = await supabase.functions.invoke("ln-transport-groups-list", {
      body: { language: locale },
    });
    if (data && data.ok) {
      const map: Record<string, string> = {};
      const values = (data.items || []) as GroupItem[];
      for (const entry of values) {
        const key = (entry.PlanningGroupTransport || "").trim();
        if (key) map[key] = entry.Description || "";
      }
      setGroupDescriptions(map);
    } else {
      setGroupDescriptions({});
    }
  };

  const loadPlannings = async (silent: boolean) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    const { data } = await supabase.functions.invoke("ln-transport-planning-list", {
      body: {
        planningGroup: showAll ? "" : selectedGroup,
        plannedVehicle: showAll ? "" : selectedKittingId,
        showAll,
        language: locale,
        transportType: "Kitting",
      },
    });

    if (data && data.ok) {
      setItems((data.items || []) as PlanningItem[]);
      setPage(1);
      if (!silent) setError(null);
    } else if (!silent) {
      setError((data && (data.error?.message || data.error)) || "Failed to load");
    }

    if (!silent) {
      setLoading(false);
      setSwitching(false);
    }
  };

  useEffect(() => {
    loadPlannings(false);
    loadGroupDescriptions();
    const intervalId = setInterval(() => {
      loadPlannings(true);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [selectedKittingId, selectedGroup, showAll, locale]);

  const onConfirmSignOut = () => {
    clearStoredGsiAuth();
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const buildOverviewUrl = (group: string, kittingId: string, showAll: boolean) => {
    if (showAll) return "/kitting/overview?showAll=true";

    const nextGroup = group.trim();
    const nextKittingId = kittingId.trim();
    const params = new URLSearchParams();
    if (nextGroup) params.set("group", nextGroup);
    const search = params.toString();

    if (nextKittingId) {
      return `/kitting/overview/${encodeURIComponent(nextKittingId)}${search ? `?${search}` : ""}`;
    }

    return `/kitting/overview${search ? `?${search}` : ""}`;
  };

  const onConfirmSwitch = async () => {
    const nextGroup = groupInput.trim();
    const nextKittingId = kittingInput.trim();
    if (!showAllSwitch && !nextGroup && !nextKittingId) return;

    setSwitchOpen(false);
    setError(null);
    setItems([]);
    setPage(1);
    setGroupPages({});
    setLoading(true);
    setSwitching(true);

    const nextUrl = buildOverviewUrl(nextGroup, nextKittingId, showAllSwitch);
    const currentUrl = buildOverviewUrl(selectedGroup, selectedKittingId, showAll);

    if (nextUrl === currentUrl) {
      await loadPlannings(false);
      return;
    }

    navigate(nextUrl);
  };

  const getTransportTypeClasses = (transportType: string) => {
    const normalized = (transportType || "").trim().toLowerCase();
    if (normalized === "kitting") {
      return "bg-orange-100 text-orange-900 border border-orange-200";
    }
    if (normalized === "aisleout" || normalized === "aisle out") {
      return "bg-yellow-100 text-yellow-900 border border-yellow-200";
    }
    if (normalized === "aislein" || normalized === "aisle in") {
      return "bg-green-100 text-green-900 border border-green-200";
    }
    return "bg-gray-100 text-gray-800 border border-gray-200";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {(loading || switching) && <ScreenSpinner message={trans.pleaseWait} />}

      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-lg flex flex-wrap items-center gap-3">
            <span>Kittingscreen Overview</span>
            {showAll ? (
              <span className="inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1">
                All Kittings
              </span>
            ) : (
              <>
                {selectedGroup && (
                  <span className="inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1">
                    {trans.planningGroupTransport}: {selectedGroup}
                  </span>
                )}
                {selectedKittingId && (
                  <span className="inline-block text-xs text-gray-200 bg-white/10 border border-white/20 rounded-md px-2 py-1">
                    Kitting ID: {selectedKittingId}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="bg-red-600 hover:bg-red-700 text-white h-8 px-3"
              onClick={() => {
                setSwitchOpen(true);
                setGroupDropdownOpen(false);
                setKittingDropdownOpen(false);
                setGroupInput(selectedGroup);
                setGroupQuery(selectedGroup);
                setKittingInput(selectedKittingId);
                setKittingQuery(selectedKittingId);
                setShowAllSwitch(showAll);
              }}
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
              {showAll ? (
                Object.keys(grouped).sort().map((groupKey) => {
                  const rowsAll = grouped[groupKey] || [];
                  const currentPage = groupPages[groupKey] ?? 1;
                  const totalGroupPages = Math.max(1, Math.ceil(rowsAll.length / PAGE_SIZE));
                  const start = (currentPage - 1) * PAGE_SIZE;
                  const rows = rowsAll.slice(start, start + PAGE_SIZE);
                  const description = groupDescriptions[groupKey] || "";

                  return (
                    <div key={groupKey} className="mb-6">
                      <div className="flex items-center gap-3 font-bold text-lg mb-2 px-1">
                        <span>{groupKey} [{rowsAll.length}]</span>
                        {description && (
                          <span className="inline-block text-xs text-gray-700 bg-white rounded-md border px-2 py-1">
                            {description}
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
                          <div className="whitespace-nowrap">Planned Vehicle</div>
                          <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
                        </div>
                        {rowsAll.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                        ) : (
                          rows.map((item, idx) => (
                            <div key={`${item.TransportID}-${idx}`} className="grid grid-cols-10 gap-3 px-4 py-2 border-b text-sm">
                              <div className="break-all whitespace-nowrap">{item.TransportID || "-"}</div>
                              <div className="break-all whitespace-nowrap">
                                {item.TransportType ? (
                                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getTransportTypeClasses(item.TransportType)}`}>
                                    {item.TransportType}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </div>
                              <div className="break-all whitespace-nowrap">{item.Item || "-"}</div>
                              <div className="break-all whitespace-nowrap">{item.HandlingUnit || "-"}</div>
                              <div className="break-all whitespace-nowrap">{item.Warehouse || "-"}</div>
                              <div className="break-all whitespace-nowrap">{item.LocationFrom || "-"}</div>
                              <div className="break-all whitespace-nowrap">{item.LocationTo || "-"}</div>
                              <div className="break-all whitespace-nowrap">
                                {item.VehicleID ? (
                                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
                                    {item.VehicleID}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </div>
                              <div className="break-all whitespace-nowrap">{item.PlannedVehicle || "-"}</div>
                              <div className="break-all whitespace-nowrap">
                                {item.PlannedDeliveryDate ? new Date(item.PlannedDeliveryDate).toLocaleString() : "-"}
                              </div>
                            </div>
                          ))
                        )}
                        {rowsAll.length > PAGE_SIZE && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="text-xs text-gray-600">
                              Page {currentPage} of {totalGroupPages} · Showing {rows.length} of {rowsAll.length}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                disabled={currentPage <= 1}
                                onClick={() => setGroupPages((prev) => ({ ...prev, [groupKey]: Math.max(1, currentPage - 1) }))}
                              >
                                Previous
                              </Button>
                              {Array.from({ length: totalGroupPages }).map((_, index) => {
                                const pageNumber = index + 1;
                                const isCurrent = pageNumber === currentPage;
                                const shouldShow =
                                  pageNumber === 1 ||
                                  pageNumber === totalGroupPages ||
                                  Math.abs(pageNumber - currentPage) <= 2 ||
                                  (currentPage <= 3 && pageNumber <= 5) ||
                                  (currentPage >= totalGroupPages - 2 && pageNumber >= totalGroupPages - 4);
                                if (!shouldShow) return null;
                                return (
                                  <Button
                                    key={`${groupKey}-${pageNumber}`}
                                    variant={isCurrent ? "destructive" : "outline"}
                                    className="h-8 px-3"
                                    onClick={() => setGroupPages((prev) => ({ ...prev, [groupKey]: pageNumber }))}
                                  >
                                    {pageNumber}
                                  </Button>
                                );
                              })}
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                disabled={currentPage >= totalGroupPages}
                                onClick={() => setGroupPages((prev) => ({ ...prev, [groupKey]: Math.min(totalGroupPages, currentPage + 1) }))}
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
                    <div className="whitespace-nowrap">Planned Vehicle</div>
                    <div className="whitespace-nowrap">{trans.plannedDateLabel}</div>
                  </div>
                  {items.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">{trans.noEntries}</div>
                  ) : (
                    pagedItems.map((item, idx) => (
                      <div key={`${item.TransportID}-${idx}`} className="grid grid-cols-10 gap-3 px-4 py-2 border-b text-sm">
                        <div className="break-all whitespace-nowrap">{item.TransportID || "-"}</div>
                        <div className="break-all whitespace-nowrap">
                          {item.TransportType ? (
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getTransportTypeClasses(item.TransportType)}`}>
                              {item.TransportType}
                            </span>
                          ) : (
                            "-"
                          )}
                        </div>
                        <div className="break-all whitespace-nowrap">{item.Item || "-"}</div>
                        <div className="break-all whitespace-nowrap">{item.HandlingUnit || "-"}</div>
                        <div className="break-all whitespace-nowrap">{item.Warehouse || "-"}</div>
                        <div className="break-all whitespace-nowrap">{item.LocationFrom || "-"}</div>
                        <div className="break-all whitespace-nowrap">{item.LocationTo || "-"}</div>
                        <div className="break-all whitespace-nowrap">
                          {item.VehicleID ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
                              {item.VehicleID}
                            </span>
                          ) : (
                            "-"
                          )}
                        </div>
                        <div className="break-all whitespace-nowrap">{item.PlannedVehicle || "-"}</div>
                        <div className="break-all whitespace-nowrap">
                          {item.PlannedDeliveryDate ? new Date(item.PlannedDeliveryDate).toLocaleString() : "-"}
                        </div>
                      </div>
                    ))
                  )}
                  {items.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-xs text-gray-600">
                        Page {page} of {totalPages} · Showing {pagedItems.length} of {items.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="h-8 px-2"
                          disabled={page <= 1}
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        >
                          Previous
                        </Button>
                        {Array.from({ length: totalPages }).map((_, index) => {
                          const pageNumber = index + 1;
                          const isCurrent = pageNumber === page;
                          const shouldShow =
                            pageNumber === 1 ||
                            pageNumber === totalPages ||
                            Math.abs(pageNumber - page) <= 2 ||
                            (page <= 3 && pageNumber <= 5) ||
                            (page >= totalPages - 2 && pageNumber >= totalPages - 4);
                          if (!shouldShow) return null;
                          return (
                            <Button
                              key={pageNumber}
                              variant={isCurrent ? "destructive" : "outline"}
                              className="h-8 px-3"
                              onClick={() => setPage(pageNumber)}
                            >
                              {pageNumber}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          className="h-8 px-2"
                          disabled={page >= totalPages}
                          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
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
            <DialogTitle>Kittingscreen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 relative">
            <div className="relative">
              <FloatingLabelInput
                id="kittingPlanningGroup"
                label={trans.planningGroupTransport}
                value={groupInput}
                onChange={(e) => {
                  setGroupInput(e.target.value);
                  setGroupQuery(e.target.value);
                  if (!groupDropdownOpen) setGroupDropdownOpen(true);
                }}
                onFocus={async () => {
                  if (showAllSwitch) return;
                  setGroupDropdownOpen(true);
                  setKittingDropdownOpen(false);
                  if (groupItems.length === 0 && !groupDropdownLoading) {
                    setGroupDropdownLoading(true);
                    try {
                      await fetchGroups();
                    } finally {
                      setGroupDropdownLoading(false);
                    }
                  }
                }}
                onClick={() => {
                  if (!showAllSwitch) setGroupDropdownOpen((prev) => !prev);
                }}
                className="pr-10"
                disabled={showAllSwitch}
              />
              <button
                type="button"
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 ${showAllSwitch ? "pointer-events-none opacity-40" : ""}`}
                onClick={async () => {
                  if (showAllSwitch) return;
                  setGroupDropdownOpen((prev) => !prev);
                  setKittingDropdownOpen(false);
                  if (groupItems.length === 0 && !groupDropdownLoading) {
                    setGroupDropdownLoading(true);
                    try {
                      await fetchGroups();
                    } finally {
                      setGroupDropdownLoading(false);
                    }
                  }
                }}
                aria-label="Toggle planning group list"
              >
                <Search className="h-5 w-5" />
              </button>
              {groupDropdownOpen && !showAllSwitch && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow max-h-64 overflow-auto">
                  {groupDropdownLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No entries</div>
                  ) : (
                    filteredGroups.map((item, idx) => (
                      <button
                        key={`${item.PlanningGroupTransport}-${idx}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                        onClick={() => {
                          setGroupInput(item.PlanningGroupTransport);
                          setGroupQuery(item.PlanningGroupTransport);
                          setGroupDropdownOpen(false);
                        }}
                      >
                        <div className="text-sm font-medium">{item.PlanningGroupTransport}</div>
                        <div className="text-xs text-gray-500">{item.Description}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <FloatingLabelInput
                id="kittingOverviewId"
                label="Kitting ID"
                value={kittingInput}
                onChange={(e) => {
                  setKittingInput(e.target.value);
                  setKittingQuery(e.target.value);
                  if (!kittingDropdownOpen) setKittingDropdownOpen(true);
                }}
                onFocus={async () => {
                  if (showAllSwitch) return;
                  setKittingDropdownOpen(true);
                  setGroupDropdownOpen(false);
                  if (kittingItems.length === 0 && !kittingDropdownLoading) {
                    setKittingDropdownLoading(true);
                    try {
                      await fetchKittingVehicles();
                    } finally {
                      setKittingDropdownLoading(false);
                    }
                  }
                }}
                onClick={() => {
                  if (!showAllSwitch) setKittingDropdownOpen((prev) => !prev);
                }}
                className="pr-10"
                disabled={showAllSwitch}
              />
              <button
                type="button"
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 ${showAllSwitch ? "pointer-events-none opacity-40" : ""}`}
                onClick={async () => {
                  if (showAllSwitch) return;
                  setKittingDropdownOpen((prev) => !prev);
                  setGroupDropdownOpen(false);
                  if (kittingItems.length === 0 && !kittingDropdownLoading) {
                    setKittingDropdownLoading(true);
                    try {
                      await fetchKittingVehicles();
                    } finally {
                      setKittingDropdownLoading(false);
                    }
                  }
                }}
                aria-label="Toggle kitting list"
              >
                <Search className="h-5 w-5" />
              </button>
              {kittingDropdownOpen && !showAllSwitch && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow max-h-64 overflow-auto">
                  {kittingDropdownLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
                  ) : filteredKittings.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">{trans.noEntries}</div>
                  ) : (
                    filteredKittings.map((item, idx) => (
                      <button
                        key={`${item.VehicleID}-${idx}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                        onClick={() => {
                          setKittingInput(item.VehicleID);
                          setKittingQuery(item.VehicleID);
                          setKittingDropdownOpen(false);
                        }}
                      >
                        <div className="text-sm font-medium">{item.VehicleID}</div>
                        <div className="text-xs text-gray-500">{item.Description}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="showAllOverviewKittings"
                checked={showAllSwitch}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setShowAllSwitch(next);
                  if (next) {
                    setGroupInput("");
                    setGroupQuery("");
                    setKittingInput("");
                    setKittingQuery("");
                    setGroupDropdownOpen(false);
                    setKittingDropdownOpen(false);
                  }
                }}
              />
              <label htmlFor="showAllOverviewKittings" className="text-sm select-none cursor-pointer">
                SHOW ALL KITTINGS
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!showAllSwitch && !groupInput.trim() && !kittingInput.trim()}
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

export default KittingOverview;
