import type { LanguageKey } from "@/lib/i18n";

export type RawKittingOriginRow = {
  constantName: string;
  descriptionLabel: string;
};

export type KittingOriginOption = {
  constantName: string;
  descriptionLabel: string;
  englishLabel: string;
  label: string;
  style: {
    bg: string;
    text: string;
  };
};

type OriginDefinition = {
  englishLabel: string;
  labels: Record<LanguageKey, string>;
  style: {
    bg: string;
    text: string;
  };
};

const COLORS = {
  blue: { bg: "#2b6ea6", text: "#ffffff" },
  green: { bg: "#39b72f", text: "#ffffff" },
  olive: { bg: "#6ea83f", text: "#ffffff" },
  red: { bg: "#ff5d57", text: "#ffffff" },
  yellow: { bg: "#ffcc00", text: "#1f2937" },
  lightBlue: { bg: "#65b8f5", text: "#ffffff" },
  lime: { bg: "#a9d63b", text: "#1f2937" },
  gray: { bg: "#c8c8c8", text: "#ffffff" },
} as const;

const DEFINITIONS: Record<string, OriginDefinition> = {
  assembly: {
    englishLabel: "Warehousing Assembly",
    labels: {
      en: "Warehousing Assembly",
      de: "Zusammenstellung (Lager)",
      "es-MX": "Montaje de almacenaje",
      "pt-BR": "Montagem de armazenamento",
    },
    style: COLORS.green,
  },
  "enterprise.plan": {
    englishLabel: "Enterprise Planning",
    labels: {
      en: "Enterprise Planning",
      de: "Unternehmensplanung",
      "es-MX": "Planificación Empresarial",
      "pt-BR": "Distribuição EP",
    },
    style: COLORS.yellow,
  },
  "maint.sales": {
    englishLabel: "Maintenance Sales",
    labels: {
      en: "Maintenance Sales",
      de: "Werkstattauftrag",
      "es-MX": "Ventas de mantenimiento",
      "pt-BR": "Vendas de manutenção",
    },
    style: COLORS.red,
  },
  "maint.sales.man": {
    englishLabel: "Maint. Sales (Manual)",
    labels: {
      en: "Maint. Sales (Manual)",
      de: "Werkstattauftrag (manuell)",
      "es-MX": "Ventas de mantenimiento (manual)",
      "pt-BR": "Vendas de manutenção (manual)",
    },
    style: COLORS.red,
  },
  "maint.work": {
    englishLabel: "Maintenance Work",
    labels: {
      en: "Maintenance Work",
      de: "Arbeitsauftrag",
      "es-MX": "Trabajo de mantenimiento",
      "pt-BR": "Trabalho de manutenção",
    },
    style: COLORS.red,
  },
  "maint.work.man": {
    englishLabel: "Maint. Work (Manual)",
    labels: {
      en: "Maint. Work (Manual)",
      de: "Arbeitsauftrag (manuell)",
      "es-MX": "Trabajo de mantenimiento (manual)",
      "pt-BR": "Trabalho de manutenção (manual)",
    },
    style: COLORS.red,
  },
  "not.appl": {
    englishLabel: "Not Applicable",
    labels: {
      en: "Not Applicable",
      de: "---",
      "es-MX": "No aplicable",
      "pt-BR": "Não aplicável",
    },
    style: COLORS.gray,
  },
  "product.asc": {
    englishLabel: "ASC Production",
    labels: {
      en: "ASC Production",
      de: "Montageverwaltung",
      "es-MX": "Fabricación ASC",
      "pt-BR": "Produção ASC",
    },
    style: COLORS.green,
  },
  "product.asc.man": {
    englishLabel: "ASC Production (Manual)",
    labels: {
      en: "ASC Production (Manual)",
      de: "Montageverwaltung (manuell)",
      "es-MX": "Fabricación ASC (manual)",
      "pt-BR": "Produção ASC (manual)",
    },
    style: COLORS.green,
  },
  "product.kanban": {
    englishLabel: "Production KANBAN",
    labels: {
      en: "Production KANBAN",
      de: "Produktion (Kanban)",
      "es-MX": "Kanban de fabricación",
      "pt-BR": "KANBAN de produção",
    },
    style: COLORS.green,
  },
  "product.sched": {
    englishLabel: "Production Schedule",
    labels: {
      en: "Production Schedule",
      de: "Produktionsprogramm",
      "es-MX": "Programación de fabricación",
      "pt-BR": "Programação de produção",
    },
    style: COLORS.green,
  },
  production: {
    englishLabel: "JSC Production",
    labels: {
      en: "JSC Production",
      de: "Produktion (JSC)",
      "es-MX": "Fabricación JSC",
      "pt-BR": "Produção JSC",
    },
    style: COLORS.green,
  },
  "production.man": {
    englishLabel: "JSC Production (Manual)",
    labels: {
      en: "JSC Production (Manual)",
      de: "Produktion (JSC) (manuell)",
      "es-MX": "Fabricación JSC (manual)",
      "pt-BR": "Produção JSC (manual)",
    },
    style: COLORS.green,
  },
  project: {
    englishLabel: "Project",
    labels: {
      en: "Project",
      de: "Projekt",
      "es-MX": "Proyecto",
      "pt-BR": "Projeto",
    },
    style: COLORS.lightBlue,
  },
  "project.man": {
    englishLabel: "Project (Manual)",
    labels: {
      en: "Project (Manual)",
      de: "Projekt (manuell)",
      "es-MX": "Proyecto (manual)",
      "pt-BR": "Projeto (manual)",
    },
    style: COLORS.lightBlue,
  },
  purchase: {
    englishLabel: "Purchase",
    labels: {
      en: "Purchase",
      de: "Einkauf",
      "es-MX": "Compras",
      "pt-BR": "Compra",
    },
    style: COLORS.lime,
  },
  "purchase.man": {
    englishLabel: "Purchase (Manual)",
    labels: {
      en: "Purchase (Manual)",
      de: "Einkauf (manuell)",
      "es-MX": "Compras (manual)",
      "pt-BR": "Compra (manual)",
    },
    style: COLORS.lime,
  },
  "purchase.sched": {
    englishLabel: "Purchase Schedule",
    labels: {
      en: "Purchase Schedule",
      de: "EK-Lieferabruf",
      "es-MX": "Programación de compras",
      "pt-BR": "Programação de compra",
    },
    style: COLORS.lime,
  },
  sales: {
    englishLabel: "Sales",
    labels: {
      en: "Sales",
      de: "Verkauf",
      "es-MX": "Ventas",
      "pt-BR": "Vendas",
    },
    style: COLORS.blue,
  },
  "sales.man": {
    englishLabel: "Sales (Manual)",
    labels: {
      en: "Sales (Manual)",
      de: "Verkauf (manuell)",
      "es-MX": "Ventas (manual)",
      "pt-BR": "Vendas (manual)",
    },
    style: COLORS.blue,
  },
  "sales.sched": {
    englishLabel: "Sales Schedule",
    labels: {
      en: "Sales Schedule",
      de: "VK-Lieferabruf",
      "es-MX": "Programación de ventas",
      "pt-BR": "Progr. de vendas",
    },
    style: COLORS.blue,
  },
  service: {
    englishLabel: "Service",
    labels: {
      en: "Service",
      de: "Service",
      "es-MX": "Servicio",
      "pt-BR": "Serviço",
    },
    style: COLORS.olive,
  },
  "service.man": {
    englishLabel: "Service (Manual)",
    labels: {
      en: "Service (Manual)",
      de: "Service (manuell)",
      "es-MX": "Servicio (manual)",
      "pt-BR": "Serviço (manual)",
    },
    style: COLORS.olive,
  },
  transfer: {
    englishLabel: "Transfer",
    labels: {
      en: "Transfer",
      de: "Umbuchung",
      "es-MX": "Transferencia",
      "pt-BR": "Transferência",
    },
    style: COLORS.yellow,
  },
  "transfer.man": {
    englishLabel: "Transfer (Manual)",
    labels: {
      en: "Transfer (Manual)",
      de: "Umbuchung (manuell)",
      "es-MX": "Transferencia (manual)",
      "pt-BR": "Transferência (manual)",
    },
    style: COLORS.yellow,
  },
};

function fallbackOption(constantName: string, descriptionLabel: string, lang: LanguageKey): KittingOriginOption {
  return {
    constantName,
    descriptionLabel,
    englishLabel: constantName,
    label: constantName,
    style: COLORS.gray,
  };
}

export function getKittingOriginOption(constantName: string, descriptionLabel: string, lang: LanguageKey): KittingOriginOption {
  const definition = DEFINITIONS[constantName];
  if (!definition) return fallbackOption(constantName, descriptionLabel, lang);

  return {
    constantName,
    descriptionLabel,
    englishLabel: definition.englishLabel,
    label: definition.labels[lang] || definition.labels.en,
    style: definition.style,
  };
}

export function buildKittingOriginOptions(rows: RawKittingOriginRow[], lang: LanguageKey): KittingOriginOption[] {
  return rows
    .map((row) => getKittingOriginOption(row.constantName, row.descriptionLabel, lang))
    .sort((a, b) => {
      if (a.constantName === "sales") return -1;
      if (b.constantName === "sales") return 1;
      return a.label.localeCompare(b.label, lang === "de" ? "de" : lang === "es-MX" ? "es" : lang === "pt-BR" ? "pt" : "en");
    });
}

export function findKittingOriginOptionByConstantName(options: KittingOriginOption[], constantName: string) {
  return options.find((option) => option.constantName === constantName) || null;
}

export function findKittingOriginOptionByEnglishLabel(options: KittingOriginOption[], englishLabel: string) {
  return options.find((option) => option.englishLabel.toLowerCase() === englishLabel.trim().toLowerCase()) || null;
}
