import type React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

interface Variant {
  name: string;
  isControl: boolean;
  allocation: number;
}

interface TargetingRule {
  type: string;
  value: unknown;
}

interface Schedule {
  startDate?: string;
  endDate?: string;
}

interface ReviewSummaryPanelProps {
  name: string;
  hypothesis?: string;
  type: string;
  variants: Variant[];
  targetingRules?: TargetingRule[];
  schedule?: Schedule;
  className?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

export function ReviewSummaryPanel({
  name,
  hypothesis,
  type,
  variants,
  targetingRules,
  schedule,
  className,
}: ReviewSummaryPanelProps) {
  return (
    <div
      className={cn(
        "space-y-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200",
        className
      )}
    >
      {/* Test Overview */}
      <div>
        <SectionLabel>Test Overview</SectionLabel>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{name}</span>
            <Badge variant="info">{type}</Badge>
          </div>
          {hypothesis && (
            <p className="text-sm italic text-neutral-500">{hypothesis}</p>
          )}
        </div>
      </div>

      {/* Variants */}
      <div>
        <SectionLabel>Variants</SectionLabel>
        <div className="space-y-2">
          {variants.map((variant, index) => (
            <div key={index} className="text-sm">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-neutral-700">{variant.name}</span>
                {variant.isControl && (
                  <Badge variant="neutral">Control</Badge>
                )}
                <span className="ml-auto text-xs text-neutral-500">
                  {variant.allocation}%
                </span>
              </div>
              <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full"
                  style={{ width: `${variant.allocation}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Targeting */}
      {targetingRules && (
        <div>
          <SectionLabel>Targeting</SectionLabel>
          <p className="text-sm text-neutral-700">
            {targetingRules.length === 0
              ? "All visitors"
              : `${targetingRules.length} rule${targetingRules.length === 1 ? "" : "s"} applied`}
          </p>
        </div>
      )}

      {/* Schedule */}
      {schedule && (
        <div>
          <SectionLabel>Schedule</SectionLabel>
          {schedule.startDate || schedule.endDate ? (
            <p className="text-sm text-neutral-700">
              {schedule.startDate && (
                <span>Starts {new Date(schedule.startDate).toLocaleDateString()}</span>
              )}
              {schedule.startDate && schedule.endDate && <span> &mdash; </span>}
              {schedule.endDate && (
                <span>Ends {new Date(schedule.endDate).toLocaleDateString()}</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-neutral-700">Runs continuously</p>
          )}
        </div>
      )}
    </div>
  );
}
