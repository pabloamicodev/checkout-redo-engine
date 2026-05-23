export interface StatusConfig {
  label: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  hex: string;
}

export const STATUS_THEME: Record<string, StatusConfig> = {
  RUNNING: { label: "Running", dotColor: "bg-emerald-500", textColor: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-100", hex: "#10b981" },
  ACTIVE:  { label: "Active",  dotColor: "bg-emerald-500", textColor: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-100", hex: "#10b981" },
  DRAFT:   { label: "Draft",   dotColor: "bg-neutral-300", textColor: "text-neutral-500", bgColor: "bg-neutral-100", borderColor: "border-neutral-200", hex: "#94a3b8" },
  PAUSED:  { label: "Paused",  dotColor: "bg-amber-400",   textColor: "text-amber-700",   bgColor: "bg-amber-50",   borderColor: "border-amber-100",   hex: "#f59e0b" },
  SCHEDULED: { label: "Scheduled", dotColor: "bg-sky-400", textColor: "text-sky-700", bgColor: "bg-sky-50", borderColor: "border-sky-100", hex: "#0ea5e9" },
  COMPLETED: { label: "Completed", dotColor: "bg-brand-400", textColor: "text-brand-700", bgColor: "bg-brand-50", borderColor: "border-brand-100", hex: "#6366f1" },
  ARCHIVED:  { label: "Archived",  dotColor: "bg-neutral-300", textColor: "text-neutral-400", bgColor: "bg-neutral-50", borderColor: "border-neutral-200", hex: "#64748b" },
  QA:        { label: "QA",        dotColor: "bg-violet-400", textColor: "text-violet-700", bgColor: "bg-violet-50", borderColor: "border-violet-100", hex: "#7c3aed" },
  PREVIEW:   { label: "Preview",   dotColor: "bg-sky-400",    textColor: "text-sky-700",    bgColor: "bg-sky-50",    borderColor: "border-sky-100",    hex: "#0ea5e9" },
  ERROR:     { label: "Error",     dotColor: "bg-red-500",    textColor: "text-red-700",    bgColor: "bg-red-50",    borderColor: "border-red-100",    hex: "#ef4444" },
  NEEDS_ATTENTION: { label: "Needs attention", dotColor: "bg-orange-400", textColor: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-100", hex: "#f97316" },
};

export function getStatusTheme(status: string): StatusConfig {
  return STATUS_THEME[status] ?? {
    label: status,
    dotColor: "bg-neutral-300",
    textColor: "text-neutral-500",
    bgColor: "bg-neutral-100",
    borderColor: "border-neutral-200",
    hex: "#94a3b8",
  };
}
