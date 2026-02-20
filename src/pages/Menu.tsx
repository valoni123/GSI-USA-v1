import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, ArrowDownCircle, ArrowUpCircle, Warehouse, Package, Box, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";

type AppTile = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

function Menu() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<LanguageKey>(() => {
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

  const apps: AppTile[] = [
    { key: "incoming", label: trans.appIncoming, icon: <ArrowDownCircle className="h-10 w-10 text-red-700" /> },
    { key: "outgoing", label: trans.appOutgoing, icon: <ArrowUpCircle className="h-10 w-10 text-red-700" /> },
    { key: "infoStock", label: trans.appInfoStock, icon: <Warehouse className="h-10 w-10 text-red-700" /> },
    { key: "containers", label: trans.appContainers, icon: <Box className="h-10 w-10 text-red-700" /> },
    { key: "transport", label: trans.appTransport, icon: <Package className="h-10 w-10 text-red-700" /> },
    { key: "settings", label: trans.appSettings, icon: <Settings className="h-10 w-10 text-red-700" /> },
  ];

  const onConfirmSignOut = () => {
    // Clear local session data
    try {
      localStorage.removeItem("ln.token");
      localStorage.removeItem("gsi.id");
      localStorage.removeItem("gsi.full_name");
    } catch {}
    showSuccess(trans.signedOut);
    setSignOutOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black text-white">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="text-center w-full font-bold text-lg tracking-wide">{trans.menu}</div>
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

      {/* Grid of app tiles */}
      <div className="mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {apps.map((app) => (
          <Card
            key={app.key}
            className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99] min-h-[160px]"
            onClick={() => {
              if (app.key === "incoming") {
                navigate("/menu/incoming");
              }
              if (app.key === "infoStock") {
                navigate("/menu/info-stock");
              }
              if (app.key === "transport") {
                // Mark that we're entering Transport from the main menu and force dialog to open
                sessionStorage.setItem("transport.fromMain", "1");
                // Clear previous in-transport selection so user confirms Vehicle-ID again
                sessionStorage.removeItem("transport.selected");
                navigate("/menu/transport");
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
}

export default Menu;