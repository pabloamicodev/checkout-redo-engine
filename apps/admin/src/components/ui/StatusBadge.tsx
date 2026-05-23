import { Play, Pause, Clock, FilePen, CheckCircle2, Archive, FlaskConical, Eye, XCircle, AlertTriangle, Circle } from "lucide-react";
import { getStatusTheme } from "@/lib/design/statusTheme";

interface StatusBadgeProps {
  status: string;
  pulse?: boolean;
  size?: "sm" | "md";
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  RUNNING:          Play,
  ACTIVE:           Play,
  DRAFT:            FilePen,
  PAUSED:           Pause,
  SCHEDULED:        Clock,
  COMPLETED:        CheckCircle2,
  ARCHIVED:         Archive,
  QA:               FlaskConical,
  PREVIEW:          Eye,
  ERROR:            XCircle,
  NEEDS_ATTENTION:  AlertTriangle,
};

export function StatusBadge({ status, pulse, size = "md" }: StatusBadgeProps) {
  const st = getStatusTheme(status);
  const shouldPulse = pulse ?? (status === "RUNNING" || status === "ACTIVE");
  const textSizeClass = size === "sm" ? "text-[10px]" : "text-xs";
  const iconSizeClass = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";
  const StatusIcon = STATUS_ICONS[status] ?? Circle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${textSizeClass}`}
      style={{
        background: `${st.hex}12`,
        color: st.hex,
        borderColor: `${st.hex}25`,
      }}
    >
      <StatusIcon
        className={`${iconSizeClass} shrink-0 ${shouldPulse ? "animate-pulse" : ""}`}
      />
      {st.label}
    </span>
  );
}
