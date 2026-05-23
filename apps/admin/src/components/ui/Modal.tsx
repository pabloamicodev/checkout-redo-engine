"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  footer,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      // Focus first focusable element after paint
      requestAnimationFrame(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
        first?.focus();
      });
    } else {
      document.body.style.overflow = "";
      (previousFocusRef.current as HTMLElement | null)?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full bg-white rounded-2xl shadow-xl animate-slide-in-up",
          sizeClasses[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                {title && (
                  <h2 id="modal-title" className="text-base font-semibold text-neutral-900">{title}</h2>
                )}
                {description && (
                  <p className="text-sm text-neutral-500 mt-0.5">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ConfirmDestructiveModal ─────────────────────────────────────────────────

interface ConfirmDestructiveModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "warning";
  /** If provided, user must type this exact string to enable the Confirm button */
  requiredPhrase?: string;
  loading?: boolean;
}

export function ConfirmDestructiveModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  requiredPhrase,
  loading = false,
}: ConfirmDestructiveModalProps) {
  const [phrase, setPhrase] = useState("");

  const phraseMatches = !requiredPhrase || phrase === requiredPhrase;
  const canConfirm = phraseMatches && !loading;

  const iconBg = confirmVariant === "danger" ? "#fee2e2" : "#fef9c3";
  const iconColor = confirmVariant === "danger" ? "#dc2626" : "#ca8a04";
  const iconSymbol = confirmVariant === "danger" ? "🔴" : "⚠️";

  const confirmBtnClass =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-400/40 text-white shadow-sm"
      : "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400/40 text-white shadow-sm";

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <button
            onClick={() => void onConfirm()}
            disabled={!canConfirm}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2",
              confirmBtnClass,
              !canConfirm && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
            style={{ background: iconBg, color: iconColor }}
          >
            {iconSymbol}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-neutral-900">{title}</p>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Required phrase input */}
        {requiredPhrase && (
          <div className="space-y-1.5">
            <label className="block text-xs text-neutral-500">
              Type <span className="font-mono font-semibold text-neutral-700">{requiredPhrase}</span> to confirm
            </label>
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={`Type: ${requiredPhrase}`}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40 focus:border-red-300"
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── DiscardChangesModal ─────────────────────────────────────────────────────

export function DiscardChangesModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDestructiveModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Discard unsaved changes?"
      description="You have unsaved changes. If you leave this page, your progress will be lost."
      confirmLabel="Discard changes"
      confirmVariant="warning"
    />
  );
}

// ─── ArchiveRunningTestModal ─────────────────────────────────────────────────

export function ArchiveRunningTestModal({
  open,
  onClose,
  onConfirm,
  testName,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  testName: string;
  loading?: boolean;
}) {
  return (
    <ConfirmDestructiveModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Archive running test?"
      description="This test is currently running. Archiving will stop data collection and the test cannot be restarted. Historical data will be preserved."
      confirmLabel="Archive test"
      confirmVariant="danger"
      requiredPhrase={testName}
      loading={loading}
    />
  );
}

// ─── RolloutWinnerModal ──────────────────────────────────────────────────────

export function RolloutWinnerModal({
  open,
  onClose,
  onConfirm,
  testName,
  winnerVariantName,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  testName: string;
  winnerVariantName: string;
  loading?: boolean;
}) {
  return (
    <ConfirmDestructiveModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Roll out winner — this is irreversible"
      description={`Rolling out '${winnerVariantName}' will permanently apply its configuration to all visitors. This action cannot be undone.`}
      confirmLabel={`Roll out ${winnerVariantName}`}
      confirmVariant="danger"
      requiredPhrase={testName}
      loading={loading}
    />
  );
}

// ─── EditRunningTestModal ────────────────────────────────────────────────────

export function EditRunningTestModal({
  open,
  onClose,
  onConfirm,
  settingName,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  settingName?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <button
            onClick={() => void onConfirm()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-50"
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            Save anyway
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base bg-amber-50 text-amber-600">
            ⚠️
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-neutral-900">
              Editing a running test
            </p>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              {settingName
                ? `Changing "${settingName}" while the test is live`
                : "Changing this setting while the test is live"}{" "}
              may invalidate existing data and skew results. Consider pausing the test before making changes.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <></>
    </Modal>
  );
}
