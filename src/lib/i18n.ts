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
  | "cancel"
  | "signedOut"
  | "appIncoming"
  | "appOutgoing"
  | "appInfoStock"
  | "appContainers"
  | "appTransport"
  | "appTransports"
  | "appKittingDocs"
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
  | "leInfoMove"
  | "leInfoPrintLabel"
  | "handlingUnitStockLabel"
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
  | "huOrItemLabel"
  | "loadedUpperLabel"
  | "loadVehicleId"
  | "remarkLabel"
  | "detailsLabel"
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
  | "adjustAction"
  | "adjustQuestion"
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
  | "orderSetLabel"
  | "scanOrderSetPlaceholder"
  | "invalidOrderSet"
  | "kittingLoading"
  | "kittingNoOrderLines"
  | "kittingMainItemLabel"
  | "kittingBomLineLabel"
  | "kittingComponentLabel"
  | "kittingQtyPerMainItemLabel"
  | "orderedLabel"
  | "originallyOrderedLabel"
  | "noComponentsLabel"
  | "kittingInspectionLabel"
  | "kittingLastRevisionLabel"
  | "kittingTotalPartsLabel"
  | "kittingDrawingTitle"
  | "kittingOpenDrawingLabel"
  | "kittingNoDrawingFound"
  | "kittingDrawingLoadFailed"
  | "kittingDrawingOnFileLabel"
  | "kittingCommentsInstructionsLabel"
  | "kittingDrawingFileNameLabel"
  | "kittingPrintLabel"
  | "kittingPrintedYesLabel"
  | "kittingPrintAllDocumentsLabel"
  | "kittingNoDocumentsAvailableLabel"
  | "approvedQuantityLabel"
  | "rejectedQuantityLabel"
  | "rejectReasonLabel"
  | "submitLabel"
  | "selectInspectionTitle"
  | "searchReasonPlaceholder"
  | "noReasonsLabel"
  | "runLabel"
  | "orderOriginLabel"
  | "setLabel"
  | "lineLabel"
  | "sequenceLabel"
  | "advisedQuantityLabel"
  | "pickedLabel"
  | "pickingSelectAdviceTitle"
  | "pickingNoAdvices"
  | "pickingTimeout";

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
    cancel: "Cancel",
    signedOut: "Signed out",
    appIncoming: "Incoming",
    appOutgoing: "Outgoing",
    appInfoStock: "Info / Stock",
    appContainers: "Containers",
    appTransport: "Transport",
    appTransports: "Transports",
    appKittingDocs: "Kitting-Docs.",
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
    correctionSubmit: "Adjust",
    correctionReasonLabel: "Reason",
    correctionSelectReason: "Select reason",

    leInfoMove: "Move",
    leInfoPrintLabel: "Print Label",
    handlingUnitStockLabel: "HU Stock",
    infoStockArticle: "Item",
    infoStockLEInfo: "HU-Info",
    infoStockCorrection: "Adjustment",
    infoStockTransfer: "Transfer",

    infoStockInventoryPos: "Inventory (Pos.)",
    infoStockInventory: "Inventory",
    infoStockPersonalInventory: "Personal Inventory",
    transportLoad: "Load",
    transportUnload: "Unload",
    loadHandlingUnit: "Handling Unit",
    huOrItemLabel: "HU / Item",
    loadedUpperLabel: "LOADED",
    loadVehicleId: "Vehicle ID",
    remarkLabel: "Remark",
    detailsLabel: "Details",
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
    adjustAction: "Adjust",
    adjustQuestion: "Do you really want to adjust?",
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
    orderSetLabel: "Order / Set",
    scanOrderSetPlaceholder: "Scan Order / Set",
    invalidOrderSet: "Invalid Order / Set format. Use e.g. 100001640/1",
    kittingLoading: "Loading kitting documents…",
    kittingNoOrderLines: "No order lines found for this Order / Set.",
    kittingMainItemLabel: "List Components for Assembly",
    kittingBomLineLabel: "BOM Line",
    kittingComponentLabel: "Component",
    kittingQtyPerMainItemLabel: "Quantity per Main Item",
    orderedLabel: "Ordered",
    originallyOrderedLabel: "Originally Ordered",
    noComponentsLabel: "No components",
    kittingInspectionLabel: "Inspection",
    kittingLastRevisionLabel: "Last Revision",
    kittingTotalPartsLabel: "Total # of Parts",
    kittingDrawingTitle: "Drawing",
    kittingOpenDrawingLabel: "Open in new tab",
    kittingNoDrawingFound: "No drawing found for this item.",
    kittingDrawingLoadFailed: "Failed to load drawing.",
    kittingDrawingOnFileLabel: "Drawing on File",
    kittingCommentsInstructionsLabel: "Comments/Instructions",
    kittingDrawingFileNameLabel: "Drawing File Name",
    kittingPrintLabel: "Print",
    kittingPrintedYesLabel: "Printed",
    kittingPrintAllDocumentsLabel: "Print All Docs.",
    kittingNoDocumentsAvailableLabel: "No documents available for this line.",
    approvedQuantityLabel: "Approved Quantity",
    rejectedQuantityLabel: "Rejected Quantity",
    rejectReasonLabel: "Reject Reason",
    submitLabel: "SUBMIT",
    selectInspectionTitle: "Select an inspection",
    searchReasonPlaceholder: "Search reason...",
    noReasonsLabel: "No reasons",
    runLabel: "Run",
    orderOriginLabel: "Order Origin",
    setLabel: "Set",
    lineLabel: "Line",
    sequenceLabel: "Sequence",
    advisedQuantityLabel: "Advised Quantity",
    pickedLabel: "Picked",
    pickingSelectAdviceTitle: "Select Picking Advice",
    pickingNoAdvices: "No released outbound advices found for this run.",
    pickingTimeout: "Picking request timed out",
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
    cancel: "Abbrechen",
    signedOut: "Abgemeldet",
    appIncoming: "Eingang",
    appOutgoing: "Ausgang",
    appInfoStock: "Info / Bestand",
    appContainers: "Behälter",
    appTransport: "Transport",
    appTransports: "Transporte",
    appKittingDocs: "Kitting-Dok.",
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
    leInfoMove: "Umlagern",
    leInfoPrintLabel: "Etikett",
    handlingUnitStockLabel: "LE Stock",
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
    huOrItemLabel: "LE / Artikel",
    loadedUpperLabel: "GELADEN",
    loadVehicleId: "Fahrzeug ID",
    remarkLabel: "Bemerkung",
    detailsLabel: "Details",
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
    adjustAction: "Anpassen",
    adjustQuestion: "Möchten Sie wirklich anpassen?",
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
    orderSetLabel: "Auftrag / Satz",
    scanOrderSetPlaceholder: "Auftrag / Satz scannen",
    invalidOrderSet: "Ungültiges Auftrag / Satz-Format. Z. B. 100001640/1",
    kittingLoading: "Kitting-Dokumente werden geladen…",
    kittingNoOrderLines: "Keine Auftragspositionen für diesen Auftrag / Satz gefunden.",
    kittingMainItemLabel: "Komponenten für Montage",
    kittingBomLineLabel: "Stücklistenpos.",
    kittingComponentLabel: "Komponente",
    kittingQtyPerMainItemLabel: "Menge pro Hauptartikel",
    orderedLabel: "Bestellt",
    originallyOrderedLabel: "Ursprünglich bestellt",
    noComponentsLabel: "Keine Komponenten",
    kittingInspectionLabel: "Prüfung",
    kittingLastRevisionLabel: "Letzte Revision",
    kittingTotalPartsLabel: "Gesamtanzahl Teile",
    kittingDrawingTitle: "Zeichnung",
    kittingOpenDrawingLabel: "In neuem Tab öffnen",
    kittingNoDrawingFound: "Keine Zeichnung für diesen Artikel gefunden.",
    kittingDrawingLoadFailed: "Zeichnung konnte nicht geladen werden.",
    kittingDrawingOnFileLabel: "Zeichnung vorhanden",
    kittingCommentsInstructionsLabel: "Kommentare/Anweisungen",
    kittingDrawingFileNameLabel: "Zeichnungsdateiname",
    kittingPrintLabel: "Drucken",
    kittingPrintedYesLabel: "Gedruckt",
    kittingPrintAllDocumentsLabel: "Alle Dok. drucken",
    kittingNoDocumentsAvailableLabel: "Für diese Zeile sind keine Dokumente verfügbar.",
    approvedQuantityLabel: "Genehmigte Menge",
    rejectedQuantityLabel: "Abgelehnte Menge",
    rejectReasonLabel: "Ablehnungsgrund",
    submitLabel: "SENDEN",
    selectInspectionTitle: "Prüfung auswählen",
    searchReasonPlaceholder: "Grund suchen...",
    noReasonsLabel: "Keine Gründe",
    runLabel: "Lauf",
    orderOriginLabel: "Auftragsherkunft",
    setLabel: "Satz",
    lineLabel: "Position",
    sequenceLabel: "Folge",
    advisedQuantityLabel: "Avisierte Menge",
    pickedLabel: "Gepickt",
    pickingSelectAdviceTitle: "Kommissionierauftrag auswählen",
    pickingNoAdvices: "Keine freigegebenen Auslagerungspositionen für diesen Lauf gefunden.",
    pickingTimeout: "Kommissionierabfrage hat Zeitüberschreitung",
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
    cancel: "Cancelar",
    signedOut: "Sesión cerrada",
    appIncoming: "Entrada",
    appOutgoing: "Salida",
    appInfoStock: "Info / Inventario",
    appContainers: "Contenedores",
    appTransport: "Transporte",
    appTransports: "Transportes",
    appKittingDocs: "Docs. de kitting",
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
    leInfoMove: "Trasladar",
    leInfoPrintLabel: "Imprimir etiqueta",
    handlingUnitStockLabel: "Stock HU",
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
    huOrItemLabel: "UH / Artículo",
    loadedUpperLabel: "CARGADOS",
    loadVehicleId: "ID del vehículo",
    remarkLabel: "Observación",
    detailsLabel: "Detalles",
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
    adjustAction: "Ajustar",
    adjustQuestion: "¿Realmente desea ajustar?",
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
    orderSetLabel: "Orden / Conjunto",
    scanOrderSetPlaceholder: "Escanear orden / conjunto",
    invalidOrderSet: "Formato de orden / conjunto inválido. Use p. ej. 100001640/1",
    kittingLoading: "Cargando documentos de kitting…",
    kittingNoOrderLines: "No se encontraron líneas para esta orden / conjunto.",
    kittingMainItemLabel: "Componentes para ensamblaje",
    kittingBomLineLabel: "Línea BOM",
    kittingComponentLabel: "Componente",
    kittingQtyPerMainItemLabel: "Cantidad por artículo principal",
    orderedLabel: "Pedido",
    originallyOrderedLabel: "Pedido original",
    noComponentsLabel: "Sin componentes",
    kittingInspectionLabel: "Inspección",
    kittingLastRevisionLabel: "Última revisión",
    kittingTotalPartsLabel: "Total de piezas",
    kittingDrawingTitle: "Plano",
    kittingOpenDrawingLabel: "Abrir en nueva pestaña",
    kittingNoDrawingFound: "No se encontró plano para este artículo.",
    kittingDrawingLoadFailed: "No se pudo cargar el plano.",
    kittingDrawingOnFileLabel: "Plano en archivo",
    kittingCommentsInstructionsLabel: "Comentarios/Instrucciones",
    kittingDrawingFileNameLabel: "Nombre del archivo del plano",
    kittingPrintLabel: "Imprimir",
    kittingPrintedYesLabel: "Impreso",
    kittingPrintAllDocumentsLabel: "Impr. todos docs.",
    kittingNoDocumentsAvailableLabel: "No hay documentos disponibles para esta línea.",
    approvedQuantityLabel: "Cantidad aprobada",
    rejectedQuantityLabel: "Cantidad rechazada",
    rejectReasonLabel: "Motivo de rechazo",
    submitLabel: "ENVIAR",
    selectInspectionTitle: "Seleccionar inspección",
    searchReasonPlaceholder: "Buscar motivo...",
    noReasonsLabel: "Sin motivos",
    runLabel: "Ejecución",
    orderOriginLabel: "Origen de orden",
    setLabel: "Conjunto",
    lineLabel: "Línea",
    sequenceLabel: "Secuencia",
    advisedQuantityLabel: "Cantidad aconsejada",
    pickedLabel: "Surtido",
    pickingSelectAdviceTitle: "Seleccionar consejo de surtido",
    pickingNoAdvices: "No se encontraron avisos de salida liberados para esta ejecución.",
    pickingTimeout: "La consulta de surtido agotó el tiempo",
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
    cancel: "Cancelar",
    signedOut: "Sessão encerrada",
    appIncoming: "Entrada",
    appOutgoing: "Saída",
    appInfoStock: "Info / Estoque",
    appContainers: "Contêineres",
    appTransport: "Transporte",
    appTransports: "Transportes",
    appKittingDocs: "Docs. de kitting",
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
    leInfoMove: "Transferir",
    leInfoPrintLabel: "Imprimir etiqueta",
    handlingUnitStockLabel: "Estoque HU",
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
    huOrItemLabel: "UM / Item",
    loadedUpperLabel: "CARREGADOS",
    loadVehicleId: "ID do veículo",
    remarkLabel: "Observação",
    detailsLabel: "Detalhes",
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
    adjustAction: "Ajustar",
    adjustQuestion: "Deseja realmente ajustar?",
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
    orderSetLabel: "Ordem / Conjunto",
    scanOrderSetPlaceholder: "Escanear ordem / conjunto",
    invalidOrderSet: "Formato de ordem / conjunto inválido. Use por ex. 100001640/1",
    kittingLoading: "Carregando documentos de kitting…",
    kittingNoOrderLines: "Nenhuma linha encontrada para esta ordem / conjunto.",
    kittingMainItemLabel: "Componentes para montagem",
    kittingBomLineLabel: "Linha BOM",
    kittingComponentLabel: "Componente",
    kittingQtyPerMainItemLabel: "Quantidade por item principal",
    orderedLabel: "Pedido",
    originallyOrderedLabel: "Originalmente pedido",
    noComponentsLabel: "Sem componentes",
    kittingInspectionLabel: "Inspeção",
    kittingLastRevisionLabel: "Última revisão",
    kittingTotalPartsLabel: "Total de peças",
    kittingDrawingTitle: "Desenho",
    kittingOpenDrawingLabel: "Abrir em nova aba",
    kittingNoDrawingFound: "Nenhum desenho encontrado para este item.",
    kittingDrawingLoadFailed: "Falha ao carregar o desenho.",
    kittingDrawingOnFileLabel: "Desenho em arquivo",
    kittingCommentsInstructionsLabel: "Comentários/Instruções",
    kittingDrawingFileNameLabel: "Nome do arquivo do desenho",
    kittingPrintLabel: "Imprimir",
    kittingPrintedYesLabel: "Impresso",
    kittingPrintAllDocumentsLabel: "Impr. todos docs.",
    kittingNoDocumentsAvailableLabel: "Não há documentos disponíveis para esta linha.",
    approvedQuantityLabel: "Quantidade aprovada",
    rejectedQuantityLabel: "Quantidade rejeitada",
    rejectReasonLabel: "Motivo da rejeição",
    submitLabel: "ENVIAR",
    selectInspectionTitle: "Selecionar inspeção",
    searchReasonPlaceholder: "Buscar motivo...",
    noReasonsLabel: "Sem motivos",
    runLabel: "Execução",
    orderOriginLabel: "Origem do pedido",
    setLabel: "Conjunto",
    lineLabel: "Linha",
    sequenceLabel: "Sequência",
    advisedQuantityLabel: "Quantidade avisada",
    pickedLabel: "Separado",
    pickingSelectAdviceTitle: "Selecionar conselho de separação",
    pickingNoAdvices: "Nenhum aviso de saída liberado encontrado para esta execução.",
    pickingTimeout: "A consulta de separação expirou",
  },
};

export function t(lang: LanguageKey) {
  return translations[lang];
}