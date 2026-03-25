import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, ArrowDownCircle, ArrowUpCircle, Warehouse, Settings, Forklift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";
import { canAccessIncomingMenu, canAccessInfoStockMenu, canAccessOutgoingMenu, canAccessTransportMenus, clearStoredGsiPermissions, getStoredGsiPermissions } from "@/lib/gsi-permissions";

type AppTile = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

function Menu() {
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
  const permissions = useMemo(() => getStoredGsiPermissions(), []);

  const apps: AppTile[] = [
    ...(canAccessIncomingMenu(permissions)
      ? [{ key: "incoming", label: trans.appIncoming, icon: <ArrowDownCircle className="h-10 w-10 text-red-700" /> }]
      : []),
    ...(canAccessOutgoingMenu(permissions)
      ? [{ key: "outgoing", label: trans.appOutgoing, icon: <ArrowUpCircle className="h-10 w-10 text-red-700" /> }]
      : []),
    ...(canAccessInfoStockMenu(permissions)
      ? [{ key: "infoStock", label: trans.appInfoStock, icon: <Warehouse className="h-10 w-10 text-red-700" /> }]
      : []),
    ...(canAccessTransportMenus(permissions)
      ? [{ key: "transports", label: trans.appTransports, icon: <Forklift className="h-10 w-10 text-red-700" /> }]
      : []),
    { key: "settings", label: trans.appSettings, icon: <Settings className="h-10 w-10 text-red-700" /> },
  ];

  const onConfirmSignOut = () => {
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
      clearStoredGsiPermissions();
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="inline-flex self-center rounded-md bg-gray-200 px-4 py-1 text-center text-lg font-bold tracking-wide text-black">{trans.menu}</div>

            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200 justify-center">
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

      <div className="mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {apps.map((app) => (
          <Card
            key={app.key}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-md shadow-gray-300/70 cursor-pointer active:scale-[0.99] min-h-[160px]"

            onClick={() => {
              if (app.key === "incoming") {
                navigate("/menu/incoming");
              }
              if (app.key === "outgoing") {
                navigate("/menu/outgoing");
              }
              if (app.key === "infoStock") {
                navigate("/menu/info-stock");
              }
              if (app.key === "transport") {
                sessionStorage.setItem("transport.fromMain", "1");
                sessionStorage.removeItem("transport.selected");
                navigate("/menu/transport");
              }
              if (app.key === "transports") {
                navigate("/menu/transports");
              }
            }}
          >
            <div className="h-14 w-14 rounded-md border-2 border-red-700 flex items-center justify-center overflow-hidden">
              {app.icon}
            </div>
            <div className="text-sm font-medium text-gray-700 text-center">{app.label}</div>
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
}

export default Menu;