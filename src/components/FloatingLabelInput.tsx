"use client";

import React, { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";

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
        placeholder=" "
        className={`peer h-12 text-base ${className ?? ""}`}
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
    </div>
  );
});

export default FloatingLabelInput;