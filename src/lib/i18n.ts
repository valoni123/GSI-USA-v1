export type LanguageKey = "en" | "de" | "es-MX" | "pt-BR";

export const LANGUAGES = [
  { key: "en", label: "English", short: "EN", flag: "🇺🇸" },
  { key: "de", label: "Deutsch", short: "DE", flag: "🇩🇪" },
  { key: "es-MX", label: "Español (MX)", short: "MX", flag: "🇲🇽" },
  { key: "pt-BR", label: "Português (BR)", short: "BR", flag: "🇧🇷" },
] as const;

type TranslationKeys =
  | "title"
  | "username"
  | "password"
  | "signIn"
  | "language"
  | "signingIn"
  | "signedIn"
  | "emptyFields"
  | "invalidCredentials"
  | "retrievingToken"
  | "tokenReceived"
  | "tokenFailed"
  | "menu"
  | "signOut"
  | "signOutTitle"
  | "signOutQuestion"
  | "yes"
  | "no"
  | "signedOut"
  | "appIncoming"
  | "appOutgoing"
  | "appInfoStock"
  | "appContainers"
  | "appTransport"
  | "appSettings";

type Translations = Record<LanguageKey, Record<TranslationKeys, string>>;

const translations: Translations = {
  en: {
    title: "Sign in",
    username: "User",
    password: "Password",
    signIn: "Sign In",
    language: "Language",
    signingIn: "Signing in…",
    signedIn: "Signed in",
    emptyFields: "Please enter user and password.",
    invalidCredentials: "Invalid username or password.",
    retrievingToken: "Requesting access token…",
    tokenReceived: "Access token received.",
    tokenFailed: "Failed to retrieve access token.",
    menu: "MENU",
    signOut: "Sign out",
    signOutTitle: "Sign out",
    signOutQuestion: "Do you want to sign out?",
    yes: "Yes",
    no: "No",
    signedOut: "Signed out",
    appIncoming: "Incoming",
    appOutgoing: "Outgoing",
    appInfoStock: "Info / Stock",
    appContainers: "Containers",
    appTransport: "Transport",
    appSettings: "Settings",
  },
  de: {
    title: "Anmelden",
    username: "Benutzer",
    password: "Passwort",
    signIn: "Anmelden",
    language: "Sprache",
    signingIn: "Wird angemeldet…",
    signedIn: "Angemeldet",
    emptyFields: "Bitte Benutzer und Passwort eingeben.",
    invalidCredentials: "Ungültiger Benutzer oder Passwort.",
    retrievingToken: "Fordere Zugriffstoken an…",
    tokenReceived: "Zugriffstoken erhalten.",
    tokenFailed: "Zugriffstoken konnte nicht abgerufen werden.",
    menu: "MENÜ",
    signOut: "Abmelden",
    signOutTitle: "Abmeldung",
    signOutQuestion: "Möchten Sie sich wirklich abmelden?",
    yes: "Ja",
    no: "Nein",
    signedOut: "Abgemeldet",
    appIncoming: "Eingang",
    appOutgoing: "Ausgang",
    appInfoStock: "Info / Bestand",
    appContainers: "Behälter",
    appTransport: "Transport",
    appSettings: "Einstellungen",
  },
  "es-MX": {
    title: "Iniciar sesión",
    username: "Usuario",
    password: "Contraseña",
    signIn: "Entrar",
    language: "Idioma",
    signingIn: "Iniciando sesión…",
    signedIn: "Sesión iniciada",
    emptyFields: "Ingrese usuario y contraseña.",
    invalidCredentials: "Usuario o contraseña inválidos.",
    retrievingToken: "Solicitando token de acceso…",
    tokenReceived: "Token de acceso recibido.",
    tokenFailed: "No se pudo obtener el token de acceso.",
    menu: "MENÚ",
    signOut: "Cerrar sesión",
    signOutTitle: "Cerrar sesión",
    signOutQuestion: "¿Desea cerrar sesión?",
    yes: "Sí",
    no: "No",
    signedOut: "Sesión cerrada",
    appIncoming: "Entrada",
    appOutgoing: "Salida",
    appInfoStock: "Info / Inventario",
    appContainers: "Contenedores",
    appTransport: "Transporte",
    appSettings: "Configuración",
  },
  "pt-BR": {
    title: "Entrar",
    username: "Usuário",
    password: "Senha",
    signIn: "Entrar",
    language: "Idioma",
    signingIn: "Entrando…",
    signedIn: "Conectado",
    emptyFields: "Informe usuário e senha.",
    invalidCredentials: "Usuário ou senha inválidos.",
    retrievingToken: "Solicitando token de acesso…",
    tokenReceived: "Token de acesso recebido.",
    tokenFailed: "Falha ao obter token de acesso.",
    menu: "MENU",
    signOut: "Sair",
    signOutTitle: "Sair",
    signOutQuestion: "Deseja sair?",
    yes: "Sim",
    no: "Não",
    signedOut: "Desconectado",
    appIncoming: "Entrada",
    appOutgoing: "Saída",
    appInfoStock: "Info / Estoque",
    appContainers: "Contêineres",
    appTransport: "Transporte",
    appSettings: "Configurações",
  },
};

export function t(lang: LanguageKey) {
  return translations[lang];
}