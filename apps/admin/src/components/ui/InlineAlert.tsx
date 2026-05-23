"use client";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, XCircle, X } from "lucide-react";
import { useState } from "react";

type AlertVariant = "info" | "warning" | "danger" | "success";

const STYLES: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  info:    { bg: "bg-brand-50",   border: "border-brand-200",   text: "text-brand-800",   icon: "text-brand-500"   },
  warning: { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-800",   icon: "text-amber-500"   },
  danger:  { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-800",     icon: "text-red-500"     },
  success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: "text-emerald-500" },
};

const ICONS: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  info:    Info,
  warning: AlertTriangle,
  danger:  XCircle,
  success: CheckCircle2,
};

interface InlineAlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  className?: string;
}

export function InlineAlert({ variant = "info", title, children, dismissible = false, className }: InlineAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const s = STYLES[variant];
  const Icon = ICONS[variant];

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", s.bg, s.border, className)}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", s.icon)} />
      <div className={cn("flex-1 text-sm", s.text)}>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
      {dismissible && (
        <button onClick={() => setDismissed(true)} className={cn("shrink-0 opacity-60 hover:opacity-100 transition-opacity", s.text)}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
