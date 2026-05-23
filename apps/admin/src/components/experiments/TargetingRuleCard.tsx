"use client";

import type React from "react";
import {
  Monitor,
  Globe,
  Link,
  Share2,
  ShoppingCart,
  Calendar,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TargetingRule {
  type: string;
  operator?: string;
  value: unknown;
}

interface TargetingRuleCardProps {
  rule: TargetingRule;
  onRemove?: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  device: <Monitor className="w-4 h-4" />,
  country: <Globe className="w-4 h-4" />,
  url: <Link className="w-4 h-4" />,
  utm_source: <Share2 className="w-4 h-4" />,
  cart_value: <ShoppingCart className="w-4 h-4" />,
  date_range: <Calendar className="w-4 h-4" />,
};

function formatTypeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TargetingRuleCard({ rule, onRemove }: TargetingRuleCardProps) {
  const icon = TYPE_ICONS[rule.type] ?? <Filter className="w-4 h-4" />;

  return (
    <div className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500 flex-shrink-0">{icon}</span>
        <div>
          <span className="text-sm text-neutral-700 font-medium">
            {formatTypeLabel(rule.type)}
          </span>
          {(rule.operator || rule.value !== undefined) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {rule.operator && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-xs text-neutral-500">
                  {rule.operator}
                </span>
              )}
              {rule.value !== undefined && (
                <span className="text-xs text-neutral-500">
                  {formatValue(rule.value)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "p-1 rounded transition-colors text-neutral-400 hover:text-red-500"
          )}
          aria-label="Remove rule"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
