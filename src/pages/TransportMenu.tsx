import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Box, User, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

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
          <Box className="h-10 w-10 text-red-700" />
          <ArrowLeft className="absolute -right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-red-700" />
        </div>
      ),
    },
    {
      key: "unload",
      label: trans.transportUnload,
      icon: (
        <div className="relative flex items-center justify-center">
          <Box className="h-10 w-10 text-red-700" />
          <ArrowRight className="absolute -left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-red-700" />
        </div>
      ),
    },
  ];
  const [loadedCount, setLoadedCount] = useState<number>(0);
  // Vehicle selection
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState<boolean>(true);

  // Helper to fetch count for a given vehicle
  const fetchCount = async (vid: string) => {
    const { data } = await supabase.functions.invoke("ln-transport-count", {
      body: { vehicleId: vid, language: "en-US", company: "1000" },
    });
    setLoadedCount(data && data.ok ? Number(data.count || 0) : 0);
  };

  // On mount: decide dialog visibility and prefill; from main → open dialog; inside transport → only open if not selected
  useEffect(() => {
    (async () => {
      // Prefill from gsi_users if available
      const gsiId = localStorage.getItem("gsi.id") || undefined;
      const username = localStorage.getItem("gsi.username") || undefined;
      const { data } = await supabase.functions.invoke("gsi-get-vehicle-id", {
        body: { gsi_id: gsiId, username },
      });
      if (data && data.ok && typeof data.vehicleId === "string" && data.vehicleId) {
        setVehicleId(data.vehicleId);
      } else {
        // If not in DB, also prefill from any previous local selection (for convenience)
        const stored = (localStorage.getItem("vehicle.id") || "").trim();
        if (stored) setVehicleId(stored);
      }

      // Control dialog visibility
      const fromMain = sessionStorage.getItem("transport.fromMain") === "1";
      const alreadySelected = sessionStorage.getItem("transport.selected") === "1";
      if (fromMain) {
        setVehicleDialogOpen(true);
        sessionStorage.removeItem("transport.fromMain");
      } else {
        setVehicleDialogOpen(!alreadySelected);
        // If already selected and we have a stored vehicle id, refresh count
        const stored = (localStorage.getItem("vehicle.id") || "").trim();
        if (alreadySelected && stored) {
          await fetchCount(stored);
        }
      }
    })();
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
            onClick={() => navigate("/menu")}
          >
            <ArrowLeft className="h-6 w-6" />
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
            }}
          >
            {tile.icon}
            <div className="text-sm font-medium text-gray-700 text-center">{tile.label}</div>
          </Card>
        ))}
        {/* Center badge between tiles */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow">
            {loadedCount}
          </div>
        </div>
      </div>

      {/* Fahrzeug-ID selection dialog */}
      <Dialog
        open={vehicleDialogOpen}
        onOpenChange={(open) => {
          setVehicleDialogOpen(open);
          if (!open) {
            const stored = (localStorage.getItem("vehicle.id") || "").trim();
            const vid = (vehicleId || "").trim();
            // If closed without a selected vehicle, go back to main menu
            if (!stored && !vid) {
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
          <div className="space-y-4 pt-2">
            <FloatingLabelInput
              id="transportVehicleId"
              label={trans.loadVehicleId}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full h-10 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              disabled={!vehicleId.trim()}
              onClick={async () => {
                const vid = vehicleId.trim();
                if (!vid) return;
                localStorage.setItem("vehicle.id", vid);
                // Mark selection within this Transport session so dialog won't reappear until user returns to main menu
                sessionStorage.setItem("transport.selected", "1");
                setVehicleDialogOpen(false);
                await fetchCount(vid);
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