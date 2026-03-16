export type LanguageKey = "en" | "de" | "es-MX" | "pt-BR";

export const LANGUAGES = [
  { key: "en", label: "English", short: "EN", flag: "US" },
  { key: "de", label: "Deutsch", short: "DE", flag: "DE" },
  { key: "es-MX", label: "Español (MX)", short: "MX", flag: "MX" },
  { key: "pt-BR", label: "Português (BR)", short: "BR", flag: "BR" },
] as const;

type TranslationKeys =
  | "title"
  | "username"
  | "password"
  | "signIn"
  | "language"
  | "changeLanguage"
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
  | "outgoingPicking"
  | "outgoingRelease"
  | "outgoingShipment"
  | "outgoingLoading"
  | "outgoingPersonalPicking"
  | "incomingGoodsReceipt"
  | "incomingWarehouseInspection"
  | "incomingPutawaySuggestions"
  | "incomingDeliveryNotice"
  | "incomingOrderTypeLabel"
  | "incomingOrderTypePurchase"
  | "incomingOrderNumberLabel"
  | "incomingOrderPositionLabel"
  | "incomingDeliveryNoteLabel"
  | "incomingConfirmAndPost"
  | "incomingConfirm"
  | "incomingReceive"
  | "receivedLines"
  | "confirmAll"
  | "startInspection"
  | "startInspectionTitle"
  | "startInspectionMessage"
  | "correctionSubmit"
  | "correctionReasonLabel"
  | "correctionSelectReason"
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
  | "huNotFoundGeneric"
  | "itemLabel"
  | "locationFromLabel"
  | "locationToLabel"
  | "warehouseLabel"
  | "transportIdLabel"
  | "huAlreadyLoaded"
  | "plannedDateLabel"
  | "transportTypeLabel"
  | "transportScreen"
  | "planningGroupTransport"
  | "selectLabel"
  | "loadAction"
  | "unloadAction"
  | "quantityLabel"
  | "fromLabel"
  | "toLabel"
  | "loadingEntries"
  | "executingMovement"
  | "updatingTransportOrder"
  | "unloadedSuccessfully"
  | "loadedSuccessfully"
  | "loadingList"
  | "pleaseWait"
  | "loadingDetails"
  | "noEntries"
  | "showAllTransports"
  | "locationLabel"
  | "searchLabel"
  | "onHandLabel"
  | "allocatedLabel"
  | "availableLabel"
  | "businessPartnerLotLabel"
  | "incomingLinesLabel"
  | "unitLabel"
  | "itemDescriptionLabel"
  | "itemOrHandlingUnit"
  | "targetWarehouseLabel"
  | "targetLocationLabel"
  | "statusLabel"
  | "lotLabel"
  | "blockedLabel"
  | "blockedFullyLabel"
  | "blockedOutboundLabel"
  | "blockedTransferIssueLabel"
  | "blockedCycleCountingLabel"
  | "blockedAssemblyLabel"
  | "receivedSuccessfully"
  | "inspectionQueryLabel"
  | "helpLabel"
  | "propertiesLabel"
  | "orderLabel"
  | "inspectionLabel"
  | "approvedQuantityLabel"
  | "rejectedQuantityLabel"
  | "rejectReasonLabel"
  | "submitLabel"
  | "selectInspectionTitle"
  | "searchReasonPlaceholder"
  | "noReasonsLabel";

type Translations = Record<LanguageKey, Record<TranslationKeys, string>>;

const translations: Translations = {
  en: {
    title: "Sign in",
    username: "User",
    password: "Password",
    signIn: "Sign In",
    language: "Language",
    changeLanguage: "Change language",
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
    outgoingPicking: "Picking",
    outgoingRelease: "Release",
    outgoingShipment: "Shipment",
    outgoingLoading: "Loading",
    outgoingPersonalPicking: "Personal Picking",
    incomingGoodsReceipt: "Goods Receipt",
    incomingWarehouseInspection: "Inspection",
    incomingPutawaySuggestions: "Putaway",
    incomingDeliveryNotice: "Delivery Notice",
    incomingOrderTypeLabel: "Order type",
    incomingOrderTypePurchase: "Purchase",
    incomingOrderNumberLabel: "Order number",
    incomingOrderPositionLabel: "Line",
    incomingDeliveryNoteLabel: "Delivery note",
    incomingConfirmAndPost: "Confirm & Post",
    incomingConfirm: "Confirm",
    incomingReceive: "Receive",
    receivedLines: "Received Lines",
    confirmAll: "Confirm All",
    startInspection: "Start Inspection",
    startInspectionTitle: "Start Inspection",
    startInspectionMessage: "Start Inspection for this Handling Unit?",
    correctionSubmit: "Correct",
    correctionReasonLabel: "Reason",
    correctionSelectReason: "Select reason",
    infoStockArticle: "Item",
    infoStockLEInfo: "HU-Info",
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
    huNotFound: "Handling Unit / Item not found in any transport order.",
    huNotFoundGeneric: "Handling Unit not found",
    itemLabel: "Item",
    locationFromLabel: "Location From",
    locationToLabel: "Location To",
    warehouseLabel: "Warehouse",
    transportIdLabel: "Transport-ID",
    huAlreadyLoaded: "Handling Unit already loaded.",
    plannedDateLabel: "Planned Date",
    transportTypeLabel: "Transport Type",
    transportScreen: "Transportscreen",
    planningGroupTransport: "Planning Group Transport",
    selectLabel: "Select",
    loadAction: "Load",
    unloadAction: "Unload",
    quantityLabel: "Quantity",
    fromLabel: "From",
    toLabel: "To",
    loadingEntries: "Loading entries…",
    executingMovement: "Executing movement…",
    updatingTransportOrder: "Updating transport order…",
    unloadedSuccessfully: "Unloaded successfully",
    loadedSuccessfully: "Loaded onto vehicle successfully",
    loadingList: "Loading list…",
    pleaseWait: "Please wait…",
    loadingDetails: "Loading details…",
    noEntries: "No entries",
    showAllTransports: "SHOW ALL TRANSPORTS",
    locationLabel: "Location",
    searchLabel: "Search",
    onHandLabel: "On hand",
    allocatedLabel: "Allocated",
    availableLabel: "Available",
    businessPartnerLotLabel: "Business Partner - Lot",
    incomingLinesLabel: "Lines",
    unitLabel: "Unit",
    itemDescriptionLabel: "Item description",
    itemOrHandlingUnit: "Item / Handling Unit",
    targetWarehouseLabel: "Target Warehouse",
    targetLocationLabel: "Target Location",
    statusLabel: "Status",
    lotLabel: "Lot",
    blockedLabel: "Blocked",
    blockedFullyLabel: "Fully",
    blockedOutboundLabel: "For Outbound",
    blockedTransferIssueLabel: "For Transfer Issue",
    blockedCycleCountingLabel: "For Cycle Counting",
    blockedAssemblyLabel: "For Assembly",
    receivedSuccessfully: "Received successfully...",
    inspectionQueryLabel: "Order Number / Inspection / Handling Unit",
    helpLabel: "Help",
    propertiesLabel: "Properties",
    orderLabel: "Order",
    inspectionLabel: "Inspection",
    approvedQuantityLabel: "Approved Quantity",
    rejectedQuantityLabel: "Rejected Quantity",
    rejectReasonLabel: "Reject Reason",
    submitLabel: "SUBMIT",
    selectInspectionTitle: "Select an inspection",
    searchReasonPlaceholder: "Search reason...",
    noReasonsLabel: "No reasons",
  },
  de: {
    title: "Anmelden",
    username: "Benutzer",
    password: "Passwort",
    signIn: "Anmelden",
    language: "Sprache",
    changeLanguage: "Sprache wechseln",
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
    outgoingPicking: "Kommissionierung",
    outgoingRelease: "Freigeben",
    outgoingShipment: "Sendung",
    outgoingLoading: "Verladen",
    outgoingPersonalPicking: "Pers. Komm.",
    incomingGoodsReceipt: "Wareneingang",
    incomingWarehouseInspection: "Lagerprüfung",
    incomingPutawaySuggestions: "Einlagerung",
    incomingDeliveryNotice: "Lieferavis",
    incomingOrderTypeLabel: "Auftragstyp",
    incomingOrderTypePurchase: "Einkauf",
    incomingOrderNumberLabel: "Auftragsnummer",
    incomingOrderPositionLabel: "Position",
    incomingDeliveryNoteLabel: "Lieferschein",
    incomingConfirmAndPost: "Bestätigen & Buchen",
    incomingConfirm: "Bestätigen",
    incomingReceive: "Eingegangen",
    receivedLines: "Eingegangene Pos.",
    confirmAll: "Alle bestätigen",
    startInspection: "Prüfung starten",
    startInspectionTitle: "Prüfung starten",
    startInspectionMessage: "Prüfung für diese Ladeeinheit starten?",
    correctionSubmit: "Korrigieren",
    correctionReasonLabel: "Grund",
    correctionSelectReason: "Grund wählen",
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
    huNotFoundGeneric: "Ladeeinheit nicht gefunden",
    itemLabel: "Artikel",
    locationFromLabel: "Ort Von",
    locationToLabel: "Ort Nach",
    warehouseLabel: "Lager",
    transportIdLabel: "Transport-ID",
    huAlreadyLoaded: "Ladeeinheit bereits geladen.",
    plannedDateLabel: "Geplantes Datum",
    transportTypeLabel: "Transportart",
    transportScreen: "Transport-Übersicht",
    planningGroupTransport: "Planungsgruppe Transport",
    selectLabel: "Auswählen",
    loadAction: "LADEN",
    unloadAction: "ENTLADEN",
    quantityLabel: "Menge",
    fromLabel: "Von",
    toLabel: "Nach",
    loadingEntries: "Einträge werden geladen…",
    executingMovement: "Bewegung wird ausgeführt…",
    updatingTransportOrder: "Transportauftrag wird aktualisiert…",
    unloadedSuccessfully: "Erfolgreich entladen",
    loadedSuccessfully: "Erfolgreich auf Fahrzeug geladen",
    loadingList: "Liste wird geladen…",
    pleaseWait: "Bitte warten…",
    loadingDetails: "Details werden geladen…",
    noEntries: "Keine Einträge",
    showAllTransports: "ALLE TRANSPORTE ANZEIGEN",
    locationLabel: "Lagerplatz",
    searchLabel: "Suchen",
    onHandLabel: "Vorhanden",
    allocatedLabel: "Zuge­teilt",
    availableLabel: "Verfügbar",
    businessPartnerLotLabel: "Handelspartner - Charge",
    incomingLinesLabel: "Positionen",
    unitLabel: "Einheit",
    itemDescriptionLabel: "Artikelbeschreibung",
    itemOrHandlingUnit: "Artikel / Ladeeinheit",
    targetWarehouseLabel: "Ziel-Lager",
    targetLocationLabel: "Ziel-Lagerplatz",
    statusLabel: "Status",
    lotLabel: "Charge",
    blockedLabel: "Gesperrt",
    blockedFullyLabel: "Vollständig",
    blockedOutboundLabel: "Für Auslagerung",
    blockedTransferIssueLabel: "Für Umlagerung (Entnahme)",
    blockedCycleCountingLabel: "Für Inventur",
    blockedAssemblyLabel: "Für Zusammenstellung",
    receivedSuccessfully: "Erfolgreich empfangen...",
    inspectionQueryLabel: "Auftragsnummer / Prüfung / Ladeeinheit",
    helpLabel: "Hilfe",
    propertiesLabel: "Eigenschaften",
    orderLabel: "Auftrag",
    inspectionLabel: "Prüfung",
    approvedQuantityLabel: "Genehmigte Menge",
    rejectedQuantityLabel: "Abgelehnte Menge",
    rejectReasonLabel: "Ablehnungsgrund",
    submitLabel: "SENDEN",
    selectInspectionTitle: "Prüfung auswählen",
    searchReasonPlaceholder: "Grund suchen...",
    noReasonsLabel: "Keine Gründe",
  },
  "es-MX": {
    title: "Iniciar sesión",
    username: "Usuario",
    password: "Contraseña",
    signIn: "Entrar",
    language: "Idioma",
    changeLanguage: "Cambiar idioma",
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
    outgoingPicking: "Preparación",
    outgoingRelease: "Liberar",
    outgoingShipment: "Envío",
    outgoingLoading: "Carga",
    outgoingPersonalPicking: "Prep. personal",
    incomingGoodsReceipt: "Recepción de mercancías",
    incomingWarehouseInspection: "Inspección",
    incomingPutawaySuggestions: "Almacenaje",
    incomingDeliveryNotice: "Aviso de entrega",
    incomingOrderTypeLabel: "Tipo de orden",
    incomingOrderTypePurchase: "Compra",
    incomingOrderNumberLabel: "Número de orden",
    incomingOrderPositionLabel: "Posición de orden",
    incomingDeliveryNoteLabel: "Albarán",
    incomingConfirmAndPost: "Confirmar y contabilizar",
    incomingConfirm: "Confirmar",
    incomingReceive: "Recibir",
    receivedLines: "Líneas recibidas",
    confirmAll: "Confirmar todo",
    startInspection: "Iniciar inspección",
    startInspectionTitle: "Iniciar inspección",
    startInspectionMessage: "¿Iniciar inspección para esta unidad de manejo?",
    correctionSubmit: "Corregir",
    correctionReasonLabel: "Motivo",
    correctionSelectReason: "Seleccionar motivo",
    infoStockArticle: "Artículo",
    infoStockLEInfo: "HU - Info",
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
    huNotFoundGeneric: "Unidad de manejo no encontrada",
    itemLabel: "Artículo",
    locationFromLabel: "Ubicación desde",
    locationToLabel: "Ubicación hasta",
    warehouseLabel: "Almacén",
    transportIdLabel: "ID de transporte",
    huAlreadyLoaded: "Unidad de manejo ya cargada.",
    plannedDateLabel: "Fecha planificada",
    transportTypeLabel: "Tipo de transporte",
    transportScreen: "Pantalla de transporte",
    planningGroupTransport: "Grupo de planificación de transporte",
    selectLabel: "Seleccionar",
    loadAction: "Cargar",
    unloadAction: "Descargar",
    quantityLabel: "Cantidad",
    fromLabel: "Desde",
    toLabel: "Hasta",
    loadingEntries: "Cargando entradas…",
    executingMovement: "Ejecutando movimiento…",
    updatingTransportOrder: "Actualizando orden de transporte…",
    unloadedSuccessfully: "Descarga realizada",
    loadedSuccessfully: "Cargado al vehículo correctamente",
    loadingList: "Cargando lista…",
    pleaseWait: "Por favor espere…",
    loadingDetails: "Cargando detalles…",
    noEntries: "Sin registros",
    showAllTransports: "MOSTRAR TODOS LOS TRANSPORTES",
    locationLabel: "Ubicación",
    searchLabel: "Buscar",
    onHandLabel: "Existencia",
    allocatedLabel: "Asignado",
    availableLabel: "Disponible",
    businessPartnerLotLabel: "Lote del socio comercial",
    incomingLinesLabel: "Líneas",
    unitLabel: "Unidad",
    itemDescriptionLabel: "Descripción del artículo",
    itemOrHandlingUnit: "Artículo / Unidad de manejo",
    targetWarehouseLabel: "Almacén destino",
    targetLocationLabel: "Ubicación destino",
    statusLabel: "Estado",
    lotLabel: "Lote",
    blockedLabel: "Bloqueado",
    blockedFullyLabel: "Totalmente",
    blockedOutboundLabel: "Para salida",
    blockedTransferIssueLabel: "Para traslado (emisión)",
    blockedCycleCountingLabel: "Para conteo cíclico",
    blockedAssemblyLabel: "Para ensamblaje",
    receivedSuccessfully: "Recibido correctamente...",
    inspectionQueryLabel: "Número de orden / Inspección / Unidad de manejo",
    helpLabel: "Ayuda",
    propertiesLabel: "Propiedades",
    orderLabel: "Orden",
    inspectionLabel: "Inspección",
    approvedQuantityLabel: "Cantidad aprobada",
    rejectedQuantityLabel: "Cantidad rechazada",
    rejectReasonLabel: "Motivo de rechazo",
    submitLabel: "ENVIAR",
    selectInspectionTitle: "Seleccionar inspección",
    searchReasonPlaceholder: "Buscar motivo...",
    noReasonsLabel: "Sin motivos",
  },
  "pt-BR": {
    title: "Entrar",
    username: "Usuário",
    password: "Senha",
    signIn: "Entrar",
    language: "Idioma",
    changeLanguage: "Mudar idioma",
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
    outgoingPicking: "Separação",
    outgoingRelease: "Liberar",
    outgoingShipment: "Remessa",
    outgoingLoading: "Carregamento",
    outgoingPersonalPicking: "Separação pessoal",
    incomingGoodsReceipt: "Recebimento",
    incomingWarehouseInspection: "Inspeção",
    incomingPutawaySuggestions: "Endereçamento",
    incomingDeliveryNotice: "Aviso de entrega",
    incomingOrderTypeLabel: "Tipo de ordem",
    incomingOrderTypePurchase: "Compra",
    incomingOrderNumberLabel: "Número do pedido",
    incomingOrderPositionLabel: "Posição do pedido",
    incomingDeliveryNoteLabel: "Nota de entrega",
    incomingConfirmAndPost: "Confirmar e lançar",
    incomingConfirm: "Confirmar",
    incomingReceive: "Receber",
    receivedLines: "Linhas recebidas",
    confirmAll: "Confirmar tudo",
    startInspection: "Iniciar inspeção",
    startInspectionTitle: "Iniciar inspeção",
    startInspectionMessage: "Iniciar inspeção para esta unidade de manuseio?",
    correctionSubmit: "Corrigir",
    correctionReasonLabel: "Motivo",
    correctionSelectReason: "Selecionar motivo",
    infoStockArticle: "Artigo",
    infoStockLEInfo: "HU - Info",
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
    huNotFoundGeneric: "Unidade de manuseio não encontrada",
    itemLabel: "Item",
    locationFromLabel: "Local de origem",
    locationToLabel: "Local de destino",
    warehouseLabel: "Armazém",
    transportIdLabel: "ID de transporte",
    huAlreadyLoaded: "Unidade de manuseio já carregada.",
    plannedDateLabel: "Data planejada",
    transportTypeLabel: "Tipo de transporte",
    transportScreen: "Tela de transporte",
    planningGroupTransport: "Grupo de planejamento de transporte",
    selectLabel: "Selecionar",
    loadAction: "Carregar",
    unloadAction: "Descarregar",
    quantityLabel: "Quantidade",
    fromLabel: "De",
    toLabel: "Para",
    loadingEntries: "Carregando registros…",
    executingMovement: "Executando movimentação…",
    updatingTransportOrder: "Atualizando ordem de transporte…",
    unloadedSuccessfully: "Descarregado com sucesso",
    loadedSuccessfully: "Carregado no veículo com sucesso",
    loadingList: "Carregando lista…",
    pleaseWait: "Por favor, aguarde…",
    loadingDetails: "Carregando detalhes…",
    noEntries: "Sem entradas",
    showAllTransports: "MOSTRAR TODOS OS TRANSPORTES",
    locationLabel: "Local",
    searchLabel: "Buscar",
    onHandLabel: "Em estoque",
    allocatedLabel: "Alocado",
    availableLabel: "Disponível",
    businessPartnerLotLabel: "Lote do parceiro comercial",
    incomingLinesLabel: "Linhas",
    unitLabel: "Unidade",
    itemDescriptionLabel: "Descrição do item",
    itemOrHandlingUnit: "Artigo / Unidade de manuseio",
    targetWarehouseLabel: "Armazém destino",
    targetLocationLabel: "Local de destino",
    statusLabel: "Status",
    lotLabel: "Lote",
    blockedLabel: "Bloqueado",
    blockedFullyLabel: "Total",
    blockedOutboundLabel: "Para expedição",
    blockedTransferIssueLabel: "Para transferência (baixa)",
    blockedCycleCountingLabel: "Para contagem cíclica",
    blockedAssemblyLabel: "Para montagem",
    receivedSuccessfully: "Recebido com sucesso...",
    inspectionQueryLabel: "Número do pedido / Inspeção / Unidade de manuseio",
    helpLabel: "Ajuda",
    propertiesLabel: "Propriedades",
    orderLabel: "Pedido",
    inspectionLabel: "Inspeção",
    approvedQuantityLabel: "Quantidade aprovada",
    rejectedQuantityLabel: "Quantidade rejeitada",
    rejectReasonLabel: "Motivo da rejeição",
    submitLabel: "ENVIAR",
    selectInspectionTitle: "Selecionar inspeção",
    searchReasonPlaceholder: "Buscar motivo...",
    noReasonsLabel: "Sem motivos",
  },
};

export function t(lang: LanguageKey) {
  return translations[lang];
}