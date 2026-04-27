import { useEffect, useMemo, useState } from "react";
import LoginForm from "@/components/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HelpMenu from "@/components/HelpMenu";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { normalizeGsiPermissions, setStoredGsiPermissions } from "@/lib/gsi-permissions";
import { clearStoredGsiAuth, hasStoredGsiIdentity, storeGsiIdentity } from "@/lib/gsi-auth-storage";
import { clearStoredGsiSession, hasValidGsiSession, setStoredGsiSession } from "@/lib/gsi-session";

const Index = () => {
  const [lang, setLang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("app.lang") as LanguageKey | null;
    return saved || "en";
  });

  const trans = useMemo(() => t(lang), [lang]);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("app.lang", lang);
  }, [lang]);

  useEffect(() => {
    if (hasStoredGsiIdentity() && hasValidGsiSession()) {
      navigate("/menu", { replace: true });
      return;
    }

    clearStoredGsiAuth();
  }, [navigate]);

  const invokeWithTimeout = async <T,>(
    functionName: string,
    body: Record<string, unknown>,
    timeoutMs = 15000,
    headers?: Record<string, string>,
  ): Promise<T> => {
    return await Promise.race([
      supabase.functions.invoke(functionName, { body, headers }) as Promise<T>,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  };

  const handleLogin = async ({ username, password, transportscreen, kittingscreen }: { username: string; password: string; transportscreen?: boolean; kittingscreen?: boolean }) => {

    if (!username || !password) {
      showError(trans.emptyFields);
      return;
    }

    clearStoredGsiAuth();

    const id = showLoading(trans.signingIn);
    let loginResult: { data: any; error: any };

    try {
      loginResult = await invokeWithTimeout<{ data: any; error: any }>("verify-gsi-login", { username, password });
    } catch (error) {
      dismissToast(id as unknown as string);
      showError(error instanceof Error && error.message === "timeout" ? "Login verification timed out" : trans.invalidCredentials);
      return;
    }

    const { data, error } = loginResult;
    dismissToast(id as unknown as string);

    if (error || !data || !data.ok || !data.session?.token || !data.session?.expires_at) {
      clearStoredGsiAuth();
      showError(trans.invalidCredentials);
      return;
    }

    const gsiId = data.user?.id as string | undefined;
    const fullName = data.user?.full_name as string | undefined;
    const userUsername = data.user?.username as string | undefined;
    const loginUsername = userUsername || username.trim();
    const sessionToken = String(data.session.token);
    const sessionHeaders = { Authorization: `Bearer ${sessionToken}` };

    storeGsiIdentity({
      gsiId,
      fullName,
      username: userUsername,
      loginUsername,
    });
    setStoredGsiSession(sessionToken, String(data.session.expires_at));
    setStoredGsiPermissions(normalizeGsiPermissions(data.user));

    showSuccess(trans.signedIn);

    const tid = showLoading(trans.retrievingToken);
    let tokenResult: { data: any; error: any };
    try {
      tokenResult = await invokeWithTimeout<{ data: any; error: any }>("ln-get-token", {}, 15000, sessionHeaders);
    } catch (error) {
      dismissToast(tid as unknown as string);
      clearStoredGsiAuth();
      showError(error instanceof Error && error.message === "timeout" ? "Token request timed out" : trans.tokenFailed);
      return;
    }

    const { data: tokenData, error: tokenErr } = tokenResult;
    dismissToast(tid as unknown as string);
    if (tokenErr || !tokenData || !tokenData.ok) {
      clearStoredGsiAuth();
      showError(trans.tokenFailed);
      return;
    }

    showSuccess(trans.tokenReceived);

    try {
      localStorage.setItem("transport.count", "0");
    } catch {}

    try {
      const permissionsResult = await invokeWithTimeout<{ data: any; error: any }>("gsi-get-user-permissions", {}, 8000, sessionHeaders);
      if (permissionsResult?.data?.ok) {
        setStoredGsiPermissions(permissionsResult.data.permissions);
      }
    } catch {}

    void (async () => {
      try {
        const { data: vehicleData } = await supabase.functions.invoke("gsi-get-vehicle-id", {
          body: { gsi_id: gsiId, username: loginUsername },
          headers: sessionHeaders,
        });
        const vehicleId = typeof vehicleData?.vehicleId === "string" ? vehicleData.vehicleId.trim() : "";
        if (!vehicleData?.ok || !vehicleId) return;
        localStorage.setItem("vehicle.id", vehicleId);
        localStorage.setItem("transports.vehicle.id", vehicleId);
      } catch {}
    })();

    if (!hasStoredGsiIdentity() || !hasValidGsiSession()) {
      clearStoredGsiSession();
      clearStoredGsiAuth();
      showError(trans.invalidCredentials);
      return;
    }

    if (kittingscreen) {
      navigate("/kitting/select");
    } else if (transportscreen) {
      navigate("/transport/select");
    } else {
      navigate("/menu");
    }

  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 pb-12">
      <div className="fixed top-3 right-3 z-50">
        <HelpMenu topic="login" colorMode="light" lang={lang} />
      </div>
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