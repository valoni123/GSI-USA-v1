import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type LanguageKey, t } from "@/lib/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import ScreenSpinner from "@/components/ScreenSpinner";

type GroupItem = { PlanningGroupTransport: string; Description: string };
type VehicleItem = { VehicleID: string; Description: string };

const TransportSelect = () => {
  const navigate = useNavigate();
  const [lang] = useState<LanguageKey>(() => (localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);

  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [group, setGroup] = useState("");
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupDropdownLoading, setGroupDropdownLoading] = useState(false);
  const [showAll, setShowAll] = useState<boolean>(false);

  const [vehicleId, setVehicleId] = useState("");
  const [vehicleItems, setVehicleItems] = useState<VehicleItem[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [vehicleDropdownLoading, setVehicleDropdownLoading] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    (async () => {
      const gsiId = localStorage.getItem("gsi.id") || undefined;
      const username = localStorage.getItem("gsi.username") || undefined;
      const { data } = await supabase.functions.invoke("gsi-get-vehicle-id", {
        body: { gsi_id: gsiId, username },
      });
      if (data && data.ok && typeof data.vehicleId === "string" && data.vehicleId) {
        setVehicleId(data.vehicleId);
        return;
      }
      const stored = (localStorage.getItem("vehicle.id") || "").trim();
      if (stored) setVehicleId(stored);
    })();
  }, []);

  const filteredGroups = groupItems.filter((it) => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      it.PlanningGroupTransport.toLowerCase().includes(q) ||
      (it.Description || "").toLowerCase().includes(q)
    );
  });

  const filteredVehicles = vehicleItems.filter((it) => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return true;
    return it.VehicleID.toLowerCase().includes(q) || (it.Description || "").toLowerCase().includes(q);
  });

  const fetchGroups = async () => {
    const { data } = await supabase.functions.invoke("ln-transport-groups-list", {
      body: { language: "en-US", company: "1100" },
    });
    if (data && data.ok) {
      setGroupItems((data.items || []) as GroupItem[]);
      setGroupQuery("");
    } else {
      setGroupItems([]);
    }
  };

  const fetchVehicles = async () => {
    const { data } = await supabase.functions.invoke("ln-vehicles-list", {
      body: { language: "en-US", company: "1100" },
    });
    if (data && data.ok) {
      setVehicleItems((data.items || []) as VehicleItem[]);
      setVehicleQuery("");
    } else {
      setVehicleItems([]);
    }
  };

  const onConfirm = () => {
    const vid = vehicleId.trim();
    if (vid) {
      localStorage.setItem("vehicle.id", vid);
    } else {
      localStorage.removeItem("vehicle.id");
    }
    setSubmitting(true);

    if (showAll) {
      navigate(`/transportgroup/ALL`);
      return;
    }

    const val = group.trim();
    if (!val && !vid) {
      setSubmitting(false);
      return;
    }
    if (!val) {
      navigate(`/transportgroup`);
      return;
    }
    navigate(`/transportgroup/${encodeURIComponent(val)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {submitting && <ScreenSpinner message={trans.pleaseWait} />}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) navigate("/menu");
        }}
      >
        <DialogContent
          className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              <button
                type="button"
                onClick={() => navigate("/menu/transport")}
                className="font-semibold hover:opacity-80"
              >
                {trans.planningGroupTransport}
              </button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4 pt-2 relative">
            <div className="relative">
              <FloatingLabelInput
                id="planningGroup"
                label={trans.planningGroupTransport}
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setGroupQuery(e.target.value);
                }}
                autoFocus
                className="pr-12"
                disabled={showAll || submitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-gray-700 hover:text-gray-900 ${showAll || submitting ? "pointer-events-none opacity-40" : ""}`}
                aria-label="Search groups"
                onClick={async () => {
                  if (showAll || submitting) return;
                  if (!groupDropdownOpen) {
                    setGroupDropdownOpen(true);
                    setVehicleDropdownOpen(false);
                    setGroupDropdownLoading(true);
                    await fetchGroups();
                    setGroupDropdownLoading(false);
                  } else {
                    setGroupDropdownOpen(false);
                  }
                }}
              >
                <Search className="h-5 w-5" />
              </Button>

              {groupDropdownOpen && !showAll && !submitting && (
                <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-50">
                  <div className="space-y-2">
                    <Input
                      placeholder="Search planning group..."
                      value={groupQuery}
                      onChange={(e) => setGroupQuery(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <div className="max-h-56 overflow-auto space-y-1">
                      {groupDropdownLoading ? (
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
                              setGroup(v.PlanningGroupTransport);
                              setGroupDropdownOpen(false);
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

            <div className="relative">
              <FloatingLabelInput
                id="vehicleId"
                label={trans.loadVehicleId}
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setVehicleQuery(e.target.value);
                }}
                className="pr-12"
                disabled={showAll || submitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-gray-700 hover:text-gray-900 ${showAll || submitting ? "pointer-events-none opacity-40" : ""}`}
                aria-label="Search vehicles"
                onClick={async () => {
                  if (showAll || submitting) return;
                  if (!vehicleDropdownOpen) {
                    setVehicleDropdownOpen(true);
                    setGroupDropdownOpen(false);
                    setVehicleDropdownLoading(true);
                    await fetchVehicles();
                    setVehicleDropdownLoading(false);
                  } else {
                    setVehicleDropdownOpen(false);
                  }
                }}
              >
                <Search className="h-5 w-5" />
              </Button>

              {vehicleDropdownOpen && !showAll && !submitting && (
                <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-50">
                  <div className="space-y-2">
                    <Input
                      placeholder="Search vehicle..."
                      value={vehicleQuery}
                      onChange={(e) => setVehicleQuery(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <div className="max-h-56 overflow-auto space-y-1">
                      {vehicleDropdownLoading ? (
                        <div className="text-xs text-muted-foreground px-1">Loading…</div>
                      ) : filteredVehicles.length === 0 ? (
                        <div className="text-xs text-muted-foreground px-1">No vehicles</div>
                      ) : (
                        filteredVehicles.map((v, idx) => (
                          <button
                            key={`${v.VehicleID}-${idx}`}
                            type="button"
                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                            onClick={() => {
                              setVehicleId(v.VehicleID);
                              setVehicleDropdownOpen(false);
                            }}
                          >
                            <div className="text-sm font-medium">{v.VehicleID}</div>
                            <div className="text-xs text-gray-600">{v.Description}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <Checkbox
                id="showAllTransports"
                checked={showAll}
                onCheckedChange={(val) => {
                  const next = Boolean(val);
                  setShowAll(next);
                  if (next) {
                    setGroup("");
                    setGroupQuery("");
                    setVehicleId("");
                    setVehicleQuery("");
                    setGroupDropdownOpen(false);
                    setVehicleDropdownOpen(false);
                  }
                }}
                disabled={submitting}
              />
              <label htmlFor="showAllTransports" className="text-sm text-gray-800">
                {trans.showAllTransports}
              </label>
            </div>
          </div>

          <DialogFooter className="px-4 pb-4">
            <div className="w-full space-y-2">
              <Button
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                disabled={submitting || (!showAll && !vehicleId.trim() && !group.trim())}
                onClick={onConfirm}
              >
                OK
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                disabled={submitting}
                onClick={() => {
                  setOpen(false);
                  navigate("/");
                }}
              >
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportSelect;