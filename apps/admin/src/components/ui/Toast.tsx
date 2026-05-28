"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    success: (message) => addToast("success", message),
    error: (message) => addToast("error", message),
    warning: (message) => addToast("warning", message),
    info: (message) => addToast("info", message),
  };

  const container = (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Render via portal so fixed positioning is always relative to viewport */}
      {typeof document !== "undefined" ? createPortal(container, document.body) : container}
    </ToastContext.Provider>
  );
}

const toastConfig: Record<
  ToastType,
  { icon: React.ReactNode; bg: string; border: string; text: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4 text-success-600" />,
    bg: "bg-success-50",
    border: "border-success-200",
    text: "text-success-800",
  },
  error: {
    icon: <XCircle className="w-4 h-4 text-danger-600" />,
    bg: "bg-danger-50",
    border: "border-danger-200",
    text: "text-danger-800",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-warning-600" />,
    bg: "bg-warning-50",
    border: "border-warning-200",
    text: "text-warning-800",
  },
  info: {
    icon: <Info className="w-4 h-4 text-brand-600" />,
    bg: "bg-brand-50",
    border: "border-brand-200",
    text: "text-brand-800",
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const config = toastConfig[toast.type];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3.5 py-3 rounded-xl border shadow-md animate-slide-in-up pointer-events-auto",
        config.bg,
        config.border
      )}
    >
      <span className="shrink-0 mt-px">{config.icon}</span>
      <p className={cn("text-sm font-medium flex-1", config.text)}>
        {toast.message}
      </p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-neutral-400 hover:text-neutral-600 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
