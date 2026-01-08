"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  id: string;
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
  type?: React.ComponentProps<"input">["type"];
};

const FloatingLabelInput: React.FC<Props> = ({
  id,
  label,
  disabled = false,
  autoFocus = false,
  type = "text",
}) => {
  const [value, setValue] = useState("");

  return (
    <div className="relative">
      <Input
        id={id}
        type={type}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // Use a single-space placeholder to enable :placeholder-shown behavior
        placeholder=" "
        className="peer h-12 text-base"
      />
      <label
        htmlFor={id}
        className="
          pointer-events-none absolute left-3 
          bg-white dark:bg-background px-1
          text-gray-400 
          transition-all duration-200
          // Centered inside when empty
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm
          // Float up on focus
          peer-focus:top-1 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-gray-700
          // Float up when value is present (not placeholder-shown)
          peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:-translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-700
          // Disabled styling
          peer-disabled:text-gray-400
        "
      >
        {label}
      </label>
    </div>
  );
};

export default FloatingLabelInput;