"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ValidationState = "idle" | "valid" | "invalid";

interface URLInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

function validateURL(value: string): ValidationState {
  if (!value) return "idle";
  if (value.startsWith("/")) return "valid";
  try {
    new URL(value);
    return "valid";
  } catch {
    return "invalid";
  }
}

export function URLInput({
  value,
  onChange,
  label,
  placeholder = "https://",
  error,
  disabled,
  className,
}: URLInputProps) {
  const [validationState, setValidationState] = useState<ValidationState>("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    setValidationState("idle");
  }

  function handleBlur() {
    setValidationState(validateURL(value));
  }

  const validationMessage =
    !error && validationState === "invalid"
      ? "Please enter a valid URL (e.g. https://example.com/page)"
      : undefined;

  const displayError = error ?? validationMessage;

  return (
    <div className={cn("", className)}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pl-3 pr-10 py-2 border rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500",
            displayError
              ? "border-red-400 focus:ring-red-400"
              : "border-neutral-200"
          )}
        />
        {validationState === "valid" && (
          <CheckCircle className="absolute right-3 w-4 h-4 text-emerald-500 pointer-events-none" />
        )}
        {validationState === "invalid" && (
          <AlertCircle className="absolute right-3 w-4 h-4 text-red-500 pointer-events-none" />
        )}
      </div>
      {displayError && (
        <p className="text-xs text-red-500 mt-1">{displayError}</p>
      )}
    </div>
  );
}
