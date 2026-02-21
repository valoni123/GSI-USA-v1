"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { LanguageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LogIn, ArrowBigLeft, ArrowBigRight, Info, Box, ArrowLeftRight, Warehouse, Package, Home, Search as SearchIcon, FileDown } from "lucide-react";

type TopicKey = "login" | "transport-load" | "transport-unload" | "hu-info" | "info-item" | "info-transfer";

const topics: TopicKey[] = ["login", "transport-load", "transport-unload", "hu-info", "info-item", "info-transfer"];

function normalizeTopic(v: string | null): TopicKey {
  const s = (v || "").toLowerCase();
  if (s === "transport-load") return "transport-load";
  if (s === "transport-unload") return "transport-unload";
  if (s === "hu-info" || s === "le-info" || s === "huinfo") return "hu-info";
  if (s === "info-item" || s === "item") return "info-item";
  if (s === "info-transfer" || s === "transfer") return "info-transfer";
  return "login";
}

function labelForTopic(topic: TopicKey, lang: LanguageKey) {
  const trans = t(lang);
  switch (topic) {
    case "login":
      return lang === "de" ? "Anmeldung" : lang === "es-MX" ? "Inicio de sesión" : lang === "pt-BR" ? "Login" : "Login";
    case "transport-load":
      return `${trans.appTransport} — ${trans.transportLoad}`;
    case "transport-unload":
      return `${trans.appTransport} — ${trans.transportUnload}`;
    case "hu-info":
      return trans.infoStockLEInfo;
    case "info-item":
      return trans.infoStockArticle;
    case "info-transfer":
      return trans.infoStockTransfer;
  }
}

function topicIconEl(key: TopicKey, className: string) {
  switch (key) {
    case "login": return <LogIn className={className} />;
    case "transport-load": return <ArrowBigLeft className={className} />;
    case "transport-unload": return <ArrowBigRight className={className} />;
    case "hu-info": return <Info className={className} />;
    case "info-item": return <Box className={className} />;
    case "info-transfer": return <ArrowLeftRight className={className} />;
    default: return null;
  }
}

function DocsContent({ topic, lang }: { topic: TopicKey; lang: LanguageKey }) {
  const trans = t(lang);
  const title = labelForTopic(topic, lang);
  const Section = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
      <div className="text-sm text-gray-800 leading-relaxed">{children}</div>
    </div>
  );
  const topicIcon = (key: TopicKey) => topicIconEl(key, "h-5 w-5 text-[#1d4a85]");

  if (topic === "login") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">{topicIcon(topic)} {title}</h2>
        <Section heading={lang === "de" ? "Übersicht" : lang === "es-MX" ? "Visión general" : lang === "pt-BR" ? "Visão geral" : "Overview"}>
          <p>
            {lang === "de"
              ? "Diese Seite dient zur Anmeldung am System und zur Initialisierung der INFOR LN-Verbindung."
              : lang === "es-MX"
              ? "Esta página sirve para iniciar sesión en el sistema e inicializar la conexión con INFOR LN."
              : lang === "pt-BR"
              ? "Esta página é usada para entrar no sistema e inicializar a conexão com o INFOR LN."
              : "This page is used to sign into the system and initialize the INFOR LN connection."}
          </p>
        </Section>

        <Section heading={lang === "de" ? "Feldverhalten" : lang === "es-MX" ? "Comportamiento de campos" : lang === "pt-BR" ? "Comportamento dos campos" : "Field behavior"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>{trans.username}</strong> — {lang === "de"
                ? "Beim Fokus in das Passwortfeld wird der Backend-Service gsi-get-user-name mit dem Benutzernamen aufgerufen, um den Klartext-Namen anzuzeigen."
                : lang === "es-MX"
                ? "Al enfocar el campo de contraseña se llama al servicio gsi-get-user-name con el usuario para mostrar el nombre."
                : lang === "pt-BR"
                ? "Ao focar o campo de senha o serviço gsi-get-user-name é chamado com o usuário para exibir o nome."
                : "On focusing the password field, the backend service gsi-get-user-name is called with the username to display the user's full name."}
            </li>
            <li>
              <strong>{trans.password}</strong> — {lang === "de"
                ? "Beim Klick auf Anmelden wird verify-gsi-login aufgerufen; Passwort wird nicht gespeichert."
                : lang === "es-MX"
                ? "Al pulsar Entrar se invoca verify-gsi-login; la contraseña no se guarda."
                : lang === "pt-BR"
                ? "Ao clicar em Entrar, verify-gsi-login é chamado; a senha não é armazenada."
                : "On Sign In, verify-gsi-login is invoked; the password is not stored."}
            </li>
            <li>
              <strong>{trans.transportScreen}</strong> — {lang === "de"
                ? "Steuert die Zielseite nach der Anmeldung (Transport-Auswahl oder Hauptmenü)."
                : lang === "es-MX"
                ? "Controla la página destino tras iniciar sesión (selección de transporte o menú principal)."
                : lang === "pt-BR"
                ? "Controla a página destino após o login (seleção de transporte ou menu principal)."
                : "Controls the destination after sign-in (transport selection or main menu)."}
            </li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Backend-Ablauf" : lang === "es-MX" ? "Flujo backend" : lang === "pt-BR" ? "Fluxo de backend" : "Backend flow"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {lang === "de" ? "verify-gsi-login" : lang === "es-MX" ? "verify-gsi-login" : lang === "pt-BR" ? "verify-gsi-login" : "verify-gsi-login"} — {lang === "de"
                ? "Prüft Benutzer/Passwort und liefert Nutzer-ID, Benutzername, Vollname."
                : lang === "es-MX"
                ? "Valida usuario/contraseña y devuelve ID de usuario, usuario y nombre completo."
                : lang === "pt-BR"
                ? "Valida usuário/senha e retorna ID do usuário, usuário e nome completo."
                : "Validates user/password and returns user ID, username, full name."}
            </li>
            <li>
              {lang === "de" ? "ln-get-token" : lang === "es-MX" ? "ln-get-token" : lang === "pt-BR" ? "ln-get-token" : "ln-get-token"} — {lang === "de"
                ? "Fordert das INFOR LN OAuth2 Token basierend auf aktiver Konfiguration an und speichert es lokal."
                : lang === "es-MX"
                ? "Solicita el token OAuth2 de INFOR LN según la configuración activa y lo guarda localmente."
                : lang === "pt-BR"
                ? "Solicita o token OAuth2 do INFOR LN com base na configuração ativa e o armazena localmente."
                : "Requests the INFOR LN OAuth2 token based on the active configuration and stores it locally."}
            </li>
            <li>
              {lang === "de" ? "gsi-get-user-name" : lang === "es-MX" ? "gsi-get-user-name" : lang === "pt-BR" ? "gsi-get-user-name" : "gsi-get-user-name"} — {lang === "de"
                ? "Liefert den Klartext-Namen zum Benutzer (Anzeigezweck)."
                : lang === "es-MX"
                ? "Devuelve el nombre en claro del usuario (propósito visual)."
                : lang === "pt-BR"
                ? "Retorna o nome legível do usuário (propósito visual)."
                : "Returns the user's readable name (for display)."}
            </li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Persistenz & Sicherheit" : lang === "es-MX" ? "Persistencia y seguridad" : lang === "pt-BR" ? "Persistência e segurança" : "Persistence & security"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "Lokale Speicherung: gsi.id, gsi.full_name, gsi.username, ln.token;" : lang === "es-MX" ? "Almacenamiento local: gsi.id, gsi.full_name, gsi.username, ln.token;" : lang === "pt-BR" ? "Armazenamento local: gsi.id, gsi.full_name, gsi.username, ln.token;" : "Local storage: gsi.id, gsi.full_name, gsi.username, ln.token;"}</li>
            <li>{lang === "de" ? "Passwörter werden nie lokal abgelegt." : lang === "es-MX" ? "Las contraseñas nunca se guardan localmente." : lang === "pt-BR" ? "Senhas nunca são armazenadas localmente." : "Passwords are never stored locally."}</li>
            <li>{lang === "de" ? "RLS-Policies sind aktiv auf allen Tabellen (Sicherheit)." : lang === "es-MX" ? "Las políticas RLS están activas en todas las tablas (seguridad)." : lang === "pt-BR" ? "Políticas de RLS ativas em todas as tabelas (segurança)." : "RLS policies are active on all tables (security)."} </li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Fehlerbilder" : lang === "es-MX" ? "Escenarios de error" : lang === "pt-BR" ? "Cenários de erro" : "Error scenarios"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "Ungültige Zugangsdaten → Meldung 'Ungültiger Benutzer oder Passwort'." : lang === "es-MX" ? "Credenciales inválidas → mensaje 'Usuario o contraseña inválidos'." : lang === "pt-BR" ? "Credenciais inválidas → mensagem 'Usuário ou senha inválidos'." : "Invalid credentials → 'Invalid username or password'."}</li>
            <li>{lang === "de" ? "Token-Abruf fehlgeschlagen → Meldung 'Token konnte nicht abgerufen werden'." : lang === "es-MX" ? "Fallo al obtener token → 'No se pudo obtener el token de acceso'." : lang === "pt-BR" ? "Falha ao obter token → 'Falha ao obter token de acesso'." : "Token retrieval failed → 'Failed to retrieve access token'."}</li>
          </ul>
        </Section>
      </div>
    );
  }

  if (topic === "transport-load") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">{topicIcon(topic)} {title}</h2>

        <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
          <p>
            {lang === "de"
              ? "Ladevorgänge aus Transportaufträgen: Scannen Sie eine LE oder einen Artikel und laden Sie auf ein Fahrzeug."
              : lang === "es-MX"
              ? "Operaciones de carga desde órdenes de transporte: escanee una UH o un artículo y cargue a un vehículo."
              : lang === "pt-BR"
              ? "Operações de carregamento de ordens de transporte: leia uma UM ou item e carregue em um veículo."
              : "Loading operations from transport orders: scan a HU or item and load onto a vehicle."}
          </p>
        </Section>

        <Section heading={lang === "de" ? "Feldverhalten" : lang === "es-MX" ? "Comportamiento de campos" : lang === "pt-BR" ? "Comportamento dos campos" : "Field behavior"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "Handling Unit / Artikel: Auf Blur wird ln-transport-orders aufgerufen, um passende Position(en) zu holen." : lang === "es-MX" ? "UH / Artículo: En blur se invoca ln-transport-orders para obtener la(s) posición(es) coincidente(s)." : lang === "pt-BR" ? "UM / Item: No blur, ln-transport-orders é chamado para obter a(s) posição(ões) correspondente(s)." : "Handling Unit / Item: On blur, ln-transport-orders is called to fetch matching line(s)."} </li>
            <li>{lang === "de" ? "Mehrfache Treffer → Auswahl-Dialog; Einzeltreffer → Detailanzeige." : lang === "es-MX" ? "Múltiples coincidencias → diálogo de selección; única coincidencia → detalle." : lang === "pt-BR" ? "Múltiplas correspondências → diálogo de seleção; única correspondência → detalhe." : "Multiple matches → selection dialog; single match → details displayed."}</li>
            <li>{lang === "de" ? "Mit LE: ln-handling-unit-info bestimmt Menge/Einheit; Prüft, ob LE bereits geladen (ln-transport-loaded-check)." : lang === "es-MX" ? "Con UH: ln-handling-unit-info determina cantidad/unidad; verifica si ya está cargada (ln-transport-loaded-check)." : lang === "pt-BR" ? "Com UM: ln-handling-unit-info determina quantidade/unidade; verifica se já está carregada (ln-transport-loaded-check)." : "With HU: ln-handling-unit-info gets quantity/unit; checks if HU already loaded (ln-transport-loaded-check)."} </li>
            <li>{lang === "de" ? "Nur Artikel: erfordert Scan des 'Ort Von' zur Validierung; Fahrzeug-ID wird danach freigeschaltet." : lang === "es-MX" ? "Solo artículo: requiere escanear 'Ubicación desde' para validar; luego se habilita el ID de vehículo." : lang === "pt-BR" ? "Somente item: requer escanear 'Local de origem' para validar; em seguida habilita o ID do veículo." : "Item-only: requires scanning 'Location From' to validate; then enables Vehicle ID."}</li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Backend-Ablauf" : lang === "es-MX" ? "Flujo backend" : lang === "pt-BR" ? "Fluxo de backend" : "Backend flow"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "ln-transport-orders — ermittelt Transportposition(en) zur HU/Artikel." : lang === "es-MX" ? "ln-transport-orders — obtiene posición(es) de transporte por UH/Artículo." : lang === "pt-BR" ? "ln-transport-orders — obtém posição(ões) de transporte por UM/Item." : "ln-transport-orders — get transport line(s) for HU/Item."}</li>
            <li>{lang === "de" ? "ln-handling-unit-info — liefert Menge/Einheit und Status für die LE." : lang === "es-MX" ? "ln-handling-unit-info — devuelve cantidad/unidad y estado de la UH." : lang === "pt-BR" ? "ln-handling-unit-info — retorna quantidade/unidade e status da UM." : "ln-handling-unit-info — returns quantity/unit and status for the HU."}</li>
            <li>{lang === "de" ? "ln-transport-loaded-check — prüft, ob die LE schon auf dem Fahrzeug ist." : lang === "es-MX" ? "ln-transport-loaded-check — verifica si la UH ya está en el vehículo." : lang === "pt-BR" ? "ln-transport-loaded-check — verifica se a UM já está no veículo." : "ln-transport-loaded-check — checks if HU is already on the vehicle."}</li>
            <li>{lang === "de" ? "ln-move-to-location — führt den Ladevorgang aus (HU oder Artikel+Menge)." : lang === "es-MX" ? "ln-move-to-location — ejecuta la carga (UH o artículo+cantidad)." : lang === "pt-BR" ? "ln-move-to-location — executa o carregamento (UM ou item+quantidade)." : "ln-move-to-location — performs the load (HU or item+quantity)."} </li>
            <li>{lang === "de" ? "ln-update-transport-order — setzt VehicleID/LocationDevice auf den Auftrag." : lang === "es-MX" ? "ln-update-transport-order — establece VehicleID/LocationDevice en la orden." : lang === "pt-BR" ? "ln-update-transport-order — define VehicleID/LocationDevice na ordem." : "ln-update-transport-order — sets VehicleID/LocationDevice on the order."}</li>
            <li>{lang === "de" ? "ln-transport-count — aktualisiert den Ladezähler (Badge)." : lang === "es-MX" ? "ln-transport-count — actualiza el contador de carga (badge)." : lang === "pt-BR" ? "ln-transport-count — atualiza o contador de carregamento (badge)." : "ln-transport-count — updates the loaded count (badge)."} </li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Fehlerbilder" : lang === "es-MX" ? "Escenarios de error" : lang === "pt-BR" ? "Cenários de erro" : "Error scenarios"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "LE bereits geladen → Hinweisdialog; erneutes Laden blockiert." : lang === "es-MX" ? "UH ya cargada → diálogo de aviso; recarga bloqueada." : lang === "pt-BR" ? "UM já carregada → diálogo de aviso; novo carregamento bloqueado." : "HU already loaded → notice dialog; re-loading prevented."}</li>
            <li>{lang === "de" ? "Falscher 'Ort Von' im Artikelpfad → Validierungsfehler, erneuter Scan nötig." : lang === "es-MX" ? "Ubicación 'desde' incorrecta en ruta de artículo → error de validación, escaneo requerido." : lang === "pt-BR" ? "Local 'de' incorreto no fluxo de item → erro de validação, nova leitura necessária." : "Incorrect 'Location From' on item path → validation error, re-scan required."}</li>
          </ul>
        </Section>
      </div>
    );
  }

  if (topic === "transport-unload") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">{topicIcon(topic)} {title}</h2>

        <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
          <p>
            {lang === "de"
              ? "Entladen von LE/Artikeln am Zielplatz. Bei Artikel-Positionen ohne LE wird die OrderedQuantity genutzt."
              : lang === "es-MX"
              ? "Descargar UH/Artículos en el destino. En posiciones solo de artículo sin UH se usa OrderedQuantity."
              : lang === "pt-BR"
              ? "Descarregar UM/Itens no destino. Em posições apenas de item sem UM usa-se OrderedQuantity."
              : "Unload HU/Items to the destination. For item-only lines without HU, OrderedQuantity is used."}
          </p>
        </Section>

        <Section heading={lang === "de" ? "Datenquelle & Felder" : lang === "es-MX" ? "Fuente de datos y campos" : lang === "pt-BR" ? "Fonte de dados e campos" : "Data source & fields"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "ln-transport-list — liefert Liste der geladenen Positionen inkl. OrderedQuantity." : lang === "es-MX" ? "ln-transport-list — devuelve lista de posiciones cargadas incluyendo OrderedQuantity." : lang === "pt-BR" ? "ln-transport-list — retorna lista de posições carregadas incluindo OrderedQuantity." : "ln-transport-list — returns loaded lines including OrderedQuantity."}</li>
            <li>{lang === "de" ? "LE-Positionen: Menge/Einheit via ln-handling-unit-info." : lang === "es-MX" ? "Posiciones con UH: cantidad/unidad vía ln-handling-unit-info." : lang === "pt-BR" ? "Posições com UM: quantidade/unidade via ln-handling-unit-info." : "HU lines: quantity/unit via ln-handling-unit-info."}</li>
            <li>{lang === "de" ? "Artikel-Positionen: Anzeige und Verwendung von OrderedQuantity." : lang === "es-MX" ? "Posiciones de artículo: mostrar y usar OrderedQuantity." : lang === "pt-BR" ? "Posições de item: exibir e usar OrderedQuantity." : "Item-only lines: show and use OrderedQuantity."}</li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Bewegung & Patch" : lang === "es-MX" ? "Movimiento y patch" : lang === "pt-BR" ? "Movimentação e patch" : "Movement & patch"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "ln-move-to-location — LE: HandlingUnit wird gesendet; Artikel: Item (mit 9 führenden Leerzeichen) + Quantity." : lang === "es-MX" ? "ln-move-to-location — UH: se envía HandlingUnit; Artículo: Item (con 9 espacios iniciales) + Quantity." : lang === "pt-BR" ? "ln-move-to-location — UM: envia HandlingUnit; Item: Item (com 9 espaços à esquerda) + Quantity." : "ln-move-to-location — HU: send HandlingUnit; Item: Item (with 9 leading spaces) + Quantity."}</li>
            <li>{lang === "de" ? "ln-update-transport-order — setzt Completed='Yes', VehicleID leer und aktualisiert ETag." : lang === "es-MX" ? "ln-update-transport-order — establece Completed='Yes', VehicleID vacío y actualiza ETag." : lang === "pt-BR" ? "ln-update-transport-order — define Completed='Yes', VehicleID vazio e atualiza ETag." : "ln-update-transport-order — sets Completed='Yes', clears VehicleID, updates ETag."}</li>
            <li>{lang === "de" ? "ln-transport-count — nach Entladen zum Aktualisieren des Zählers." : lang === "es-MX" ? "ln-transport-count — tras descargar para actualizar el contador." : lang === "pt-BR" ? "ln-transport-count — após descarregar para atualizar o contador." : "ln-transport-count — after unload to refresh the count."}</li>
          </ul>
        </Section>

        <Section heading={lang === "de" ? "Fehlerbilder & Besonderheiten" : lang === "es-MX" ? "Escenarios de error y particularidades" : lang === "pt-BR" ? "Cenários de erro e particularidades" : "Errors & specifics"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{lang === "de" ? "Zeitliche Mengenfreigabe ('Quantity to issue') → automatischer erneuter Versuch bis zu 3x." : lang === "es-MX" ? "Disponibilidad temporal de cantidad ('Quantity to issue') → reintentos automáticos hasta 3 veces." : lang === "pt-BR" ? "Disponibilidade temporal de quantidade ('Quantity to issue') → novas tentativas automáticas até 3 vezes." : "Temporal quantity availability ('Quantity to issue') → auto-retries up to 3 times."}</li>
            <li>{lang === "de" ? "Artikel müssen exakt so gesendet werden wie geliefert (inkl. 9 Leerzeichen)." : lang === "es-MX" ? "Los artículos deben enviarse exactamente como se reciben (incl. 9 espacios)." : lang === "pt-BR" ? "Itens devem ser enviados exatamente como recebidos (incl. 9 espaços)." : "Items must be sent exactly as provided (including 9 leading spaces)."} </li>
          </ul>
        </Section>
      </div>
    );
  }

  if (topic === "info-item") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">{topicIcon(topic)} {title}</h2>
        <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
          <p>
            {lang === "de"
              ? "Bestandsübersicht je Artikel und Lager/Platz inkl. Mengen (Vorhanden, Zuge­teilt, Verfügbar)."
              : lang === "es-MX"
              ? "Vista de inventario por artículo y almacén/ubicación con cantidades (Existencia, Asignado, Disponible)."
              : lang === "pt-BR"
              ? "Visão de estoque por item e armazém/local com quantidades (Em estoque, Alocado, Disponível)."
              : "Inventory overview per item and warehouse/location with quantities (On hand, Allocated, Available)."}
          </p>
        </Section>
        <Section heading={lang === "de" ? "Feldverhalten" : lang === "es-MX" ? "Comportamiento de campos" : lang === "pt-BR" ? "Comportamento dos campos" : "Field behavior"}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{trans.itemLabel}</strong> — {lang === "de" ? "Beim Blur/Enter wird ln-item-inventory-by-warehouse aufgerufen." : lang === "es-MX" ? "En blur/Enter se invoca ln-item-inventory-by-warehouse." : lang === "pt-BR" ? "No blur/Enter, chama ln-item-inventory-by-warehouse." : "On blur/Enter, calls ln-item-inventory-by-warehouse."}</li>
            <li><strong>{trans.warehouseLabel}</strong> — {lang === "de" ? "Filtert Ansicht; lädt Plätze via ln-stockpoint-inventory." : lang === "es-MX" ? "Filtra la vista; carga ubicaciones vía ln-stockpoint-inventory." : lang === "pt-BR" ? "Filtra a visão; carrega locais via ln-stockpoint-inventory." : "Filters view; loads locations via ln-stockpoint-inventory."}</li>
            <li><strong>{trans.locationLabel}</strong> — {lang === "de" ? "Lädt detaillierte Bestände zum Lagerplatz." : lang === "es-MX" ? "Carga inventario detallado de la ubicación." : lang === "pt-BR" ? "Carrega estoque detalhado do local." : "Loads detailed stock for the location."}</li>
          </ul>
        </Section>
        <Section heading={lang === "de" ? "Backend-Ablauf" : lang === "es-MX" ? "Flujo backend" : lang === "pt-BR" ? "Fluxo de backend" : "Backend flow"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>ln-item-inventory-by-warehouse — {lang === "de" ? "Mengen je Lager" : lang === "es-MX" ? "Cantidades por almacén" : lang === "pt-BR" ? "Quantidades por armazém" : "Quantities per warehouse"}.</li>
            <li>ln-stockpoint-inventory — {lang === "de" ? "Bestände je Lagerplatz" : lang === "es-MX" ? "Inventario por ubicación" : lang === "pt-BR" ? "Estoque por local" : "Stock per location"}.</li>
          </ul>
        </Section>
      </div>
    );
  }

  if (topic === "info-transfer") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">{topicIcon(topic)} {title}</h2>
        <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
          <p>
            {lang === "de"
              ? "Schnellsuche für LE oder Artikel und Anzeige der Kerndaten; mit Artikel wird das Ziel-Lager vorbereitet."
              : lang === "es-MX"
              ? "Búsqueda rápida de UH o artículo y visualización de datos; con artículo se prepara el almacén destino."
              : lang === "pt-BR"
              ? "Busca rápida de UM ou item e exibição dos dados; com item prepara o armazém destino."
              : "Quick search for HU or item and show key data; with item, prepare target warehouse."}
          </p>
        </Section>
        <Section heading={lang === "de" ? "Feldverhalten" : lang === "es-MX" ? "Comportamiento de campos" : lang === "pt-BR" ? "Comportamento dos campos" : "Field behavior"}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{trans.itemOrHandlingUnit}</strong> — {lang === "de" ? "Zuerst ln-handling-unit-info; wenn nicht gefunden → ln-item-info." : lang === "es-MX" ? "Primero ln-handling-unit-info; si no existe → ln-item-info." : lang === "pt-BR" ? "Primeiro ln-handling-unit-info; se não achar → ln-item-info." : "First ln-handling-unit-info; if not found → ln-item-info."}</li>
            <li><strong>{trans.warehouseLabel}</strong> — {lang === "de" ? "Aktivierbar nach Artikel-Treffer, zur Vorbereitung weiterer Schritte." : lang === "es-MX" ? "Habilitable tras encontrar artículo, para preparar pasos siguientes." : lang === "pt-BR" ? "Habilitável após encontrar item, para preparar próximos passos." : "Enabled after item hit, to prepare next steps."}</li>
          </ul>
        </Section>
        <Section heading={lang === "de" ? "Backend-Ablauf" : lang === "es-MX" ? "Flujo backend" : lang === "pt-BR" ? "Fluxo de backend" : "Backend flow"}>
          <ul className="list-disc pl-5 space-y-1">
            <li>ln-handling-unit-info — {lang === "de" ? "LE-Details inkl. Menge/Status" : lang === "es-MX" ? "Detalles de UH incl. cantidad/estado" : lang === "pt-BR" ? "Detalhes da UM incl. quantidade/status" : "HU details incl. quantity/status"}.</li>
            <li>ln-item-info — {lang === "de" ? "Artikel-Stamminfo (Fallback)" : lang === "es-MX" ? "Información básica de artículo (respaldo)" : lang === "pt-BR" ? "Informação básica do item (fallback)" : "Basic item info (fallback)"}.</li>
          </ul>
        </Section>
      </div>
    );
  }

  // hu-info
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">{topicIcon(topic)} {title}</h2>

      <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
        <p>
          {lang === "de"
            ? "Anzeige der LE-Details aus INFOR LN inkl. Artikel, Menge/Einheit, Lager/Platz, Status und Sperrkennzeichen."
            : lang === "es-MX"
            ? "Visualización de detalles de la UH desde INFOR LN incluyendo artículo, cantidad/unidad, almacén/ubicación, estado y bloqueos."
            : lang === "pt-BR"
            ? "Exibição dos detalhes da UM a partir do INFOR LN incluindo item, quantidade/unidade, armazém/local, status e bloqueios."
            : "Displays HU details from INFOR LN including item, quantity/unit, warehouse/location, status, and blocking flags."}
        </p>
      </Section>

      <Section heading={lang === "de" ? "Datenquelle & Felder" : lang === "es-MX" ? "Fuente de datos y campos" : lang === "pt-BR" ? "Fonte de dados e campos" : "Data source & fields"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{lang === "de" ? "ln-handling-unit-info — liest HandlingUnits(...) mit $select=* und $expand=*." : lang === "es-MX" ? "ln-handling-unit-info — lee HandlingUnits(...) con $select=* y $expand=*." : lang === "pt-BR" ? "ln-handling-unit-info — lê HandlingUnits(...) com $select=* e $expand=*." : "ln-handling-unit-info — reads HandlingUnits(...) with $select=* and $expand=*."}</li>
          <li>{lang === "de" ? "Status wird als erstes verfügbares Feld aus Status / StatusDesc / HandlingUnitStatus übernommen und als farbiges Label dargestellt." : lang === "es-MX" ? "El estado se toma del primer campo disponible entre Status / StatusDesc / HandlingUnitStatus y se muestra como etiqueta de color." : lang === "pt-BR" ? "O status é obtido do primeiro campo disponível entre Status / StatusDesc / HandlingUnitStatus e exibido como etiqueta colorida." : "Status is taken from the first available of Status / StatusDesc / HandlingUnitStatus and shown as a colored label."}</li>
          <li>{lang === "de" ? "Sperrkennzeichen: FullyBlocked, BlockedForOutbound, BlockedForTransferIssue, BlockedForCycleCounting, BlockedForAssembly." : lang === "es-MX" ? "Bloqueos: FullyBlocked, BlockedForOutbound, BlockedForTransferIssue, BlockedForCycleCounting, BlockedForAssembly." : lang === "pt-BR" ? "Bloqueios: FullyBlocked, BlockedForOutbound, BlockedForTransferIssue, BlockedForCycleCounting, BlockedForAssembly." : "Blocking flags: FullyBlocked, BlockedForOutbound, BlockedForTransferIssue, BlockedForCycleCounting, BlockedForAssembly."}</li>
        </ul>
      </Section>

      <Section heading={lang === "de" ? "Statusfarben & Lokalisierung" : lang === "es-MX" ? "Colores de estado y localización" : lang === "pt-BR" ? "Cores de status e localização" : "Status colors & localization"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{lang === "de" ? "instock (Im Bestand) — #78d8a3" : lang === "es-MX" ? "instock (En inventario) — #78d8a3" : lang === "pt-BR" ? "instock (Em estoque) — #78d8a3" : "instock (In Stock) — #78d8a3"}</li>
          <li>{lang === "de" ? "staged (Zum Versand Bereit) — #fcc888" : lang === "es-MX" ? "staged (Preparado para envío) — #fcc888" : lang === "pt-BR" ? "staged (Pronto para envio) — #fcc888" : "staged (Staged) — #fcc888"}</li>
          <li>{lang === "de" ? "tobeinspected (Zu prüfen) — #a876eb" : lang === "es-MX" ? "tobeinspected (Por inspeccionar) — #a876eb" : lang === "pt-BR" ? "tobeinspected (A inspecionar) — #a876eb" : "tobeinspected (To be inspected) — #a876eb"}</li>
          <li>{lang === "de" ? "inTransit (Unterwegs) — #55a3f3" : lang === "es-MX" ? "inTransit (En tránsito) — #55a3f3" : lang === "pt-BR" ? "inTransit (Em trânsito) — #55a3f3" : "inTransit — #55a3f3"}</li>
          <li>{lang === "de" ? "shipped (Versendet) — #8e8e95" : lang === "es-MX" ? "shipped (Enviado) — #8e8e95" : lang === "pt-BR" ? "shipped (Enviado) — #8e8e95" : "shipped — #8e8e95"}</li>
          <li>{lang === "de" ? "blocked / quarantine (Gesperrt / Quarantäne) — #e66467" : lang === "es-MX" ? "blocked / quarantine (Bloqueado / Cuarentena) — #e66467" : lang === "pt-BR" ? "blocked / quarantine (Bloqueado / Quarentena) — #e66467" : "blocked / quarantine — #e66467"}</li>
          <li>{lang === "de" ? "close (Geschlossen) — #28282a" : lang === "es-MX" ? "close (Cerrado) — #28282a" : lang === "pt-BR" ? "close (Fechado) — #28282a" : "close — #28282a"}</li>
        </ul>
      </Section>
    </div>
  );
}

const Docs = () => {
  const [params] = useSearchParams();
  const topic = normalizeTopic(params.get("topic"));
  const langParam = (params.get("lang") as LanguageKey | null) || (localStorage.getItem("app.lang") as LanguageKey | null) || "en";
  const lang = (["en", "de", "es-MX", "pt-BR"] as const).includes(langParam) ? langParam : "en";
  const trans = useMemo(() => t(lang), [lang]);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<TopicKey[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = (lang === "de" ? "GSI Dokumentation" : lang === "es-MX" ? "Documentación GSI" : lang === "pt-BR" ? "Documentação GSI" : "GSI Documentation") + " — " + labelForTopic(topic, lang);
    document.documentElement.lang = lang;
  }, [lang, topic]);

  // Build a minimal full-text index per topic (localized)
  const topicText = (key: TopicKey): string => {
    const L = (s: string) => s; // strings already localized below
    switch (key) {
      case "login":
        return [
          labelForTopic("login", lang),
          trans.username, trans.password, trans.transportScreen, trans.signIn,
          lang === "de" ? "Anmeldung, INFOR LN Verbindung, verify-gsi-login, ln-get-token" :
          lang === "es-MX" ? "Inicio de sesión, conexión INFOR LN, verify-gsi-login, ln-get-token" :
          lang === "pt-BR" ? "Login, conexão INFOR LN, verify-gsi-login, ln-get-token" :
          "Sign in, INFOR LN connection, verify-gsi-login, ln-get-token"
        ].join(" ");
      case "transport-load":
        return [labelForTopic(key, lang), trans.loadVehicleId, trans.loadAction, trans.loadHandlingUnit, trans.itemLabel, "ln-transport-orders ln-handling-unit-info ln-move-to-location"].join(" ");
      case "transport-unload":
        return [labelForTopic(key, lang), trans.unloadAction, trans.locationFromLabel, trans.locationToLabel, trans.quantityLabel, "OrderedQuantity ln-transport-list ln-move-to-location"].join(" ");
      case "hu-info":
        return [labelForTopic(key, lang), trans.statusLabel, trans.blockedLabel, "ln-handling-unit-info"].join(" ");
      case "info-item":
        return [labelForTopic(key, lang), trans.onHandLabel, trans.availableLabel, "ln-item-inventory-by-warehouse ln-stockpoint-inventory"].join(" ");
      case "info-transfer":
        return [labelForTopic(key, lang), trans.itemOrHandlingUnit, trans.warehouseLabel, "ln-handling-unit-info ln-item-info"].join(" ");
    }
  };

  const runSearch = (q: string) => {
    const v = q.trim().toLowerCase();
    if (!v) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const hits = topics.filter((k) => topicText(k).toLowerCase().includes(v));
    setResults(hits);
    setShowResults(true);
  };

  const goToTopic = (key: TopicKey) => {
    window.location.href = `/docs?topic=${encodeURIComponent(key)}&lang=${encodeURIComponent(lang)}`;
  };

  const onPrint = () => {
    window.print();
  };

  const navItem = (key: TopicKey) => {
    const isActive = key === topic;
    const activeClasses = "bg-[#e9f0fb] text-[#1d4a85] shadow-sm";
    const inactiveClasses = "text-gray-700 hover:text-[#1d4a85] hover:bg-[#eef4ff]";
    const iconClass = isActive ? "h-4 w-4 text-[#1d4a85]" : "h-4 w-4 text-gray-600";
    return (
      <a
        key={key}
        href={`/docs?topic=${encodeURIComponent(key)}&lang=${encodeURIComponent(lang)}`}
        className={[
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive ? activeClasses : inactiveClasses
        ].join(" ").trim()}
      >
        {topicIconEl(key, iconClass)}
        {labelForTopic(key, lang)}
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top header with Home, centered Search, PDF (print) — hidden in print */}
      <div className="bg-[#163e72] text-white print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-12 items-center gap-4">
          {/* Left: Home */}
          <div className="col-span-2 flex items-center">
            <a
              href={`/docs?topic=login&lang=${encodeURIComponent(lang)}`}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Home"
              title="Home"
            >
              <Home className="h-5 w-5 text-white" />
            </a>
            <div className="ml-3 font-semibold hidden sm:block">
              {lang === "de" ? "GSI Dokumentation" : lang === "es-MX" ? "Documentación GSI" : lang === "pt-BR" ? "Documentação GSI" : "GSI Documentation"}
            </div>
          </div>
          {/* Center: Search */}
          <div className="col-span-8">
            <div className="relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  runSearch(e.target.value);
                }}
                onFocus={() => runSearch(query)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (results.length > 0) goToTopic(results[0]);
                    else setShowResults(false);
                  }
                  if (e.key === "Escape") {
                    setShowResults(false);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder={
                  lang === "de" ? "Gesamtsuche" :
                  lang === "es-MX" ? "Búsqueda global" :
                  lang === "pt-BR" ? "Busca geral" :
                  "Global search"
                }
                className="w-full h-10 rounded-md bg-white text-gray-900 placeholder:text-gray-500 pl-10 pr-10 shadow-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <SearchIcon
                className="h-5 w-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <button
                type="button"
                aria-label="Search"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-7 w-7 rounded hover:bg-gray-200/60"
                onClick={() => {
                  if (results.length > 0) goToTopic(results[0]);
                }}
              >
                <SearchIcon className="h-4 w-4 text-gray-700" />
              </button>
              {/* Results dropdown */}
              {showResults && results.length > 0 && (
                <div className="absolute z-50 mt-2 w-full rounded-md bg-white text-gray-900 shadow-lg border border-gray-200">
                  <div className="py-1 max-h-64 overflow-auto">
                    {results.map((r) => (
                      <a
                        key={r}
                        href={`/docs?topic=${encodeURIComponent(r)}&lang=${encodeURIComponent(lang)}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
                        onClick={() => setShowResults(false)}
                      >
                        {topicIconEl(r, "h-4 w-4 text-[#1d4a85]")}
                        <span className="text-sm">{labelForTopic(r, lang)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Right: PDF (print) */}
          <div className="col-span-2 flex items-center justify-end">
            <button
              type="button"
              aria-label="Download PDF"
              title="Download PDF"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-white/10 transition-colors"
              onClick={onPrint}
            >
              <FileDown className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-4 grid grid-cols-12 gap-4">
        {/* Left nav with tree (Accordion) — light style, visible in print as TOC */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3 print:hidden">
          <div className="bg-white text-gray-900 rounded-md p-3 border">
            <div className="text-xs uppercase tracking-wide text-gray-600 mb-2">
              {lang === "de" ? "Themen" : lang === "es-MX" ? "Temas" : lang === "pt-BR" ? "Tópicos" : "Topics"}
            </div>
            <nav className="space-y-2">
              {/* Top-level: Login */}
              {navItem("login")}

              {/* Determine which sections to open by default */}
              <Accordion
                type="multiple"
                defaultValue={[
                  (topic === "transport-load" || topic === "transport-unload") ? "transport" : "",
                  (topic === "hu-info" || topic === "info-item" || topic === "info-transfer") ? "infostock" : "",
                ].filter(Boolean) as string[]}
                className="mt-1"
              >
                {/* Transport section */}
                <AccordionItem value="transport" className="border-none">
                  <AccordionTrigger className="px-3 py-2 rounded-md text-gray-800 hover:bg-gray-50 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-[#1d4a85]" />
                      {t(lang).appTransport}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pl-2">
                    <div className="flex flex-col gap-1">
                      {navItem("transport-load")}
                      {navItem("transport-unload")}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Info / Stock section */}
                <AccordionItem value="infostock" className="border-none">
                  <AccordionTrigger className="px-3 py-2 rounded-md text-gray-800 hover:bg-gray-50 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-[#1d4a85]" />
                      {t(lang).appInfoStock}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pl-2">
                    <div className="flex flex-col gap-1">
                      {navItem("hu-info")}
                      {navItem("info-item")}
                      {navItem("info-transfer")}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="bg-white rounded-md border p-5 print:border-0">
            <DocsContent topic={topic} lang={lang} />
            <Separator className="my-6" />
            <div className="text-xs text-gray-500">
              © {new Date().getFullYear()} GSI — {lang === "de" ? "Benutzerhandbuch" : lang === "es-MX" ? "Manual de usuario" : lang === "pt-BR" ? "Manual do usuário" : "User manual"}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;