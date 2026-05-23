import { XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationSummaryProps {
  errors?: string[];
  warnings?: string[];
  className?: string;
}

export function ValidationSummary({
  errors = [],
  warnings = [],
  className,
}: ValidationSummaryProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-red-800">
            <XCircle className="w-4 h-4" />
            <span>
              {errors.length === 1 ? "1 issue" : `${errors.length} issues`} must be resolved
            </span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-xs text-red-700 flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((warning, index) => (
              <li key={index} className="text-xs text-amber-700 flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
