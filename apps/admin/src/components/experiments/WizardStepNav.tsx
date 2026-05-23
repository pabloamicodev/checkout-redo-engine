"use client";
import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

export interface WizardStep {
  label: string;
  sublabel?: string;
  status?: "pending" | "complete" | "error" | "active";
}

interface WizardStepNavProps {
  steps: WizardStep[];
  currentStep: number;
  accentHex?: string;
  onStepClick?: (index: number) => void;
  orientation?: "vertical" | "horizontal";
}

export function WizardStepNav({
  steps,
  currentStep,
  accentHex = "#6366f1",
  onStepClick,
  orientation = "horizontal",
}: WizardStepNavProps) {
  if (orientation === "vertical") {
    return (
      <nav className="space-y-1">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          const isError = step.status === "error";
          const clickable = onStepClick && (isDone || isActive);
          return (
            <button
              key={i}
              type="button"
              onClick={() => clickable && onStepClick(i)}
              disabled={!clickable}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                isActive ? "bg-neutral-100" : isDone ? "hover:bg-neutral-50" : "opacity-50 cursor-default",
              )}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors"
                style={isDone ? { background: accentHex, color: "#fff" } : isActive ? { background: `${accentHex}18`, color: accentHex, outline: `2px solid ${accentHex}` } : {}}
              >
                {isDone ? <Check className="w-2.5 h-2.5" /> : isError ? <AlertCircle className="w-2.5 h-2.5" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-xs font-medium leading-none truncate", isActive ? "text-neutral-900" : isDone ? "text-neutral-600" : "text-neutral-400")}>
                  {step.label}
                </p>
                {step.sublabel && <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{step.sublabel}</p>}
              </div>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        const isError = step.status === "error";
        const clickable = onStepClick && isDone;
        return (
          <div key={i} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => clickable && onStepClick(i)}
              disabled={!clickable && !isActive}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                isActive ? "font-semibold" : isDone ? "text-neutral-500 hover:text-neutral-800" : "text-neutral-300 cursor-default"
              )}
              style={isActive ? { color: accentHex } : {}}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                style={
                  isDone   ? { background: accentHex, color: "#fff" } :
                  isError  ? { background: "#ef4444", color: "#fff" } :
                  isActive ? { background: `${accentHex}18`, color: accentHex, outline: `2px solid ${accentHex}`, outlineOffset: "1px" } :
                  {}
                }
              >
                {isDone ? <Check className="w-2.5 h-2.5" /> : isError ? <AlertCircle className="w-2.5 h-2.5" /> : i + 1}
              </span>
              {step.label}
            </button>
            {i < steps.length - 1 && (
              <span className="w-4 h-px bg-neutral-200 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
