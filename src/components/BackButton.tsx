"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BackButtonProps = {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
};

const BackButton: React.FC<BackButtonProps> = ({ onClick, ariaLabel = "Back", className }) => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        "h-9 w-9 rounded-full bg-white text-black hover:bg-white/90 shadow-sm",
        "flex items-center justify-center",
        className || ""
      ].join(" ").trim()}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
};

export default BackButton;