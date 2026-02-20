import { useEffect, useMemo, useState } from "react";
import LoginForm from "@/components/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HelpMenu from "@/components/HelpMenu";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [lang, setLang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });

  const trans = useMemo(() => t(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("app.lang", lang);
  }, [lang]);

  const navigate = useNavigate();

  const handleLogin = async ({ username, password, transportscreen }: { username: string; password: string; transportscreen?: boolean }) => {
    if (!username || !password) {
      showError(trans.emptyFields);
      return;
    }
    const id = showLoading(trans.signingIn);
    const { data, error } = await supabase.functions.invoke("verify-gsi-login", {
      body: { username, password },
    });
    dismissToast(id as unknown as string);
    if (error || !data || !data.ok) {
      showError(trans.invalidCredentials);
      return;
    }
    showSuccess(trans.signedIn);
    const gsiId = data.user?.id as string | undefined;
    const fullName = data.user?.full_name as string | undefined;
    const userUsername = data.user?.username as string | undefined;
    try {
      if (gsiId) localStorage.setItem("gsi.id", gsiId);
      if (fullName) localStorage.setItem("gsi.full_name", fullName);
      if (userUsername) localStorage.setItem("gsi.username", userUsername);
      localStorage.setItem("gsi.employee", username);
      localStorage.setItem("gsi.login", username);
    } catch {}

    // Retrieve INFOR LN OAuth2 token
    const tid = showLoading(trans.retrievingToken);
    const { data: tokenData, error: tokenErr } = await supabase.functions.invoke("ln-get-token", {
      body: { gsi_id: gsiId },
    });
    dismissToast(tid as unknown as string);
    if (tokenErr || !tokenData || !tokenData.ok) {
      showError(trans.tokenFailed);
      return;
    }
    showSuccess(trans.tokenReceived);
    try {
      localStorage.setItem("ln.token", JSON.stringify(tokenData.token));
      // Reset cached transport count on login
      localStorage.setItem("transport.count", "0");
    } catch {}

    // Decide destination based on Transportscreen checkbox
    if (transportscreen) {
      navigate("/transport/select");
    } else {
      navigate("/menu");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 pb-12">
      <div className="relative w-full max-w-md flex flex-col items-center">
        <div className="absolute right-0 -top-10 md:-top-12">
          <HelpMenu topic="login" />
        </div>
        <h1 className="sr-only">{trans.title}</h1>
        <LoginForm
          lang={lang}
          onSubmit={handleLogin}
          logoSrc="/black_logo_transparent_background.png"
        />
        <LanguageSwitcher value={lang} onChange={setLang} mode="overlap" />
      </div>
    </div>
  );
};

export default Index;