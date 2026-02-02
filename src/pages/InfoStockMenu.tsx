import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Box, Info, Eraser, ArrowLeftRight, ClipboardList, ListChecks, User, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";

type Tile = { key: string; label: string; icon: React.ReactNode };

const InfoStockMenu = () => {
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
    { key: "article", label: trans.infoStockArticle, icon: <Box className="h-10 w-10 text-red-700" /> },
    { key: "leInfo", label: trans.infoStockLEInfo, icon: <Info className="h-10 w-10 text-red-700" /> },
    { key: "correction", label: trans.infoStockCorrection, icon: <Eraser className="h-10 w-10 text-red-700" /> },
    { key: "transfer", label: trans.infoStockTransfer, icon: <ArrowLeftRight className="h-10 w-10 text-red-700" /> },
    { key: "inventoryPos", label: trans.infoStockInventoryPos, icon: <ListChecks className="h-10 w-10 text-red-700" /> },
    { key: "inventory", label: trans.infoStockInventory, icon: <ClipboardList className="h-10 w-10 text-red-700" /> },
    { key: "personalInventory", label: trans.infoStockPersonalInventory, icon: <ListChecks className="h-10 w-10 text-red-700" /> },
  ];

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
            <div className="font-bold text-lg tracking-wide text-center">{trans.appInfoStock}</div>
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

      {/* Grid of app tiles */}
      <div className="mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        <Card
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => navigate("/menu/info-stock/article")}
        >
          <Box className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockArticle}</div>
        </Card>
        <Card
          key="leInfo"
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => navigate("/menu/info-stock/le-info")}
        >
          <Info className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockLEInfo}</div>
        </Card>
        <Card
          key="correction"
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => {}}
        >
          <Eraser className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockCorrection}</div>
        </Card>
        <Card
          key="transfer"
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => {}}
        >
          <ArrowLeftRight className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockTransfer}</div>
        </Card>
        <Card
          key="inventoryPos"
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => {}}
        >
          <ListChecks className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockInventoryPos}</div>
        </Card>
        <Card
          key="inventory"
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => {}}
        >
          <ClipboardList className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockInventory}</div>
        </Card>
        <Card
          key="personalInventory"
          className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
          onClick={() => {}}
        >
          <ListChecks className="h-10 w-10 text-red-700" />
          <div className="text-sm font-medium text-gray-700 text-center">{trans.infoStockPersonalInventory}</div>
        </Card>
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

export default InfoStockMenu;