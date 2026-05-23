import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NoDataStateProps {
  type: "no_events" | "no_orders" | "insufficient_sample" | "zero_traffic";
  experimentId?: string;
  className?: string;
  daysRemaining?: number;
  currentSample?: number;
  requiredSample?: number;
}

export function NoDataState({
  type,
  experimentId,
  className,
  daysRemaining,
  currentSample,
  requiredSample,
}: NoDataStateProps) {
  const configs: Record<
    NoDataStateProps["type"],
    {
      icon: typeof BarChart3;
      title: string;
      description: string;
      actions: { label: string; href: string }[];
    }
  > = {
    no_events: {
      icon: BarChart3,
      title: "No events received yet",
      description:
        "The analytics tracking script may not be firing. Check the Web Pixel and Theme App Embed are active.",
      actions: experimentId ? [{ label: "Open debug tools", href: "/debug" }] : [],
    },
    no_orders: {
      icon: BarChart3,
      title: "No orders attributed yet",
      description:
        "Orders are attributed within a 30-day window after the first assignment. Check back later.",
      actions: [],
    },
    insufficient_sample: {
      icon: BarChart3,
      title: "Building statistical confidence",
      description:
        currentSample && requiredSample
          ? `${currentSample.toLocaleString()} of ${requiredSample.toLocaleString()} visitors reached — ${Math.round((currentSample / requiredSample) * 100)}% to minimum sample size.`
          : "More traffic is needed before results are statistically significant.",
      actions: daysRemaining ? [{ label: `~${daysRemaining} days estimated`, href: "" }] : [],
    },
    zero_traffic: {
      icon: BarChart3,
      title: "No traffic detected",
      description:
        "This test has been running for over 1 hour with no visitor assignments. Verify your targeting rules and theme installation.",
      actions: [{ label: "Check install health", href: "/install-health" }],
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-neutral-400" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-800">{config.title}</h3>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm">{config.description}</p>
      {config.actions.filter((a) => a.href).length > 0 && (
        <div className="mt-4 flex gap-3">
          {config.actions
            .filter((a) => a.href)
            .map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="text-sm text-brand-600 hover:text-brand-700 underline"
              >
                {a.label}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
