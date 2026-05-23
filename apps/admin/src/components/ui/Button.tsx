import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-400/40 shadow-sm active:scale-95",
  secondary:
    "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 focus:ring-brand-400/30 shadow-card",
  ghost:
    "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-200",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-400/40 shadow-sm active:scale-95",
  outline:
    "border border-brand-200 text-brand-600 hover:bg-brand-50 hover:border-brand-300 focus:ring-brand-400/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          iconPosition === "left" && icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
        {!loading && iconPosition === "right" && icon && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
