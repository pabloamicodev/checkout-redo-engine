"use client";

import { cn } from "@/lib/utils";

interface PercentageInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
}

export function PercentageInput({
  value,
  onChange,
  label,
  placeholder,
  error,
  disabled,
  min = 0,
  max = 100,
  className,
}: PercentageInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      onChange("");
    } else {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") return;
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > max) {
      onChange(max);
    }
  }

  return (
    <div className={cn("", className)}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          className={cn(
            "pl-3 pr-8 py-2 border rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500",
            error
              ? "border-red-400 focus:ring-red-400"
              : "border-neutral-200"
          )}
        />
        <span className="absolute right-3 text-sm text-neutral-400 pointer-events-none">
          %
        </span>
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
