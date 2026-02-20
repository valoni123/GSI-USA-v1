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
      className={["text-white hover:bg-white/10", className || ""].join(" ").trim()}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
};

export default BackButton;