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
  | "invalidCredentials";

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
  },
};

export function t(lang: LanguageKey) {
  return translations[lang];
}