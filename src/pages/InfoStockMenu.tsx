import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Box, Info, Eraser, ArrowLeftRight, ClipboardList, ListChecks, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type LanguageKey, t } from "@/lib/i18n";

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

          {/* Right side empty to balance layout */}
          <div className="w-10" />
        </div>
      </div>

      {/* Grid of sub-menu tiles */}
      <div className="mx-auto max-w-md px-4 py-6 grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            className="rounded-md border-2 border-gray-200 bg-white p-6 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-[0.99]"
            onClick={() => {
              // Placeholder: later we'll route to each app
            }}
          >
            {tile.icon}
            <div className="text-sm font-medium text-gray-700 text-center">{tile.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InfoStockMenu;