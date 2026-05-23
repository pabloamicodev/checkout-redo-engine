"use client";

import { useState } from "react";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

interface BannerProps {
  variant: "warning" | "danger" | "info" | "success";
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  icon?: React.ReactNode;
}

const DEFAULT_ICONS: Record<BannerProps["variant"], React.ReactNode> = {
  warning: <AlertTriangle className="w-4 h-4" />,
  danger:  <XCircle className="w-4 h-4" />,
  info:    <Info className="w-4 h-4" />,
  success: <CheckCircle2 className="w-4 h-4" />,
};

const variantClasses: Record<
  BannerProps["variant"],
  { wrapper: string; title: string; body: string }
> = {
  warning: {
    wrapper: "bg-amber-50 border-amber-200",
    title: "text-amber-800",
    body: "text-amber-800",
  },
  danger: {
    wrapper: "bg-red-50 border-red-200",
    title: "text-red-800",
    body: "text-red-800",
  },
  info: {
    wrapper: "bg-blue-50 border-blue-200",
    title: "text-blue-700",
    body: "text-blue-700",
  },
  success: {
    wrapper: "bg-green-50 border-green-200",
    title: "text-green-800",
    body: "text-green-800",
  },
};

export function Banner({
  variant,
  title,
  children,
  dismissible = false,
  icon,
}: BannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const classes = variantClasses[variant];

  return (
    <div
      className={`w-full border px-6 py-3 flex items-start gap-3 ${classes.wrapper}`}
    >
      <span className={`shrink-0 mt-0.5 ${classes.body}`}>
        {icon ?? DEFAULT_ICONS[variant]}
      </span>
      <div className="flex-1 flex flex-wrap gap-x-2 items-baseline min-w-0">
        {title && (
          <span className={`font-semibold text-sm ${classes.title}`}>
            {title}
          </span>
        )}
        <span className={`text-sm ${classes.body}`}>{children}</span>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className={`shrink-0 ml-2 text-lg leading-none opacity-60 hover:opacity-100 transition-opacity ${classes.body}`}
        >
          &times;
        </button>
      )}
    </div>
  );
}
