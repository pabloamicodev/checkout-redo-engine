import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  accent?: string; // hex color for left border accent
}

export function FormSection({ title, description, children, className, accent }: FormSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        {accent && (
          <div className="w-0.5 self-stretch rounded-full mt-1" style={{ background: accent }} />
        )}
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {description && <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, hint, error, required, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-neutral-400 leading-relaxed">{hint}</p>}
      {error && <p className="text-[11px] text-red-600 flex items-center gap-1">{error}</p>}
    </div>
  );
}
