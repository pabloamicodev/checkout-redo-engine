import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({ children, className, padding = "md" }: CardProps) {
  return (
    <div className={cn("card", paddingClasses[padding], className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-sm font-semibold text-neutral-800", className)}>
      {children}
    </h3>
  );
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  iconColor,
  iconBg,
  className,
}: {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  className?: string;
}) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <Card className={cn("shadow-card", className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: iconBg ?? "rgba(99,102,241,0.08)",
              color: iconColor ?? "#6366f1",
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-neutral-900 tracking-tight">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          <span
            className={cn(
              "text-xs font-medium",
              isPositive ? "text-success-600" : "text-danger-600"
            )}
          >
            {isPositive ? "+" : ""}
            {(change * 100).toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-xs text-neutral-400">{changeLabel}</span>
          )}
        </div>
      )}
    </Card>
  );
}
