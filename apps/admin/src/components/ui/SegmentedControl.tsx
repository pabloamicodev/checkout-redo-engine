"use client";

import type React from "react";
import { cn } from "@/lib/utils";

interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
}: SegmentedControlProps) {
  return (
    <div className="inline-flex bg-neutral-100 rounded-lg p-0.5 gap-0.5">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md transition-all duration-150",
              size === "sm" ? "text-xs px-2.5 py-1" : "text-sm px-3 py-1.5",
              isActive
                ? "bg-white shadow-sm text-neutral-900 font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            {option.icon && (
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                {option.icon}
              </span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
