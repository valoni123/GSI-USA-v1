import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FloatingLabelInput from "@/components/FloatingLabelInput";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";

const TransportLoad = () => {
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

  const huRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    // Focus the first field on mount
    huRef.current?.focus();
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
            onClick={() => navigate("/menu/transport")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          <div className="flex flex-col items-center flex-1">
            <div className="font-bold text-lg tracking-wide text-center">{trans.transportLoad}</div>
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

      {/* Form area */}
      <div className="mx-auto max-w-md px-4 py-6">
        <Card className="rounded-md border-2 border-gray-200 bg-white p-4 space-y-4">
          <FloatingLabelInput id="handlingUnit" label={trans.loadHandlingUnit} autoFocus />
          <FloatingLabelInput id="vehicleId" label={trans.loadVehicleId} disabled />
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

export default TransportLoad;