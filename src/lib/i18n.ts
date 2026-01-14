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
  | "appSettings"
  | "back"
  | "infoStockArticle"
  | "infoStockLEInfo"
  | "infoStockCorrection"
  | "infoStockTransfer"
  | "infoStockInventoryPos"
  | "infoStockInventory"
  | "infoStockPersonalInventory"
  | "transportLoad"
  | "transportUnload"
  | "loadHandlingUnit"
  | "loadVehicleId"
  | "checkingHandlingUnit"
  | "huNotFound"
  | "itemLabel"
  | "locationFromLabel"
  | "locationToLabel"
  | "warehouseLabel"
  | "transportIdLabel"
  | "huAlreadyLoaded"
  | "plannedDateLabel"
  | "transportScreen"
  | "planningGroupTransport"
  | "selectLabel"
  | "loadAction"
  | "unloadAction"
  | "quantityLabel"
  | "fromLabel"
  | "toLabel";

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
    back: "Back",
    infoStockArticle: "Article",
    infoStockLEInfo: "LE Info",
    infoStockCorrection: "Correction",
    infoStockTransfer: "Transfer",
    infoStockInventoryPos: "Inventory (Pos.)",
    infoStockInventory: "Inventory",
    infoStockPersonalInventory: "Personal Inventory",
    transportLoad: "Load",
    transportUnload: "Unload",
    loadHandlingUnit: "Handling Unit",
    loadVehicleId: "Vehicle ID",
    checkingHandlingUnit: "Checking handling unit…",
    huNotFound: "Handling Unit not found in any Transport Order.",
    itemLabel: "Item",
    locationFromLabel: "Location From",
    locationToLabel: "Location To",
    warehouseLabel: "Warehouse",
    transportIdLabel: "Transport-ID",
    huAlreadyLoaded: "Handling Unit already loaded.",
    plannedDateLabel: "Planned Date",
    transportScreen: "Transportscreen",
    planningGroupTransport: "Planning Group Transport",
    selectLabel: "Select",
    loadAction: "Load",
    unloadAction: "Unload",
    quantityLabel: "Quantity",
    fromLabel: "From",
    toLabel: "To",
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
    back: "Zurück",
    infoStockArticle: "Artikel",
    infoStockLEInfo: "LE-Info",
    infoStockCorrection: "Korrektur",
    infoStockTransfer: "Transfer",
    infoStockInventoryPos: "Inventur (Pos.)",
    infoStockInventory: "Inventur",
    infoStockPersonalInventory: "Pers. Inventur",
    transportLoad: "Laden",
    transportUnload: "Entladen",
    loadHandlingUnit: "Ladeeinheit",
    loadVehicleId: "Fahrzeug ID",
    checkingHandlingUnit: "Ladeeinheit wird geprüft…",
    huNotFound: "Ladeeinheit in keinem Transportauftrag gefunden.",
    itemLabel: "Artikel",
    locationFromLabel: "Ort Von",
    locationToLabel: "Ort Nach",
    warehouseLabel: "Lager",
    transportIdLabel: "Transport-ID",
    huAlreadyLoaded: "Ladeeinheit bereits geladen.",
    plannedDateLabel: "Geplantes Datum",
    transportScreen: "Transport-Übersicht",
    planningGroupTransport: "Planungsgruppe Transport",
    selectLabel: "Auswählen",
    loadAction: "LADEN",
    unloadAction: "ENTLADEN",
    quantityLabel: "Menge",
    fromLabel: "Von",
    toLabel: "Nach",
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
    back: "Atrás",
    infoStockArticle: "Artículo",
    infoStockLEInfo: "Info LE",
    infoStockCorrection: "Corrección",
    infoStockTransfer: "Transferencia",
    infoStockInventoryPos: "Inventario (Pos.)",
    infoStockInventory: "Inventario",
    infoStockPersonalInventory: "Inventario personal",
    transportLoad: "Cargar",
    transportUnload: "Descargar",
    loadHandlingUnit: "Unidad de manejo",
    loadVehicleId: "ID del vehículo",
    checkingHandlingUnit: "Verificando unidad de manejo…",
    huNotFound: "Unidad de manejo no encontrada en ninguna orden de transporte.",
    itemLabel: "Artículo",
    locationFromLabel: "Ubicación desde",
    locationToLabel: "Ubicación hasta",
    warehouseLabel: "Almacén",
    transportIdLabel: "ID de transporte",
    huAlreadyLoaded: "Unidad de manejo ya cargada.",
    plannedDateLabel: "Fecha planificada",
    transportScreen: "Pantalla de transporte",
    planningGroupTransport: "Grupo de planificación de transporte",
    selectLabel: "Seleccionar",
    loadAction: "Cargar",
    unloadAction: "Descargar",
    quantityLabel: "Cantidad",
    fromLabel: "Desde",
    toLabel: "Hasta",
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
    back: "Voltar",
    infoStockArticle: "Artigo",
    infoStockLEInfo: "Info LE",
    infoStockCorrection: "Correção",
    infoStockTransfer: "Transferência",
    infoStockInventoryPos: "Inventário (Pos.)",
    infoStockInventory: "Inventário",
    infoStockPersonalInventory: "Inventário pessoal",
    transportLoad: "Carregar",
    transportUnload: "Descarregar",
    loadHandlingUnit: "Unidade de manuseio",
    loadVehicleId: "ID do veículo",
    checkingHandlingUnit: "Verificando unidade de manuseio…",
    huNotFound: "Unidade de manuseio não encontrada em nenhuma ordem de transporte.",
    itemLabel: "Item",
    locationFromLabel: "Local de origem",
    locationToLabel: "Local de destino",
    warehouseLabel: "Armazém",
    transportIdLabel: "ID de transporte",
    huAlreadyLoaded: "Unidade de manuseio já carregada.",
    plannedDateLabel: "Data planejada",
    transportScreen: "Tela de transporte",
    planningGroupTransport: "Grupo de planejamento de transporte",
    selectLabel: "Selecionar",
    loadAction: "Carregar",
    unloadAction: "Descarregar",
    quantityLabel: "Quantidade",
    fromLabel: "De",
    toLabel: "Para",
  },
};

export function t(lang: LanguageKey) {
  return translations[lang];
}