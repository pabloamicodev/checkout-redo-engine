import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  primaryAction,
  secondaryActions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-neutral-900 truncate">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {(primaryAction || secondaryActions) && (
        <div className="flex items-center gap-2 shrink-0">
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
