import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  accentHex?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  accentHex = "#6366f1",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      {icon && (
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${accentHex}12`, color: accentHex }}
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-neutral-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-400 max-w-sm mb-5 leading-relaxed">{description}</p>
      )}
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button
              size="sm"
              style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)` }}
              className="text-white border-0 hover:opacity-90"
            >
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button
            onClick={action.onClick}
            size="sm"
            style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)` }}
            className="text-white border-0 hover:opacity-90"
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
