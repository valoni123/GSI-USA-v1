"use client";

import React from "react";
import { FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Highlight = {
  selector: string;
  color?: string; // hex like #ff0000
  borderWidth?: number; // px
};

type Screenshot = {
  captureSelector: string; // CSS selector of container to capture
  highlights?: Highlight[]; // elements inside capture to highlight
  maxWidthPt?: number; // optional max width in PDF points
};

type Section = {
  title: string;
  bullets?: string[];
  body?: string;
  screenshot?: Screenshot;
};

export type DocContent = {
  title: string;
  sections: Section[];
  footerNote?: string;
  filename?: string;
};

type PageDocumentationProps = {
  userManual: DocContent;
  technicalDoc: DocContent;
  className?: string;
  compact?: boolean;
};

const loadImageDataUrl = async (src: string): Promise<string | null> => {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

type LocaleKey = "de" | "en" | "es-MX" | "pt-BR";

const detectLocaleFromTitle = (title: string): LocaleKey => {
  const s = title.toLowerCase();
  if (s.includes("benutzerhandbuch") || s.includes("wareneingang") || s.includes("menü")) return "de";
  if (s.includes("manual de usuario") || s.includes("entrada")) return "es-MX";
  if (s.includes("manual do usuário") || s.includes("entrada")) return "pt-BR";
  return "en";
};

const getCoverLabel = (title: string): string => {
  const s = title.toLowerCase();
  if (s.includes("benutzerhandbuch")) return "Benutzerhandbuch";
  if (s.includes("manual de usuario")) return "Manual de Usuario";
  if (s.includes("manual do usuário") || s.includes("manual do usuario")) return "Manual do Usuário";
  if (s.includes("technical documentation") || s.includes("technische dokumentation")) {
    const locale = detectLocaleFromTitle(title);
    if (locale === "de") return "Technische Dokumentation";
    if (locale === "es-MX") return "Documentación Técnica";
    if (locale === "pt-BR") return "Documentação Técnica";
    return "Technical Documentation";
  }
  return "User Manual";
};

const getTocLabel = (locale: LocaleKey): string => {
  switch (locale) {
    case "de":
      return "Inhaltsverzeichnis";
    case "es-MX":
      return "Tabla de contenidos";
    case "pt-BR":
      return "Tabela de conteúdo";
    default:
      return "Table of Contents";
  }
};

const addCoverPage = (doc: jsPDF, logoDataUrl: string | null, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Left margin positioning
  const marginLeft = 60;

  // Logo top-left
  if (logoDataUrl) {
    const logoWidth = 260; // tuned to look similar to screenshot
    const logoHeight = 90;
    const x = marginLeft;
    const y = 70;
    doc.addImage(logoDataUrl, "PNG", x, y, logoWidth, logoHeight);
  }

  // Big title (localized, e.g., "Benutzerhandbuch")
  const coverLabel = getCoverLabel(title);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text(coverLabel, marginLeft, 260);

  // Subtitle (e.g., "Benutzerhandbuch - Login" or localized)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  doc.text(title, marginLeft, 290);
};

const addTableOfContents = (doc: jsPDF, locale: LocaleKey, sections: Section[]) => {
  doc.addPage();
  const marginX = 60;
  let y = 120;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;

  // TOC title
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(getTocLabel(locale), marginX, y);
  y += 24;

  // Items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  sections.forEach((sec, idx) => {
    const line = `${idx + 1}. ${sec.title}`;
    const lines = doc.splitTextToSize(line, contentWidth);
    lines.forEach((l) => {
      doc.text(l, marginX, y);
      y += 16;
    });
  });
};

const hexToRgb = (hex?: string): [number, number, number] => {
  if (!hex) return [255, 0, 0];
  const m = hex.replace("#", "");
  const v = m.length === 3
    ? m.split("").map((c) => parseInt(c + c, 16))
    : [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  return [v[0] ?? 255, v[1] ?? 0, v[2] ?? 0];
};

const addContentPages = async (doc: jsPDF, content: DocContent) => {
  doc.addPage();
  const marginX = 60;
  let y = 90;

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;
  const pageHeight = doc.internal.pageSize.getHeight();

  const addPageIfNeeded = (lineHeight = 16) => {
    if (y + lineHeight > pageHeight - 60) {
      doc.addPage();
      y = 90;
    }
  };

  for (let idx = 0; idx < content.sections.length; idx++) {
    const sec = content.sections[idx];
    
    // Section title
    addPageIfNeeded(26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${idx + 1}. ${sec.title}`, marginX, y);
    y += 18;

    // Body
    if (sec.body) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      const bodyLines = doc.splitTextToSize(sec.body, contentWidth);
      bodyLines.forEach((line) => {
        addPageIfNeeded(16);
        doc.text(line, marginX, y);
        y += 16;
      });
      y += 6;
    }

    // Bullets
    if (sec.bullets && sec.bullets.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      sec.bullets.forEach((b) => {
        const bulletLines = doc.splitTextToSize(b, contentWidth - 16);
        const bulletPrefixX = marginX;
        const bulletTextX = marginX + 12;
        bulletLines.forEach((line, i) => {
          addPageIfNeeded(16);
          if (i === 0) {
            doc.text("•", bulletPrefixX, y);
          }
          doc.text(line, bulletTextX, y);
          y += 16;
        });
      });
      y += 6;
    }

    // Optional screenshot
    if (sec.screenshot?.captureSelector) {
      const container = document.querySelector(sec.screenshot.captureSelector) as HTMLElement | null;
      if (container) {
        // Compute container rect for scaling
        const rect = container.getBoundingClientRect();
        const maxWidthPt = sec.screenshot.maxWidthPt || contentWidth;
        // Capture at 2x scale for better clarity
        const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
        const dataUrl = canvas.toDataURL("image/png");
        // Calculate scaled dimensions to fit width
        const scale = maxWidthPt / rect.width;
        const imgWidthPt = maxWidthPt;
        const imgHeightPt = rect.height * scale;
        addPageIfNeeded(imgHeightPt + 20);
        // Draw image
        doc.addImage(dataUrl, "PNG", marginX, y, imgWidthPt, imgHeightPt);
        // Draw highlights
        if (sec.screenshot.highlights && sec.screenshot.highlights.length > 0) {
          for (const hl of sec.screenshot.highlights) {
            const el = container.querySelector(hl.selector) as HTMLElement | null;
            if (!el) continue;
            const elRect = el.getBoundingClientRect();
            const relX = elRect.left - rect.left;
            const relY = elRect.top - rect.top;
            const pdfX = marginX + relX * scale;
            const pdfY = y + relY * scale;
            const pdfW = elRect.width * scale;
            const pdfH = elRect.height * scale;
            const [r, g, b] = hexToRgb(hl.color || "#ff0000");
            doc.setDrawColor(r, g, b);
            doc.setLineWidth(hl.borderWidth ?? 2);
            doc.rect(pdfX, pdfY, pdfW, pdfH);
          }
        }
        y += imgHeightPt + 16;
      }
    }
  }
  
  // Footer texts intentionally removed across pages
};

const downloadPdf = async (content: DocContent) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const logoDataUrl = await loadImageDataUrl("/black_logo_transparent_background.png");
  addCoverPage(doc, logoDataUrl, content.title);

  const locale = detectLocaleFromTitle(content.title);
  addTableOfContents(doc, locale, content.sections);

  await addContentPages(doc, content);

  const name = content.filename || content.title.replace(/\s+/g, "_");
  doc.save(`${name}.pdf`);
};

const PageDocumentation: React.FC<PageDocumentationProps> = ({ userManual, technicalDoc, className, compact = true }) => {
  return (
    <div className={["flex items-center gap-2", compact ? "" : "mt-4", className || ""].join(" ").trim()}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-3"
        onClick={async () => {
          await downloadPdf(userManual);
        }}
      >
        <FileText className="h-4 w-4 mr-2" />
        <span>User Manual</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-3"
        onClick={async () => {
          await downloadPdf(technicalDoc);
        }}
      >
        <Wrench className="h-4 w-4 mr-2" />
        <span>Technical Doc</span>
      </Button>
    </div>
  );
};

export default PageDocumentation;