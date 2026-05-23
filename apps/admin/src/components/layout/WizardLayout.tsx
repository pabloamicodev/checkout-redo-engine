"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";

interface WizardLayoutProps {
  /** Sidebar identity */
  title: string;
  subtitle?: string;
  /** Small icon rendered inside an accent-colored badge */
  icon?: ReactNode;
  accentHex?: string;

  /** Step navigation */
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;

  /** Cancel — provide href for link or handler for button */
  cancelHref?: string;
  onCancel?: () => void;

  /** Main form content */
  children: ReactNode;

  /** Optional live-preview panel (hidden on mobile) */
  previewPanel?: ReactNode;
  previewLabel?: string;

  /** Sticky bottom action bar (Back / Continue buttons) */
  stickyActions?: ReactNode;

  className?: string;
}

/**
 * Full-screen wizard shell: sidebar with step nav + form area + optional preview panel + sticky action bar.
 * New wizards should adopt this; existing wizards can migrate incrementally.
 */
export function WizardLayout({
  title,
  subtitle,
  icon,
  accentHex = "#6366f1",
  steps,
  currentStep,
  onStepClick,
  cancelHref,
  onCancel,
  children,
  previewPanel,
  previewLabel = "Preview",
  stickyActions,
  className,
}: WizardLayoutProps) {
  return (
    <div className={cn("flex h-screen overflow-hidden bg-white", className)}>
      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-neutral-200 bg-neutral-50 overflow-hidden">
        {/* Identity */}
        <div className="px-5 pt-5 pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-2.5 mb-1">
            {icon && (
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold"
                style={{ background: accentHex }}
              >
                {icon}
              </span>
            )}
            <span className="text-sm font-semibold text-neutral-900 leading-tight truncate">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-neutral-500 leading-relaxed mt-1">{subtitle}</p>
          )}
        </div>

        {/* Step nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <WizardStepNav
            steps={steps}
            currentStep={currentStep}
            accentHex={accentHex}
            onStepClick={onStepClick}
            orientation="vertical"
          />
        </div>

        {/* Cancel */}
        {(cancelHref || onCancel) && (
          <div className="px-5 py-4 border-t border-neutral-200">
            {cancelHref ? (
              <Link
                href={cancelHref}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </Link>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Form + preview row */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Form */}
          <div
            className={cn(
              "flex-1 overflow-y-auto",
              previewPanel && "border-r border-neutral-200"
            )}
          >
            {children}
          </div>

          {/* Preview panel (desktop only) */}
          {previewPanel && (
            <div className="hidden lg:flex flex-col w-[380px] shrink-0 bg-neutral-50 overflow-y-auto">
              <div className="px-5 py-3 border-b border-neutral-200 sticky top-0 bg-neutral-50 z-10">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                  {previewLabel}
                </p>
              </div>
              <div className="p-5 flex-1">{previewPanel}</div>
            </div>
          )}
        </div>

        {/* Sticky action bar */}
        {stickyActions && (
          <div className="shrink-0 px-6 py-3 border-t border-neutral-200 bg-white flex items-center justify-end gap-3">
            {stickyActions}
          </div>
        )}
      </div>
    </div>
  );
}
