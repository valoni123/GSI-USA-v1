import { useEffect, useMemo, useState } from "react";
import LoginForm from "@/components/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HelpMenu from "@/components/HelpMenu";
import { type LanguageKey, t } from "@/lib/i18n";
import { dismissToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { normalizeGsiPermissions, setStoredGsiPermissions } from "@/lib/gsi-permissions";

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

  const invokeWithTimeout = async <T,>(
    functionName: string,
    body: Record<string, unknown>,
    timeoutMs = 15000,
  ): Promise<T> => {
    return await Promise.race([
      supabase.functions.invoke(functionName, { body }) as Promise<T>,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  };

  const handleLogin = async ({ username, password, transportscreen }: { username: string; password: string; transportscreen?: boolean }) => {
    if (!username || !password) {
      showError(trans.emptyFields);
      return;
    }
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
    if (error || !data || !data.ok) {
      showError(trans.invalidCredentials);
      return;
    }
    showSuccess(trans.signedIn);
    const gsiId = data.user?.id as string | undefined;
    const fullName = data.user?.full_name as string | undefined;
    const userUsername = data.user?.username as string | undefined;
    const initialPermissions = normalizeGsiPermissions(data.user);
    let effectivePermissions = initialPermissions;
    const loginUsername = (userUsername || "").trim();
    if (!loginUsername) {
      showError("Missing GSI username.");
      return;
    }
    try {
      if (gsiId) localStorage.setItem("gsi.id", gsiId);
      if (fullName) localStorage.setItem("gsi.full_name", fullName);
      localStorage.setItem("gsi.username", (userUsername || loginUsername).trim());
      localStorage.setItem("gsi.employee", loginUsername);
      localStorage.setItem("gsi.login", loginUsername);
      localStorage.removeItem("vehicle.id");
      localStorage.removeItem("transports.vehicle.id");
      setStoredGsiPermissions(initialPermissions);
    } catch {}

    const tid = showLoading(trans.retrievingToken);
    let tokenResult: { data: any; error: any };
    try {
      tokenResult = await invokeWithTimeout<{ data: any; error: any }>("ln-get-token", { gsi_id: gsiId });
    } catch (error) {
      dismissToast(tid as unknown as string);
      showError(error instanceof Error && error.message === "timeout" ? "Token request timed out" : trans.tokenFailed);
      return;
    }
    const { data: tokenData, error: tokenErr } = tokenResult;
    dismissToast(tid as unknown as string);
    if (tokenErr || !tokenData || !tokenData.ok) {
      showError(trans.tokenFailed);
      return;
    }
    showSuccess(trans.tokenReceived);
    try {
      localStorage.setItem("ln.token", JSON.stringify(tokenData.token));
      localStorage.setItem("transport.count", "0");
    } catch {}

    try {
      const permissionsResult = await invokeWithTimeout<{ data: any; error: any }>("gsi-get-user-permissions", {
        gsi_id: gsiId,
        username: loginUsername,
      }, 8000);
      if (permissionsResult?.data?.ok) {
        effectivePermissions = normalizeGsiPermissions(permissionsResult.data.permissions);
        setStoredGsiPermissions(effectivePermissions);
      }
    } catch {}

    void (async () => {
      try {
        const { data: vehicleData } = await supabase.functions.invoke("gsi-get-vehicle-id", {
          body: { gsi_id: gsiId, username: loginUsername },
        });
        const vehicleId = typeof vehicleData?.vehicleId === "string" ? vehicleData.vehicleId.trim() : "";
        if (!vehicleData?.ok || !vehicleId) {
          localStorage.removeItem("vehicle.id");
          localStorage.removeItem("transports.vehicle.id");
          return;
        }
        localStorage.setItem("vehicle.id", vehicleId);
        localStorage.setItem("transports.vehicle.id", vehicleId);
      } catch {}
    })();

    if (transportscreen && effectivePermissions.admin) {
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