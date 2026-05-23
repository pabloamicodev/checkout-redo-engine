"use client";
import { cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

interface StickyFormActionsProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft?: () => void;
  canContinue?: boolean;
  canSaveDraft?: boolean;
  isLastStep?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  continueLabel?: string;
  accentHex?: string;
  blockingIssue?: string;
  blockingCount?: number;
  className?: string;
}

export function StickyFormActions({
  step,
  totalSteps,
  onBack,
  onNext,
  onSaveDraft,
  canContinue = true,
  canSaveDraft = true,
  isLastStep = false,
  isSubmitting = false,
  submitLabel = "Create test",
  continueLabel,
  accentHex = "#6366f1",
  blockingIssue,
  blockingCount,
  className,
}: StickyFormActionsProps) {
  const issueLabel =
    blockingCount != null && blockingCount > 1
      ? `Fix ${blockingCount} blocking issues first`
      : blockingIssue;
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-between gap-3",
        "bg-white/95 backdrop-blur-sm border-t border-neutral-100 px-6 py-3",
        "[padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-sm text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 0 ? "Cancel" : "Back"}
        </button>

        {onSaveDraft && step > 0 && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={!canSaveDraft || isSubmitting}
            className="px-3 py-1.5 min-h-[44px] text-xs font-medium text-neutral-500 hover:text-neutral-700 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors disabled:opacity-40"
          >
            Save draft
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {issueLabel && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {issueLabel}
          </div>
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue || isSubmitting}
          className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-semibold text-white rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canContinue ? `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}dd 100%)` : undefined, backgroundColor: !canContinue ? "#e5e7eb" : undefined }}
          title={issueLabel ?? undefined}
        >
          {isSubmitting ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
          ) : isLastStep ? (
            <>{submitLabel}</>
          ) : (
            <>{continueLabel ?? "Continue"} <ChevronRight className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
    </div>
  );
}
