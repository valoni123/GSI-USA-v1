import { useEffect, useMemo, useState } from "react";
import LoginForm from "@/components/LoginForm";
import PageDocumentation, { type DocContent } from "@/components/PageDocumentation";
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

  // Localized documentation content for the Login page
  const docs = useMemo(() => {
    const map = {
      en: {
        userTitle: "User Manual - Login",
        techTitle: "Technical Documentation - Login",
        userSections: [
          {
            title: "Purpose",
            body: "Use this screen to sign in with your warehouse user credentials and obtain an LN access token for subsequent operations.",
          },
          {
            title: "Fields",
            bullets: [
              `${trans.username}: Enter your warehouse user code. When you focus the password field, your full name is shown if available.`,
              `${trans.password}: Enter your password.`,
              `${trans.transportScreen}: When checked, you go directly to Transport selection after signing in; otherwise, you go to the main menu.`,
            ],
          },
          {
            title: "Language",
            body: "Use the language selector below the card to switch the interface language.",
          },
          {
            title: "Sign In",
            bullets: [
              "Press the Sign In button; if credentials are valid, you'll see success messages and be redirected.",
              "If fields are empty or credentials invalid, a toast explains what to fix.",
            ],
          },
          {
            title: "Troubleshooting",
            bullets: [
              "Empty fields: Fill in both user and password.",
              "Invalid credentials: Verify your code and password; contact support if the issue persists.",
              "Token error: If token retrieval fails, try again; if repeated, contact support.",
            ],
          },
        ],
        techSections: [
          {
            title: "Authentication Flow",
            bullets: [
              "Calls Edge Function verify-gsi-login with username and password.",
              "verify_gsi_user RPC validates credentials (bcrypt hash via trigger).",
              "On success, localStorage caches gsi.id, gsi.full_name, gsi.username, gsi.employee, gsi.login.",
            ],
          },
          {
            title: "Token Retrieval",
            bullets: [
              "Calls Edge Function ln-get-token to obtain an OAuth2 token for Infor LN.",
              "Stores token at ln.token in localStorage and resets transport.count to 0.",
            ],
          },
          {
            title: "Navigation",
            bullets: [
              "If Transport overview is checked → navigate to /transport/select.",
              "Otherwise → navigate to /menu.",
            ],
          },
          {
            title: "UI and Components",
            bullets: [
              "LoginForm renders inputs (FloatingLabelInput), checkbox (shadcn/ui), and submit Button.",
              "LanguageSwitcher sets app.lang and updates document language.",
              "Toasts show progress and results using the app's toast utilities.",
            ],
          },
          {
            title: "Errors",
            bullets: [
              "Empty fields: blocked with toast.",
              "Invalid credentials or token failures: toast and stay on page.",
            ],
          },
        ],
        footer: "Generated by the application at runtime. For internal use.",
      },
      de: {
        userTitle: "Benutzerhandbuch - Login",
        techTitle: "Technische Dokumentation - Login",
        userSections: [
          {
            title: "Zweck",
            body: "Mit diesem Bildschirm melden Sie sich mit Ihrem Lager-Benutzer an und erhalten ein LN-Zugriffstoken für weitere Vorgänge.",
          },
          {
            title: "Felder",
            bullets: [
              `${trans.username}: Geben Sie Ihren Lager-Benutzercode ein. Beim Fokus auf das Passwort-Feld wird Ihr vollständiger Name angezeigt (falls verfügbar).`,
              `${trans.password}: Geben Sie Ihr Passwort ein.`,
              `${trans.transportScreen}: Wenn aktiviert, gelangen Sie nach dem Login direkt zur Transport-Übersicht; sonst zum Hauptmenü.`,
            ],
          },
          {
            title: "Sprache",
            body: "Unten am Kartenrand können Sie die Sprache der Benutzeroberfläche wechseln.",
          },
          {
            title: "Anmelden",
            bullets: [
              "Klicken Sie auf Anmelden; bei gültigen Daten erhalten Sie Erfolgsmeldungen und werden weitergeleitet.",
              "Sind Felder leer oder Daten ungültig, zeigt ein Hinweis an, was zu korrigieren ist.",
            ],
          },
          {
            title: "Fehlerbehebung",
            bullets: [
              "Leere Felder: Benutzer und Passwort ausfüllen.",
              "Ungültige Daten: Benutzercode und Passwort prüfen; Support kontaktieren, falls das Problem bleibt.",
              "Token-Fehler: Erneut versuchen; bei wiederholtem Auftreten Support informieren.",
            ],
          },
        ],
        techSections: [
          {
            title: "Authentifizierungsablauf",
            bullets: [
              "Edge Function verify-gsi-login mit Benutzername und Passwort.",
              "RPC verify_gsi_user prüft die Daten (bcrypt-Hash via Trigger).",
              "Bei Erfolg werden gsi.id, gsi.full_name, gsi.username, gsi.employee, gsi.login in localStorage gespeichert.",
            ],
          },
          {
            title: "Token-Abruf",
            bullets: [
              "Edge Function ln-get-token holt ein OAuth2-Token für Infor LN.",
              "Speicherung von ln.token in localStorage und Rücksetzen von transport.count auf 0.",
            ],
          },
          {
            title: "Navigation",
            bullets: [
              "Wenn Transport-Übersicht aktiv → Navigation zu /transport/select.",
              "Sonst → Navigation zu /menu.",
            ],
          },
          {
            title: "UI und Komponenten",
            bullets: [
              "LoginForm rendert Eingaben (FloatingLabelInput), Checkbox (shadcn/ui) und Button.",
              "LanguageSwitcher setzt app.lang und aktualisiert die Dokumentensprache.",
              "Hinweise/Toasts zeigen Fortschritt und Ergebnisse an.",
            ],
          },
          {
            title: "Fehler",
            bullets: [
              "Leere Felder: Blockiert mit Hinweis.",
              "Ungültige Anmeldedaten oder Token-Fehler: Hinweis und Verbleib auf der Seite.",
            ],
          },
        ],
        footer: "Laufzeitgeneriert durch die Anwendung. Nur für den internen Gebrauch.",
      },
      "es-MX": {
        userTitle: "Manual de Usuario - Inicio de sesión",
        techTitle: "Documentación Técnica - Inicio de sesión",
        userSections: [
          { title: "Propósito", body: "Use esta pantalla para iniciar sesión con sus credenciales y obtener un token de acceso LN." },
          {
            title: "Campos",
            bullets: [
              `${trans.username}: Ingrese su código de usuario; al enfocar la contraseña se muestra su nombre completo si existe.`,
              `${trans.password}: Ingrese su contraseña.`,
              `${trans.transportScreen}: Si está marcado, irá directamente a la selección de Transporte; de lo contrario, al menú principal.`,
            ],
          },
          { title: "Idioma", body: "Cambie el idioma desde el selector ubicado debajo de la tarjeta." },
          {
            title: "Iniciar sesión",
            bullets: [
              "Presione Entrar; si es válido, verá mensajes de éxito y la redirección.",
              "Con campos vacíos o datos inválidos, aparece un aviso (toast).",
            ],
          },
          {
            title: "Solución de problemas",
            bullets: [
              "Campos vacíos: Complete usuario y contraseña.",
              "Datos inválidos: Verifique su código y contraseña.",
              "Error de token: Intente nuevamente; si persiste, contacte soporte.",
            ],
          },
        ],
        techSections: [
          { title: "Flujo de autenticación", bullets: ["verify-gsi-login valida credenciales vía RPC verify_gsi_user.", "Datos guardados en localStorage: gsi.id, gsi.full_name, gsi.username, gsi.employee, gsi.login."] },
          { title: "Obtención de token", bullets: ["ln-get-token obtiene el token OAuth2 de LN.", "Se guarda en ln.token; transport.count se reinicia a 0."] },
          { title: "Navegación", bullets: ["Con pantalla de transporte → /transport/select.", "De lo contrario → /menu."] },
          { title: "UI y componentes", bullets: ["LoginForm (FloatingLabelInput, Checkbox, Button).", "LanguageSwitcher cambia idioma.", "Toasts informan progreso."] },
          { title: "Errores", bullets: ["Campos vacíos, credenciales inválidas, token fallido → toast y permanecer en la página."] },
        ],
        footer: "Generado por la aplicación. Uso interno.",
      },
      "pt-BR": {
        userTitle: "Manual do Usuário - Login",
        techTitle: "Documentação Técnica - Login",
        userSections: [
          { title: "Objetivo", body: "Use esta tela para entrar com suas credenciais e obter o token de acesso LN." },
          {
            title: "Campos",
            bullets: [
              `${trans.username}: Informe seu código; ao focar a senha, o nome completo aparece se disponível.`,
              `${trans.password}: Informe sua senha.`,
              `${trans.transportScreen}: Marcado → vai direto para seleção de Transporte; caso contrário, para o menu principal.`,
            ],
          },
          { title: "Idioma", body: "Use o seletor abaixo do cartão para trocar o idioma." },
          {
            title: "Entrar",
            bullets: [
              "Clique em Entrar; com dados válidos, verá mensagens de sucesso e será redirecionado.",
              "Campos vazios ou dados inválidos geram um aviso (toast).",
            ],
          },
          {
            title: "Solução de problemas",
            bullets: [
              "Campos vazios: preencha usuário e senha.",
              "Dados inválidos: verifique seu código e senha.",
              "Erro de token: tente novamente; se persistir, contate o suporte.",
            ],
          },
        ],
        techSections: [
          { title: "Fluxo de autenticação", bullets: ["verify-gsi-login valida via RPC verify_gsi_user.", "Armazena gsi.id, gsi.full_name, gsi.username, gsi.employee, gsi.login no localStorage."] },
          { title: "Obtenção de token", bullets: ["ln-get-token obtém o token OAuth2 do LN.", "Salva em ln.token; transport.count é zerado."] },
          { title: "Navegação", bullets: ["Com tela de transporte → /transport/select.", "Caso contrário → /menu."] },
          { title: "UI e componentes", bullets: ["LoginForm (FloatingLabelInput, Checkbox, Button).", "LanguageSwitcher altera idioma.", "Toasts mostram progresso."] },
          { title: "Erros", bullets: ["Campos vazios, credenciais inválidas, token falho → toast e permanece na página."] },
        ],
        footer: "Gerado pela aplicação. Uso interno.",
      },
    } as const;

    const m = map[lang];
    const userManual: DocContent = {
      title: m.userTitle,
      sections: m.userSections,
      footerNote: m.footer,
      filename: `User_Manual_Login_${lang}`,
    };
    const technicalDoc: DocContent = {
      title: m.techTitle,
      sections: m.techSections,
      footerNote: m.footer,
      filename: `Technical_Doc_Login_${lang}`,
    };
    return { userManual, technicalDoc };
  }, [lang, trans]);

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
        {/* Documentation Download (visible below the card, aligned right) */}
        <div className="w-full flex justify-end mt-8 pr-1">
          <PageDocumentation userManual={docs.userManual} technicalDoc={docs.technicalDoc} compact />
        </div>
      </div>
    </div>
  );
};

export default Index;