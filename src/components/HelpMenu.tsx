"use client";

import React from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { LanguageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type HelpMenuProps = {
  topic: string; // e.g., "login", "transport-load", "transport-unload", "hu-info"
  className?: string;
};

const HelpMenu: React.FC<HelpMenuProps> = ({ topic, className }) => {
  const lang = (localStorage.getItem("app.lang") as LanguageKey) || "en";
  const trans = t(lang);

  const openDocs = () => {
    const url = `/docs?topic=${encodeURIComponent(topic)}&lang=${encodeURIComponent(lang)}`;
    const features = [
      "noopener",
      "noreferrer",
      "toolbar=no",
      "menubar=no",
      "location=no",
      "status=no",
      "resizable=yes",
      "scrollbars=yes",
      "width=1100",
      "height=800",
      "left=120",
      "top=60"
    ].join(",");
    window.open(url, "GSI_Docs", features);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={["text-white hover:bg-white/10 h-9 px-2", className || ""].join(" ").trim()}
        >
          <HelpCircle className="h-5 w-5" />
          <ChevronDown className="h-4 w-4 ml-1 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={openDocs}
          className="cursor-pointer"
        >
          {trans.helpLabel}
          <span className="ml-auto text-xs text-muted-foreground">H</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {}}
          className="cursor-default"
        >
          {trans.propertiesLabel}
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+Shift+8</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HelpMenu;