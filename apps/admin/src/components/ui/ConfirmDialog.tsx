"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 w-[340px] mx-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: isDanger ? "#fef2f2" : "#fffbeb" }}
        >
          {isDanger ? (
            <Trash2 className="w-5 h-5 text-red-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          )}
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 mb-1.5">{title}</h3>
        <p className="text-xs text-neutral-500 leading-relaxed mb-5">{description}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-xs font-medium text-neutral-700 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              "flex-1 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors disabled:opacity-60",
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-amber-500 hover:bg-amber-600",
            ].join(" ")}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
