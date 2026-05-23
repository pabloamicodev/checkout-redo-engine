import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-700 border border-neutral-200",
  success: "bg-success-50 text-success-700 border border-success-100",
  warning: "bg-warning-50 text-warning-600 border border-warning-100",
  danger: "bg-danger-50 text-danger-700 border border-danger-100",
  info: "bg-brand-50 text-brand-700 border border-brand-100",
  neutral: "bg-neutral-100 text-neutral-500 border border-neutral-200",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-neutral-400",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-brand-500",
  neutral: "bg-neutral-400",
};

export function Badge({ variant = "default", children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "badge",
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full mr-1.5",
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}

export function ExperimentStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    DRAFT: "neutral",
    QA: "warning",
    PREVIEW: "info",
    SCHEDULED: "info",
    RUNNING: "success",
    PAUSED: "warning",
    COMPLETED: "default",
    ARCHIVED: "neutral",
  };

  return (
    <Badge variant={map[status] ?? "default"} dot>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}
