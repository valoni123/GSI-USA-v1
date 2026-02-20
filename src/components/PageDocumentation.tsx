"use client";

import React from "react";
import { FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";

type Section = {
  title: string;
  bullets?: string[];
  body?: string;
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

const addContent = (doc: jsPDF, content: DocContent) => {
  const marginX = 16;
  let y = 20;

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;
  const pageHeight = doc.internal.pageSize.getHeight();

  const addPageIfNeeded = (lineHeight = 6) => {
    if (y + lineHeight > pageHeight - 16) {
      doc.addPage();
      y = 20;
    }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(content.title, marginX, y);
  y += 10;

  // Sections
  content.sections.forEach((sec, idx) => {
    addPageIfNeeded(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${idx + 1}. ${sec.title}`, marginX, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    if (sec.body) {
      const lines = doc.splitTextToSize(sec.body, contentWidth);
      lines.forEach((line) => {
        addPageIfNeeded(6);
        doc.text(line, marginX, y);
        y += 6;
      });
    }

    if (sec.bullets && sec.bullets.length > 0) {
      sec.bullets.forEach((b) => {
        const bulletLines = doc.splitTextToSize(`• ${b}`, contentWidth);
        bulletLines.forEach((line, i) => {
          addPageIfNeeded(6);
          doc.text(line, marginX + (i === 0 ? 0 : 10), y);
          y += 6;
        });
      });
    }

    y += 4;
  });

  if (content.footerNote) {
    addPageIfNeeded(12);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(content.footerNote, marginX, y);
  }
};

const downloadPdf = (content: DocContent) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });
  addContent(doc, content);
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
        onClick={() => downloadPdf(userManual)}
      >
        <FileText className="h-4 w-4 mr-2" />
        <span>User Manual</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-3"
        onClick={() => downloadPdf(technicalDoc)}
      >
        <Wrench className="h-4 w-4 mr-2" />
        <span>Technical Doc</span>
      </Button>
    </div>
  );
};

export default PageDocumentation;