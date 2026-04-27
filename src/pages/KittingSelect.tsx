import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredGsiAuth } from "@/lib/gsi-auth-storage";
import { type LanguageKey } from "@/lib/i18n";

type VehicleItem = {
  VehicleID: string;
  Description: string;
};

const KittingSelect = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [kittingId, setKittingId] = useState("");
  const [showAllKittings, setShowAllKittings] = useState(false);
  const [kittingItems, setKittingItems] = useState<VehicleItem[]>([]);
  const [kittingQuery, setKittingQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const lang: LanguageKey = ((localStorage.getItem("app.lang") as LanguageKey) || "en");
  const locale = useMemo(() => {
    if (lang === "de") return "de-DE";
    if (lang === "es-MX") return "es-MX";
    if (lang === "pt-BR") return "pt-BR";
    return "en-US";
  }, [lang]);

  useEffect(() => {
    setOpen(true);
  }, []);

  const filteredKittings = kittingItems.filter((item) => {
    const query = kittingQuery.trim().toLowerCase();
    if (!query) return true;
    return item.VehicleID.toLowerCase().includes(query) || (item.Description || "").toLowerCase().includes(query);
  });

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

  const onCancel = () => {
    clearStoredGsiAuth();
    setOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) navigate("/menu");
        }}
      >
        <DialogContent
          className="max-w-md rounded-lg border bg-white/95 p-0 shadow-lg"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Kittingscreen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4 pt-2 relative">
            <div className="relative">
              <FloatingLabelInput
                id="kittingId"
                label="Kitting ID"
                value={kittingId}
                onChange={(e) => {
                  setKittingId(e.target.value);
                  setKittingQuery(e.target.value);
                }}
                autoFocus
                className="pr-12"
                disabled={showAllKittings}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-gray-700 hover:text-gray-900 ${showAllKittings ? "pointer-events-none opacity-40" : ""}`}
                aria-label="Search kitting vehicles"
                onClick={async () => {
                  if (showAllKittings) return;
                  if (!dropdownOpen) {
                    setDropdownOpen(true);
                    setDropdownLoading(true);
                    await fetchKittingVehicles();
                    setDropdownLoading(false);
                  } else {
                    setDropdownOpen(false);
                  }
                }}
              >
                <Search className="h-5 w-5" />
              </Button>

              {dropdownOpen && !showAllKittings && (
                <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-50">
                  <div className="space-y-2">
                    <Input
                      placeholder="Search vehicle..."
                      value={kittingQuery}
                      onChange={(e) => setKittingQuery(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <div className="max-h-56 overflow-auto space-y-1">
                      {dropdownLoading ? (
                        <div className="text-xs text-muted-foreground px-1">Loading…</div>
                      ) : filteredKittings.length === 0 ? (
                        <div className="text-xs text-muted-foreground px-1">No vehicles</div>
                      ) : (
                        filteredKittings.map((item, idx) => (
                          <button
                            key={`${item.VehicleID}-${idx}`}
                            type="button"
                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                            onClick={() => {
                              setKittingId(item.VehicleID);
                              setKittingQuery(item.VehicleID);
                              setDropdownOpen(false);
                            }}
                          >
                            <div className="text-sm font-medium">{item.VehicleID}</div>
                            <div className="text-xs text-gray-600">{item.Description}</div>
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
                id="showAllKittings"
                checked={showAllKittings}
                onCheckedChange={(value) => {
                  const next = Boolean(value);
                  setShowAllKittings(next);
                  if (next) {
                    setKittingId("");
                    setKittingQuery("");
                    setDropdownOpen(false);
                  }
                }}
              />
              <label htmlFor="showAllKittings" className="text-sm text-gray-800">
                SHOW ALL KITTINGS
              </label>
            </div>
          </div>

          <DialogFooter className="px-4 pb-4">
            <div className="w-full space-y-2">
              <Button
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => navigate("/menu")}
              >
                OK
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                onClick={onCancel}
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

export default KittingSelect;
