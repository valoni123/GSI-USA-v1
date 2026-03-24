import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, CheckCircle2, Send, Truck, LogOut, ListChecks } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import UserIdentity from "@/components/UserIdentity";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";

const OutgoingMenu = () => {
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

  const tiles = [
    {
      key: "picking",
      label: trans.outgoingPicking,
      icon: <ClipboardList className="h-10 w-10 text-red-700" />,
    },
    {
      key: "release",
      label: trans.outgoingRelease,
      icon: <CheckCircle2 className="h-10 w-10 text-red-700" />,
    },
    {
      key: "shipment",
      label: trans.outgoingShipment,
      icon: <Send className="h-10 w-10 text-red-700" />,
    },
    {
      key: "loading",
      label: trans.outgoingLoading,
      icon: <Truck className="h-10 w-10 text-red-700" />,
    },
    {
      key: "personalPicking",
      label: trans.outgoingPersonalPicking,
      icon: <ListChecks className="h-10 w-10 text-red-700" />,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu")} />

          <div className="flex flex-col items-center flex-1">
            <button
              type="button"
              onClick={() => navigate("/menu")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg tracking-wide text-center text-black hover:opacity-80"

            >
              {trans.appOutgoing.toUpperCase()}
            </button>
            <UserIdentity fullName={fullName} />
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

      {/* Grid */}
      <div className="mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            className="rounded-xl border-2 border-gray-200 bg-white p-0 shadow-md shadow-gray-300/70 min-h-[160px] overflow-hidden"

          >
            <button
              type="button"
              className="w-full h-full p-6 flex flex-col items-center gap-3"
              onClick={() => {
                if (tile.key === "picking") {
                  navigate("/menu/outgoing/picking");
                }
              }}
            >
              <div className="h-14 w-14 rounded-md border-2 border-red-700 flex items-center justify-center overflow-hidden">
                {tile.icon}
              </div>
              <div className="text-sm font-medium text-gray-700 text-center">{tile.label}</div>
            </button>
          </Card>
        ))}
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
    </div>
  );
};

export default OutgoingMenu;