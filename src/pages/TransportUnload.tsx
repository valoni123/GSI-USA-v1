import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SignOutConfirm from "@/components/SignOutConfirm";
import { supabase } from "@/integrations/supabase/client";
import { dismissToast, showLoading, showSuccess } from "@/utils/toast";
import { type LanguageKey, t } from "@/lib/i18n";

type LoadedItem = {
  HandlingUnit: string;
  Item: string;
  LocationFrom: string;
  LocationTo: string;
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
        <Card className="rounded-md border-2 border-gray-200 bg-white p-3">
          {/* Header row */}
          <div className="grid grid-cols-4 gap-2 px-2 py-2 border-b rounded-t-md bg-gray-100 text-xs font-semibold text-gray-700">
            <div className="whitespace-nowrap">{trans.loadHandlingUnit}</div>
            <div className="whitespace-nowrap">{trans.itemLabel}</div>
            <div className="whitespace-nowrap">{trans.locationFromLabel}</div>
            <div className="whitespace-nowrap">{trans.locationToLabel}</div>
          </div>
          {/* Rows */}
          <div className="max-h-[50vh] overflow-auto">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No entries</div>
            ) : (
              items.map((it, idx) => (
                <div
                  key={`${it.HandlingUnit}-${idx}`}
                  className="grid grid-cols-4 gap-2 px-2 py-2 border-b text-xs"
                >
                  <div className="break-all">{it.HandlingUnit || "-"}</div>
                  <div className="break-all">{it.Item || "-"}</div>
                  <div className="break-all">{it.LocationFrom || "-"}</div>
                  <div className="break-all">{it.LocationTo || "-"}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            className="w-full h-12 text-base bg-gray-600 text-white disabled:opacity-100 rounded-lg"
            disabled
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