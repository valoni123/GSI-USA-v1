"use client";

import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { LanguageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Separator } from "@/components/ui/separator";

type TopicKey = "login" | "transport-load" | "transport-unload" | "hu-info";

const topics: TopicKey[] = ["login", "transport-load", "transport-unload", "hu-info"];

function normalizeTopic(v: string | null): TopicKey {
  const s = (v || "").toLowerCase();
  if (s === "transport-load") return "transport-load";
  if (s === "transport-unload") return "transport-unload";
  if (s === "hu-info" || s === "le-info" || s === "huinfo") return "hu-info";
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

  if (topic === "login") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{title}</h2>
        <Section heading={lang === "de" ? "Übersicht" : lang === "es-MX" ? "Visión general" : lang === "pt-BR" ? "Visão geral" : "Overview"}>
          <p>
            {lang === "de"
              ? "Diese Seite dient zur Anmeldung am System. Nach erfolgreicher Anmeldung können Sie die gewünschten Apps öffnen."
              : lang === "es-MX"
              ? "Esta página sirve para iniciar sesión en el sistema. Tras iniciar sesión, podrá abrir las aplicaciones deseadas."
              : lang === "pt-BR"
              ? "Esta página é usada para entrar no sistema. Após entrar, você poderá abrir os aplicativos desejados."
              : "This page is used to sign in to the system. After signing in, you can open the desired apps."}
          </p>
        </Section>
        <Section heading={lang === "de" ? "Felder" : lang === "es-MX" ? "Campos" : lang === "pt-BR" ? "Campos" : "Fields"}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{trans.username}</strong> — {lang === "de" ? "Benutzerkennung" : lang === "es-MX" ? "Identificador de usuario" : lang === "pt-BR" ? "Identificador do usuário" : "User identifier"}.</li>
            <li><strong>{trans.password}</strong> — {lang === "de" ? "Kennwort" : lang === "es-MX" ? "Contraseña" : lang === "pt-BR" ? "Senha" : "Password"}.</li>
            <li><strong>{trans.transportScreen}</strong> — {lang === "de" ? "Direkt zur Transport-Übersicht navigieren" : lang === "es-MX" ? "Ir directamente a la pantalla de transporte" : lang === "pt-BR" ? "Ir direto para a tela de transporte" : "Navigate directly to the transport overview"}.</li>
          </ul>
        </Section>
        <Section heading={lang === "de" ? "Aktionen" : lang === "es-MX" ? "Acciones" : lang === "pt-BR" ? "Ações" : "Actions"}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{trans.signIn}</strong> — {lang === "de" ? "Anmeldung durchführen" : lang === "es-MX" ? "Iniciar sesión" : lang === "pt-BR" ? "Entrar" : "Sign in"}.</li>
          </ul>
        </Section>
      </div>
    );
  }

  if (topic === "transport-load") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{title}</h2>
        <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
          <p>
            {lang === "de"
              ? "Ladevorgänge für Transportaufträge ausführen. Scannen Sie eine Ladeeinheit oder einen Artikel."
              : lang === "es-MX"
              ? "Ejecutar operaciones de carga para órdenes de transporte. Escanee una unidad de manejo o un artículo."
              : lang === "pt-BR"
              ? "Executar operações de carregamento para ordens de transporte. Escaneie uma unidade de manuseio ou item."
              : "Execute loading operations for transport orders. Scan a handling unit or an item."}
          </p>
        </Section>
        <Section heading={lang === "de" ? "Felder" : lang === "es-MX" ? "Campos" : lang === "pt-BR" ? "Campos" : "Fields"}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Handling Unit / Item</strong> — {lang === "de" ? "Scan der LE bzw. Artikel" : lang === "es-MX" ? "Escaneo de la UH o artículo" : lang === "pt-BR" ? "Leitura da UM ou item" : "Scan the HU or item"}.</li>
            <li><strong>{trans.loadVehicleId}</strong> — {lang === "de" ? "Fahrzeug-ID für das Beladen" : lang === "es-MX" ? "ID del vehículo para la carga" : lang === "pt-BR" ? "ID do veículo para carregamento" : "Vehicle ID to load onto"}.</li>
          </ul>
        </Section>
        <Section heading={lang === "de" ? "Ablauf" : lang === "es-MX" ? "Flujo" : lang === "pt-BR" ? "Fluxo" : "Flow"}>
          <ol className="list-decimal pl-5 space-y-1">
            <li>{lang === "de" ? "LE/Artikel scannen" : lang === "es-MX" ? "Escanear UH/Artículo" : lang === "pt-BR" ? "Ler UM/Item" : "Scan HU/Item"}.</li>
            <li>{lang === "de" ? "Fahrzeug-ID wählen" : lang === "es-MX" ? "Elegir ID del vehículo" : lang === "pt-BR" ? "Escolher ID do veículo" : "Choose vehicle ID"}.</li>
            <li>{lang === "de" ? "Laden ausführen" : lang === "es-MX" ? "Ejecutar carga" : lang === "pt-BR" ? "Executar carregamento" : "Execute load"}.</li>
          </ol>
        </Section>
      </div>
    );
  }

  if (topic === "transport-unload") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{title}</h2>
        <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
          <p>
            {lang === "de"
              ? "Entladevorgänge aus einem Fahrzeug an den Zielplatz ausführen. Für Artikel ohne LE wird die bestellte Menge genutzt."
              : lang === "es-MX"
              ? "Ejecutar descargas desde un vehículo al destino. Para artículos sin UH se usa la cantidad pedida."
              : lang === "pt-BR"
              ? "Executar descarregamento do veículo para o destino. Para itens sem UM, utiliza-se a quantidade pedida."
              : "Execute unload to destination. For item-only rows, the ordered quantity is used."}
          </p>
        </Section>
        <Section heading={lang === "de" ? "Felder" : lang === "es-MX" ? "Campos" : lang === "pt-BR" ? "Campos" : "Fields"}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{t(lang).loadHandlingUnit}</strong> / <strong>{t(lang).itemLabel}</strong></li>
            <li><strong>{t(lang).locationFromLabel}</strong> → <strong>{t(lang).locationToLabel}</strong></li>
            <li><strong>{t(lang).quantityLabel}</strong></li>
          </ul>
        </Section>
        <Section heading={lang === "de" ? "Ablauf" : lang === "es-MX" ? "Flujo" : lang === "pt-BR" ? "Fluxo" : "Flow"}>
          <ol className="list-decimal pl-5 space-y-1">
            <li>{lang === "de" ? "Positionen prüfen" : lang === "es-MX" ? "Revisar posiciones" : lang === "pt-BR" ? "Revisar posições" : "Review lines"}.</li>
            <li>{lang === "de" ? "Entladen auslösen" : lang === "es-MX" ? "Iniciar descarga" : lang === "pt-BR" ? "Iniciar descarga" : "Trigger unload"}.</li>
          </ol>
        </Section>
      </div>
    );
  }

  // hu-info
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <Section heading={lang === "de" ? "Zweck" : lang === "es-MX" ? "Propósito" : lang === "pt-BR" ? "Propósito" : "Purpose"}>
        <p>
          {lang === "de"
            ? "Informationen zu einer Ladeeinheit anzeigen, inkl. Artikel, Menge, Lager, Status und Sperrkennzeichen."
            : lang === "es-MX"
            ? "Mostrar información de una unidad de manejo, incluyendo artículo, cantidad, almacén, estado y bloqueos."
            : lang === "pt-BR"
            ? "Exibir informações de uma unidade de manuseio, incluindo item, quantidade, armazém, status e bloqueios."
            : "Show information for a handling unit, including item, quantity, warehouse, status and blocking flags."}
        </p>
      </Section>
      <Section heading={lang === "de" ? "Felder" : lang === "es-MX" ? "Campos" : lang === "pt-BR" ? "Campos" : "Fields"}>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>{t(lang).loadHandlingUnit}</strong></li>
          <li><strong>{t(lang).itemLabel}</strong></li>
          <li><strong>{t(lang).warehouseLabel}</strong> / <strong>{t(lang).locationLabel}</strong></li>
          <li><strong>{t(lang).quantityLabel}</strong></li>
          <li><strong>{t(lang).statusLabel}</strong></li>
          <li><strong>{t(lang).blockedLabel}</strong></li>
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

  useEffect(() => {
    document.title = (lang === "de" ? "GSI Dokumentation" : lang === "es-MX" ? "Documentación GSI" : lang === "pt-BR" ? "Documentação GSI" : "GSI Documentation") + " — " + labelForTopic(topic, lang);
    document.documentElement.lang = lang;
  }, [lang, topic]);

  const navItem = (key: TopicKey) => {
    const isActive = key === topic;
    return (
      <a
        key={key}
        href={`/docs?topic=${encodeURIComponent(key)}&lang=${encodeURIComponent(lang)}`}
        className={[
          "block px-3 py-2 rounded-md text-sm font-medium",
          isActive ? "bg-white text-gray-900 shadow" : "text-white/90 hover:text-white hover:bg-white/10"
        ].join(" ").trim()}
      >
        {labelForTopic(key, lang)}
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top header */}
      <div className="bg-[#163e72] text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">
            {lang === "de" ? "GSI Dokumen­tation" : lang === "es-MX" ? "Documentación GSI" : lang === "pt-BR" ? "Documentação GSI" : "GSI Documentation"}
          </div>
          <div className="text-sm opacity-90">{trans.appTransport} · {trans.appInfoStock}</div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-4 grid grid-cols-12 gap-4">
        {/* Left nav */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="bg-[#1d4a85] text-white rounded-md p-3">
            <div className="text-xs uppercase tracking-wide opacity-90 mb-2">
              {lang === "de" ? "Themen" : lang === "es-MX" ? "Temas" : lang === "pt-BR" ? "Tópicos" : "Topics"}
            </div>
            <nav className="space-y-1">
              {topics.map(navItem)}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="bg-white rounded-md border p-5">
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