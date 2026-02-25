"use client";

import React, { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

type Props = {
  id: string;
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
  type?: React.ComponentProps<"input">["type"];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  inputMode?: React.ComponentProps<"input">["inputMode"];
};

const FloatingLabelInput = forwardRef<HTMLInputElement, Props>(function FloatingLabelInput(
  {
    id,
    label,
    disabled = false,
    autoFocus = false,
    type = "text",
    value,
    onChange,
    onBlur,
    className,
    onFocus,
    onClick,
    onKeyDown,
    onClear,
    onPaste,
    inputMode,
  },
  ref
) {
  const [internal, setInternal] = useState("");
  const val = value ?? internal;

  return (
    <div className="relative">
      <Input
        id={id}
        ref={ref}
        type={type}
        autoFocus={autoFocus}
        disabled={disabled}
        value={val}
        onChange={(e) => {
          setInternal(e.target.value);
          onChange?.(e);
        }}
        onBlur={onBlur}
        onFocus={onFocus}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        inputMode={inputMode}
        placeholder=" "
        className={`peer h-12 text-base pr-10 ${className ?? ""}`}
      />
      <label
        htmlFor={id}
        className="
          pointer-events-none absolute left-3
          bg-white dark:bg-background px-1 rounded-sm
          text-gray-400
          transition-all duration-200
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm
          peer-focus:-top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-gray-700
          peer-[:not(:placeholder-shown)]:-top-3 peer-[:not(:placeholder-shown)]:-translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-700
          peer-disabled:text-gray-400
        "
      >
        {label}
      </label>

      {onClear && !disabled && (val ?? "").trim().length > 0 && (
        <button
          type="button"
          aria-label="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          onClick={() => {
            if (value === undefined) setInternal("");
            onClear();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

export default FloatingLabelInput;