import { useEffect, useMemo, useState } from "react";
import LoginForm from "@/components/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";

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

  const handleLogin = ({ username, password }: { username: string; password: string }) => {
    if (!username || !password) {
      showError(trans.emptyFields);
      return;
    }
    const id = showLoading(trans.signingIn);
    // Simulate a short processing delay; replace with real auth later
    setTimeout(() => {
      dismissToast(id as unknown as string);
      showSuccess(trans.signedIn);
    }, 800);
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