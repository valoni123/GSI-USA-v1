import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowBigLeft, ArrowBigRight, Forklift, User, LogOut, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Tile = { key: string; label: string; icon: React.ReactNode };

const TransportMenu = () => {
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
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  const tiles: Tile[] = [
    {
      key: "load",
      label: trans.transportLoad,
      icon: (
        <div className="relative flex items-center justify-center">
          <Forklift className="h-10 w-10 text-red-700" />
          <ArrowBigLeft className="absolute -right-4 top-1/2 -translate-y-1/2 h-7 w-7 text-red-700" />
        </div>
      ),
    },
    {
      key: "unload",
      label: trans.transportUnload,
      icon: (
        <div className="relative flex items-center justify-center">
          <Forklift className="h-10 w-10 text-red-700 transform scale-x-[-1]" />
          <ArrowBigRight className="absolute -left-4 top-1/2 -translate-y-1/2 h-7 w-7 text-red-700" />
        </div>
      ),
    },
  ];
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [listOpen, setListOpen] = useState<boolean>(false);
  const [listItems, setListItems] = useState<Array<{ HandlingUnit: string; LocationFrom: string; LocationTo: string }>>([]);

  // Vehicle selection
  const initialSelected = sessionStorage.getItem("transport.selected") === "1";
  const initialFromMain = sessionStorage.getItem("transport.fromMain") === "1";
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState<boolean>(initialFromMain ? true : !initialSelected);
  const [vehicleList, setVehicleList] = useState<Array<{ VehicleID: string; Description: string }>>([]);
  const [vehicleQuery, setVehicleQuery] = useState<string>("");
  const filteredVehicles = vehicleList.filter((v) => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      v.VehicleID.toLowerCase().includes(q) ||
      (v.Description || "").toLowerCase().includes(q)
    );
  });
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState<boolean>(false);

  // Helper to fetch count for a given vehicle (called only after load/unload)
  const fetchCount = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId: vid, language: "en-US", company: "1000" },
    });
    const next = data && data.ok ? Number(data.count || 0) : 0;
    setLoadedCount(next);
    try {
      localStorage.setItem("transport.count", String(next));
    } catch {}
  };

  const fetchList = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-list", {
      body: { vehicleId: vid, language: "en-US", company: "1000" },
    });
    if (data && data.ok) {
      setListItems((data.items || []) as Array<{ HandlingUnit: string; LocationFrom: string; LocationTo: string }>);
    } else {
      setListItems([]);
    }
  };

  // Ensure we read cached count immediately on mount and set up focus/visibility refresh
  useEffect(() => {
    // Read cached count right away regardless of dialog state
    const cached = Number(localStorage.getItem("transport.count") || "0");
    setLoadedCount(cached);

    // Prefill vehicleId (unchanged)
    (async () => {
      const gsiId = localStorage.getItem("gsi.id") || undefined;
      const username = localStorage.getItem("gsi.username") || undefined;
      const { data } = await supabase.functions.invoke("gsi-get-vehicle-id", {
        body: { gsi_id: gsiId, username },
      });
      if (data && data.ok && typeof data.vehicleId === "string" && data.vehicleId) {
        setVehicleId(data.vehicleId);
      } else {
        const stored = (localStorage.getItem("vehicle.id") || "").trim();
        if (stored) setVehicleId(stored);
      }

      // Dialog visibility control (unchanged)
      const fromMain = sessionStorage.getItem("transport.fromMain") === "1";
      if (fromMain) {
        setVehicleDialogOpen(true);
        sessionStorage.removeItem("transport.fromMain");
      }
    })();

    // Re-read cached count when window/tab regains focus or becomes visible
    const syncCachedCount = () => {
      const cachedNow = Number(localStorage.getItem("transport.count") || "0");
      setLoadedCount(cachedNow);
    };
    window.addEventListener("focus", syncCachedCount);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncCachedCount();
    });

    return () => {
      window.removeEventListener("focus", syncCachedCount);
      // No need to remove the anonymous listener; add a named wrapper if you prefer later
    };
  }, []);

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
            onClick={() => {
              sessionStorage.removeItem("transport.selected");
              navigate("/menu");
            }}
          >
            <ArrowBigLeft className="h-6 w-6" />
          </Button>

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.appTransport}</div>
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

      {/* Grid of Transport tiles */}
      <div className="relative mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
            onClick={() => {
              if (tile.key === "load") {
                navigate("/menu/transport/load");
              }
              if (tile.key === "unload") {
                navigate("/menu/transport/unload");
              }
            }}
          >
            {tile.icon}
            <div className="text-sm font-medium text-gray-700 text-center">{tile.label}</div>
          </Card>
        ))}
        {/* Center badge between tiles */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            className="bg-red-700 text-white rounded-md h-6 px-2 min-w-[24px] inline-flex items-center justify-center text-sm font-bold shadow focus:outline-none"
            onClick={async () => {
              const vid = (localStorage.getItem("vehicle.id") || "").trim();
              if (!vid) return;
              const willOpen = !listOpen;
              setListOpen(willOpen);
              if (willOpen) {
                await fetchList(vid);
              }
            }}
          >
            {loadedCount}
          </button>
        </div>
        {/* Overlay list dialog */}
        <Dialog open={listOpen} onOpenChange={setListOpen}>
          <DialogContent className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg [&>button]:hidden">
            <div className="text-sm">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-b rounded-t-lg bg-gray-100">
                <div className="font-semibold">{trans.loadHandlingUnit}</div>
                <div className="font-semibold">{trans.locationFromLabel}</div>
                <div className="font-semibold">{trans.locationToLabel}</div>
              </div>
              <div className="max-h-64 overflow-auto mt-0 space-y-2 px-2 py-2">
                {listItems.length === 0 ? (
                  <div className="text-xs text-muted-foreground px-1">No entries</div>
                ) : (
                  listItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs px-3 py-2 rounded-md bg-gray-50"
                    >
                      <div className="break-all">{it.HandlingUnit}</div>
                      <div className="break-all">{it.LocationFrom}</div>
                      <div className="break-all">{it.LocationTo}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fahrzeug-ID selection dialog */}
      <Dialog
        open={vehicleDialogOpen}
        onOpenChange={(open) => {
          setVehicleDialogOpen(open);
          if (!open) {
            const selected = sessionStorage.getItem("transport.selected") === "1";
            // Require explicit confirmation via Select; if not selected, return to main menu
            if (!selected) {
              sessionStorage.removeItem("transport.selected");
              navigate("/menu");
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{trans.loadVehicleId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 relative">
            <FloatingLabelInput
              id="transportVehicleId"
              label={trans.loadVehicleId}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              autoFocus
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1 text-gray-700 hover:text-gray-900 h-8 w-8 flex items-center justify-center"
              aria-label="Search vehicles"
              onClick={async () => {
                const { data } = await supabase.functions.invoke("ln-vehicles-list", { body: {} });
                if (data && data.ok) {
                  setVehicleList(data.items || []);
                  setVehicleQuery("");
                } else {
                  setVehicleList([]);
                }
                setVehicleDropdownOpen((o) => !o);
              }}
            >
              <Search className="h-6 w-6" />
            </Button>

            {vehicleDropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2">
                <div className="space-y-2">
                  <Input
                    placeholder="Search vehicle…"
                    value={vehicleQuery}
                    onChange={(e) => setVehicleQuery(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="max-h-56 overflow-auto space-y-1">
                    {filteredVehicles.length === 0 ? (
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
          <DialogFooter>
            <Button
              className="w-full h-10 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              disabled={!vehicleId.trim()}
              onClick={async () => {
                const vid = vehicleId.trim();
                if (!vid) return;
                localStorage.setItem("vehicle.id", vid);
                sessionStorage.setItem("transport.selected", "1");
                setVehicleDialogOpen(false);
                // Do NOT refresh count via REST here; use cached value
                const cached = Number(localStorage.getItem("transport.count") || "0");
                setLoadedCount(cached);
              }}
            >
              {trans.selectLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

export default TransportMenu;