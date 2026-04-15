import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SignOutConfirm from "@/components/SignOutConfirm";
import { type LanguageKey, t } from "@/lib/i18n";
import { showSuccess } from "@/utils/toast";
import { clearStoredGsiPermissions } from "@/lib/gsi-permissions";

const KittingDocs = () => {
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
  const [orderSet, setOrderSet] = useState("");
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
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <BackButton ariaLabel={trans.back} onClick={() => navigate("/menu")} />

          <div className="flex flex-col items-center flex-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/menu")}
              className="rounded-md bg-gray-200 px-4 py-1 font-bold text-lg tracking-wide text-center text-black hover:opacity-80"
            >
              {trans.appKittingDocs}
            </button>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
              <User className="h-4 w-4 shrink-0" />
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

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md shadow-gray-300/70 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6">
            <div className="text-lg font-semibold text-gray-800">{trans.appKittingDocs}</div>

            <div className="max-w-xl space-y-2">
              <div className="relative pt-2">
                <Input
                  id="kittingOrderSet"
                  value={orderSet}
                  onChange={(e) => setOrderSet(e.target.value)}
                  placeholder={trans.scanOrderSetPlaceholder}
                  autoFocus
                  autoComplete="off"
                  className="h-12 border-gray-300 text-base sm:h-14 sm:text-lg"
                />
                <label
                  htmlFor="kittingOrderSet"
                  className="pointer-events-none absolute left-3 top-0 rounded-sm bg-white px-1 text-xs text-gray-700"
                >
                  {trans.orderSetLabel}
                </label>
              </div>
            </div>
          </div>
        </Card>
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

export default KittingDocs;