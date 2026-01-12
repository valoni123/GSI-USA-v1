import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type LanguageKey, t } from "@/lib/i18n";

type Item = { PlanningGroupTransport: string; Description: string };

const TransportSelect = () => {
  const navigate = useNavigate();
  const [lang] = useState<LanguageKey>(() => (localStorage.getItem("app.lang") as LanguageKey) || "en");
  const trans = useMemo(() => t(lang), [lang]);

  const [open, setOpen] = useState(true);
  const [group, setGroup] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);

  useEffect(() => {
    // ensure dialog opens on entry
    setOpen(true);
  }, []);

  const filtered = items.filter((it) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      it.PlanningGroupTransport.toLowerCase().includes(q) ||
      (it.Description || "").toLowerCase().includes(q)
    );
  });

  const fetchGroups = async () => {
    const { data } = await supabase.functions.invoke("ln-transport-groups-list", { body: {} });
    if (data && data.ok) {
      setItems((data.items || []) as Item[]);
      setQuery("");
    } else {
      setItems([]);
    }
  };

  const onConfirm = () => {
    const val = group.trim();
    if (!val) return;
    navigate(`/transportgroup/${encodeURIComponent(val)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            <DialogTitle>{trans.planningGroupTransport}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 pb-4 pt-2 relative">
            <FloatingLabelInput
              id="planningGroup"
              label={trans.planningGroupTransport}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
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
                if (!dropdownOpen) {
                  setDropdownOpen(true);
                  setDropdownLoading(true);
                  fetchGroups().finally(() => setDropdownLoading(false));
                } else {
                  setDropdownOpen(false);
                }
              }}
            >
              <Search className="h-6 w-6" />
            </Button>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-50">
                <div className="space-y-2">
                  <Input
                    placeholder="Search…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="max-h-56 overflow-auto space-y-1">
                    {dropdownLoading ? (
                      <div className="text-xs text-muted-foreground px-1">Loading…</div>
                    ) : filtered.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-1">No groups</div>
                    ) : (
                      filtered.map((v, idx) => (
                        <button
                          key={`${v.PlanningGroupTransport}-${idx}`}
                          type="button"
                          className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                          onClick={() => {
                            setGroup(v.PlanningGroupTransport);
                            setDropdownOpen(false);
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
            <div className="w-full space-y-2">
              <Button
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                disabled={!group.trim()}
                onClick={onConfirm}
              >
                Select
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
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