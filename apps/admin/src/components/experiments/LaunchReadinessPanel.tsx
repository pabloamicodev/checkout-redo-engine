import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Lightbulb, Rocket } from "lucide-react";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "block" | "info";
  detail?: string;
}

interface LaunchReadinessPanelProps {
  checks: ReadinessCheck[];
  accentHex?: string;
  className?: string;
}

const STATUS_ICON = {
  pass:  { Icon: CheckCircle2, color: "text-emerald-500" },
  warn:  { Icon: AlertTriangle, color: "text-amber-500"  },
  block: { Icon: XCircle,       color: "text-red-500"    },
  info:  { Icon: Lightbulb,     color: "text-brand-400"  },
};

const STATUS_BG = {
  pass:  "bg-emerald-50 border-emerald-100",
  warn:  "bg-amber-50 border-amber-100",
  block: "bg-red-50 border-red-100",
  info:  "bg-brand-50 border-brand-100",
};

export function LaunchReadinessPanel({ checks, accentHex = "#6366f1", className }: LaunchReadinessPanelProps) {
  const blockers = checks.filter((c) => c.status === "block");
  const warnings = checks.filter((c) => c.status === "warn");
  const passed   = checks.filter((c) => c.status === "pass");
  const score    = Math.round((passed.length / Math.max(checks.length - checks.filter((c) => c.status === "info").length, 1)) * 100);
  const canLaunch = blockers.length === 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Score header */}
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: canLaunch ? "#f0fdf4" : "#fef2f2" }}>
            <Rocket className={cn("w-5 h-5", canLaunch ? "text-emerald-500" : "text-red-400")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {canLaunch ? "Ready to launch" : `${blockers.length} issue${blockers.length !== 1 ? "s" : ""} blocking launch`}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {passed.length}/{passed.length + blockers.length + warnings.length} checks passed
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold" style={{ color: canLaunch ? "#10b981" : "#ef4444" }}>{score}%</span>
          <p className="text-[10px] text-neutral-400">readiness</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: canLaunch ? "#10b981" : accentHex }}
        />
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {checks.map((check) => {
          const { Icon, color } = STATUS_ICON[check.status];
          return (
            <div key={check.id} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", STATUS_BG[check.status])}>
              <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", color)} />
              <div>
                <p className="text-xs font-medium text-neutral-800">{check.label}</p>
                {check.detail && <p className="text-[11px] text-neutral-500 mt-0.5">{check.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
