import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, Box, Clock, LogOut, Search, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";
import { getStoredGsiPermissions, hasPermission, clearStoredGsiPermissions } from "@/lib/gsi-permissions";

const IncomingMenu = () => {
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

  const tiles = [
    ...(hasPermission(permissions, "rece")
      ? [{
          key: "goodsReceipt",
          label: trans.incomingGoodsReceipt,
          icon: <ArrowDown className="h-10 w-10 text-red-700" />,
        }]
      : []),
    ...(hasPermission(permissions, "insp")
      ? [{
          key: "warehouseInspection",
          label: trans.incomingWarehouseInspection,
          icon: <Search className="h-10 w-10 text-red-700" />,
        }]
      : []),
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
              {trans.appIncoming.toUpperCase()}
            </button>
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

      {/* Grid */}
      <div className="mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 flex flex-col items-center gap-3 shadow-md shadow-gray-300/70 cursor-pointer active:scale-[0.99] min-h-[160px]"

            onClick={() => {
              if (tile.key === "goodsReceipt") {
                navigate("/menu/incoming/goods-receipt");
              }
              if (tile.key === "warehouseInspection") {
                navigate("/menu/incoming/inspection");
              }
            }}
          >
            <div className="h-14 w-14 rounded-md border-2 border-red-700 flex items-center justify-center overflow-hidden">
              {tile.icon}
            </div>
            <div className="text-sm font-medium text-gray-700 text-center">{tile.label}</div>
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

export default IncomingMenu;