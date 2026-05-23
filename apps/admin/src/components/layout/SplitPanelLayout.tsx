import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SplitPanelLayoutProps {
  left: ReactNode;
  right: ReactNode;
  rightLabel?: string;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
}

/**
 * Two-column layout: form on the left, live preview on the right.
 * On mobile (< lg) the panels stack vertically, preview below.
 */
export function SplitPanelLayout({
  left,
  right,
  rightLabel,
  className,
  leftClassName,
  rightClassName,
}: SplitPanelLayoutProps) {
  return (
    <div className={cn("flex flex-col lg:flex-row flex-1 min-h-0", className)}>
      {/* Form area */}
      <div className={cn("flex-1 min-w-0 overflow-y-auto", leftClassName)}>
        {left}
      </div>

      {/* Preview panel */}
      <div
        className={cn(
          "w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-200 bg-neutral-50 overflow-y-auto",
          rightClassName
        )}
      >
        {rightLabel && (
          <div className="px-5 py-3 border-b border-neutral-200 sticky top-0 bg-neutral-50 z-10">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
              {rightLabel}
            </p>
          </div>
        )}
        {right}
      </div>
    </div>
  );
}
