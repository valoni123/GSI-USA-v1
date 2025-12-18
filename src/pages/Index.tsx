import { useEffect, useMemo, useState } from "react";
import LoginForm from "@/components/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
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

  const handleLogin = async ({ username, password }: { username: string; password: string }) => {
    if (!username || !password) {
      showError(trans.emptyFields);
      return;
    }
    const id = showLoading(trans.signingIn);
    const { data, error } = await supabase.functions.invoke("verify-gsi-login", {
      body: { username, password },
    });
    dismissToast(id as unknown as string);
    if (error) {
      showError(trans.invalidCredentials);
      return;
    }
    if (!data || !data.ok) {
      showError(trans.invalidCredentials);
      return;
    }
    showSuccess(trans.signedIn);
    const gsiId = data.user?.id as string | undefined;
    const fullName = data.user?.full_name as string | undefined;
    try {
      if (gsiId) localStorage.setItem("gsi.id", gsiId);
      if (fullName) localStorage.setItem("gsi.full_name", fullName);
    } catch {}

    // Retrieve INFOR LN OAuth2 token based on active ionapi_oauth2 row
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
    // Optionally store the token locally
    try {
      localStorage.setItem("ln.token", JSON.stringify(tokenData.token));
    } catch {
      // ignore storage errors
    }
    // Go to the Menu screen
    navigate("/menu");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 pb-12">
      <div className="relative w-full max-w-md flex flex-col items-center">
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