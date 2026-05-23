"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Check,
  ChevronRight,
  Code,
  ExternalLink,
  FlaskConical,
  ShoppingCart,
  Zap,
  CreditCard,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingStatus {
  billingActive: boolean;
  billingPlan: string;
  billingTrialing: boolean;
  eventsFlowing: boolean;
  lastEventReceivedAt: string | null;
  recentEvent: boolean;
  webhooksReceiving: boolean;
  ordersAttributing: boolean;
  hasRunningExperiment: boolean;
  runningExperimentCount: number;
  installedAt: string | null;
  scopesGranted: boolean;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  actionHref?: string;
  autoDetect?: (status: OnboardingStatus) => boolean;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

function getSteps(status: OnboardingStatus | null): Step[] {
  return [
    {
      id: "billing",
      title: "Activate your plan",
      description:
        status?.billingTrialing
          ? "You're on a free trial. Upgrade to keep access after the trial ends."
          : status?.billingActive && status.billingPlan !== "free"
          ? `You're on the ${status.billingPlan} plan. ✓`
          : "Choose a plan to unlock the full power of MarginLab A/B testing.",
      icon: <CreditCard className="w-5 h-5" />,
      action: status?.billingActive && status?.billingPlan !== "free" ? undefined : "View plans",
      actionHref: "/billing",
      autoDetect: (s) => s.billingActive,
    },
    {
      id: "pixel",
      title: "Enable the MarginLab pixel",
      description:
        "The Web Pixel tracks visitor behavior across your storefront — page views, add to carts, checkout events. Enable it from your Shopify admin under Customer Events.",
      icon: <Zap className="w-5 h-5" />,
      action: "Open Shopify Customer Events",
      actionHref: "https://admin.shopify.com/store/customer-events",
      autoDetect: (s) => s.eventsFlowing,
    },
    {
      id: "theme",
      title: "Enable the theme extension",
      description:
        "The MarginLab Theme Extension connects the storefront runtime to your experiments. Add it to your current theme via the Theme Editor.",
      icon: <Code className="w-5 h-5" />,
      action: "Open Theme Editor",
      actionHref: "https://admin.shopify.com/store/themes",
      autoDetect: (s) => s.recentEvent,
    },
    {
      id: "cogs",
      title: "Import your product costs (optional)",
      description:
        "Upload a CSV or sync from Shopify to track gross profit per experiment. Without COGS data, revenue metrics still work but profit per visitor won't.",
      icon: <ShoppingCart className="w-5 h-5" />,
      action: "Go to COGS",
      actionHref: "/cogs",
    },
    {
      id: "experiment",
      title: "Create your first A/B test",
      description:
        status?.hasRunningExperiment
          ? `You have ${status.runningExperimentCount} running experiment${status.runningExperimentCount !== 1 ? "s" : ""}. ✓`
          : "Set up a price test, discount test, or content test. Results appear in analytics as soon as visitors start coming through.",
      icon: <FlaskConical className="w-5 h-5" />,
      action: status?.hasRunningExperiment ? "View experiments" : "Create experiment",
      actionHref: "/experiments",
      autoDetect: (s) => s.hasRunningExperiment,
    },
  ];
}

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const LS_KEY = "marginlab_onboarding_completed";

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveCompleted(completed: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...completed]));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  // Fetch real health status
  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: OnboardingStatus) => { if (!cancelled) setStatus(data); })
      .catch(() => { /* fail silently */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Load persisted completed state
  useEffect(() => { setCompleted(loadCompleted()); }, []);

  // Auto-mark steps detected as complete
  useEffect(() => {
    if (!status) return;
    setCompleted((prev) => {
      const next = new Set(prev);
      for (const step of getSteps(status)) {
        if (step.autoDetect?.(status)) next.add(step.id);
      }
      saveCompleted(next);
      return next;
    });
  }, [status]);

  function toggle(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveCompleted(next);
      return next;
    });
  }

  const steps = getSteps(status);
  const allDone = !loading && steps.every((s) => completed.has(s.id));

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Welcome to MarginLab</h1>
          <p className="text-neutral-500">
            Complete these steps to start optimizing your store&apos;s conversion rate and profitability.
          </p>
        </div>

        {/* Billing warning */}
        {!loading && status && !status.billingActive && (
          <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Your subscription is inactive</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Some features are paused. Update your billing to restore access.
              </p>
              <a href="/billing" className="text-xs font-medium text-amber-800 underline mt-1 inline-block">
                Update billing →
              </a>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700">Setup progress</span>
            <span className="text-sm text-neutral-500">{completed.size} / {steps.length}</span>
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${(completed.size / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Checking your setup…</span>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, i) => {
              const done = completed.has(step.id);
              const autoComplete = status ? (step.autoDetect?.(status) ?? false) : false;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "bg-white border rounded-xl p-5 transition-all",
                    done ? "border-success-300 bg-success-50/30" : "border-neutral-200"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => !autoComplete && toggle(step.id)}
                      disabled={autoComplete}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors",
                        done
                          ? "bg-success-500 border-success-500 text-white"
                          : "border-neutral-300 text-neutral-400 hover:border-brand-400",
                        autoComplete && "cursor-default"
                      )}
                    >
                      {done ? <Check className="w-4 h-4" /> : <span className="text-xs font-semibold">{i + 1}</span>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-neutral-400", done && "text-success-500")}>{step.icon}</span>
                        <p className={cn("text-sm font-semibold", done ? "text-success-700" : "text-neutral-900")}>
                          {step.title}
                        </p>
                        {autoComplete && (
                          <span className="text-xs text-success-600 bg-success-100 px-1.5 py-0.5 rounded-full">
                            Detected ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mb-3">{step.description}</p>
                      {step.action && step.actionHref && (
                        <a
                          href={step.actionHref}
                          target={step.actionHref.startsWith("http") ? "_blank" : undefined}
                          rel={step.actionHref.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          {step.action}
                          {step.actionHref.startsWith("http") ? (
                            <ExternalLink className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          {allDone ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-success-600 font-medium">
                <Check className="w-4 h-4" />
                All set! Your store is ready for A/B testing.
              </div>
              <Button onClick={() => router.push("/experiments/new")}>
                Create your first experiment
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              Skip for now, go to dashboard
            </Button>
          )}
        </div>

        <div className="mt-6 text-center">
          <a href="/install-health" className="text-xs text-neutral-400 hover:text-neutral-600">
            View full install health report →
          </a>
        </div>
      </div>
    </div>
  );
}

