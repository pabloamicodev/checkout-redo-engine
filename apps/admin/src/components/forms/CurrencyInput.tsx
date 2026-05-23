"use client";

import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  currency?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
}

function getCurrencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return currency.charAt(0);
  }
}

export function CurrencyInput({
  value,
  onChange,
  currency = "USD",
  label,
  placeholder,
  error,
  disabled,
  min,
  max,
  className,
}: CurrencyInputProps) {
  const symbol = getCurrencySymbol(currency);

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

  return (
    <div className={cn("", className)}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-sm text-neutral-400 pointer-events-none">
          {symbol}
        </span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          className={cn(
            "pl-7 pr-3 py-2 border rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500",
            error
              ? "border-red-400 focus:ring-red-400"
              : "border-neutral-200"
          )}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
