"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = "ok" | "error" | "warning" | "pending";

interface HealthCheck {
  id: string;
  label: string;
  explanation: string;
  impact: string;
  status: CheckStatus;
  fixLabel?: string;
  fixHref?: string;
  supportSuggested?: boolean;
  devDetail?: string;
}

// ---------------------------------------------------------------------------
// Status display helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "Active",
  warning: "Check needed",
  error: "Issue",
  pending: "Not set up",
};

const STATUS_COLORS: Record<CheckStatus, string> = {
  ok: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  error: "bg-danger-50 text-danger-700",
  pending: "bg-neutral-100 text-neutral-500",
};

function HealthIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />;
    case "error":
      return <XCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />;
    case "warning":
      return <AlertCircle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />;
    case "pending":
      return <Clock className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />;
  }
}

// ---------------------------------------------------------------------------
// Individual check row
// ---------------------------------------------------------------------------

function HealthCheckRow({ check }: { check: HealthCheck }) {
  const [devOpen, setDevOpen] = useState(false);

  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-neutral-100 last:border-0",
        check.status === "error" && "bg-danger-50/30",
        check.status === "warning" && "bg-warning-50/20",
      )}
    >
      <div className="flex items-start gap-4">
        <HealthIcon status={check.status} />

        <div className="flex-1 min-w-0">
          {/* Label + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-neutral-900">{check.label}</p>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                STATUS_COLORS[check.status],
              )}
            >
              {STATUS_LABEL[check.status]}
            </span>
          </div>

          {/* Explanation */}
          <p className="text-xs text-neutral-600 mt-1">{check.explanation}</p>

          {/* Impact */}
          {check.status !== "ok" && check.impact && (
            <p className="text-xs text-neutral-400 mt-0.5 italic">
              Impact: {check.impact}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {check.fixLabel && check.fixHref && (
              <a
                href={check.fixHref}
                target={check.fixHref.startsWith("http") ? "_blank" : undefined}
                rel={check.fixHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {check.fixLabel}
                {check.fixHref.startsWith("http") && (
                  <ExternalLink className="w-3 h-3" />
                )}
              </a>
            )}
            {check.supportSuggested && (
              <a
                href="mailto:support@marginlab.io"
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
              >
                Contact support
              </a>
            )}
          </div>

          {/* Dev details toggle */}
          {check.devDetail && (
            <div className="mt-3">
              <button
                onClick={() => setDevOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    devOpen && "rotate-180",
                  )}
                />
                {devOpen ? "Hide" : "Show"} technical details
              </button>
              {devOpen && (
                <pre className="mt-2 text-xs text-neutral-500 bg-neutral-100 rounded-lg px-3 py-2 whitespace-pre-wrap break-all">
                  {check.devDetail}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface OnboardingStatus {
  billingActive: boolean;
  billingPlan: string;
  billingTrialing: boolean;
  eventsFlowing: boolean;
  lastEventReceivedAt: string | null;
  recentEvent: boolean;
  webhooksReceiving: boolean;
  lastWebhookReceivedAt: string | null;
  ordersAttributing: boolean;
  lastOrderAttributedAt: string | null;
  hasRunningExperiment: boolean;
  runningExperimentCount: number;
  installedAt: string | null;
  scopesGranted: boolean;
  // Extensions
  checkoutExtensionActive: boolean;
  checkoutBlockCount: number;
  discountEngineActive: boolean;
  discountFunctionExperimentCount: number;
  // COGS
  cogsConfigured: boolean;
  cogsVariantCount: number;
}

function buildChecks(s: OnboardingStatus): HealthCheck[] {
  const minAgo = (iso: string | null) => {
    if (!iso) return null;
    return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  };

  const formatAge = (mins: number | null) => {
    if (mins === null) return "never";
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins} minutes ago`;
    const h = Math.floor(mins / 60);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  };

  const lastEventMins = minAgo(s.lastEventReceivedAt);
  const lastOrderMins = minAgo(s.lastOrderAttributedAt);

  return [
    {
      id: "installed",
      label: "App installed",
      status: "ok",
      explanation: s.installedAt
        ? `MarginLab is installed on your store (since ${new Date(s.installedAt).toLocaleDateString()}).`
        : "MarginLab is installed and connected to your store.",
      impact: "",
    },
    {
      id: "billing",
      label: "Subscription",
      status: s.billingActive ? "ok" : "error",
      explanation: s.billingActive
        ? s.billingTrialing
          ? `You are on a free trial (${s.billingPlan} plan).`
          : `Your ${s.billingPlan} plan is active.`
        : "Your subscription is not active. Some features may be paused.",
      impact: "Running experiments and creating new tests require an active subscription.",
      fixLabel: s.billingActive ? undefined : "Update billing",
      fixHref: s.billingActive ? undefined : "/billing",
      devDetail: `plan=${s.billingPlan} active=${s.billingActive} trialing=${s.billingTrialing}`,
    },
    {
      id: "runtime",
      label: "Storefront tracking",
      status: s.eventsFlowing ? "ok" : s.lastEventReceivedAt ? "warning" : "pending",
      explanation: s.eventsFlowing
        ? `Your storefront is sending visitor data to MarginLab. Last activity: ${formatAge(lastEventMins)}.`
        : s.lastEventReceivedAt
          ? `Tracking was active before but no recent activity. Last seen: ${formatAge(lastEventMins)}.`
          : "Storefront tracking is not active yet. MarginLab needs to be enabled in your theme.",
      impact: "Without storefront tracking, experiments cannot assign visitors to variants and no analytics data will be collected.",
      fixLabel: s.eventsFlowing ? undefined : "Enable in Theme Editor",
      fixHref: s.eventsFlowing ? undefined : "https://admin.shopify.com/store/themes",
      supportSuggested: !s.eventsFlowing && !!s.lastEventReceivedAt,
      devDetail: `eventsFlowing=${s.eventsFlowing} lastEvent=${s.lastEventReceivedAt} recentEvent=${s.recentEvent}`,
    },
    {
      id: "pixel",
      label: "Web Pixel",
      status: s.eventsFlowing ? "ok" : "pending",
      explanation: s.eventsFlowing
        ? "The MarginLab Web Pixel is active and sending events."
        : "The Web Pixel is not active. Enable it in Shopify Admin under Settings → Customer Events.",
      impact: "The Web Pixel powers checkout and conversion tracking. Without it, purchase attribution will not work.",
      fixLabel: s.eventsFlowing ? undefined : "Open Customer Events",
      fixHref: s.eventsFlowing ? undefined : "https://admin.shopify.com/settings/customer_events",
      devDetail: `pixel_inferred_from_events=${s.eventsFlowing}`,
    },
    {
      id: "orders",
      label: "Order attribution",
      status: s.ordersAttributing ? "ok" : s.webhooksReceiving ? "warning" : "pending",
      explanation: s.ordersAttributing
        ? `Orders are being attributed to your experiments. Last attribution: ${formatAge(lastOrderMins)}.`
        : s.webhooksReceiving
          ? "Orders are coming in but none have been attributed to an experiment yet. This is normal if no experiments are running."
          : "Attribution starts automatically once an experiment is running and a visitor completes a purchase.",
      impact: "Without order attribution, revenue and conversion analytics will not show results.",
      fixLabel: !s.ordersAttributing && !s.hasRunningExperiment ? "Create an experiment" : undefined,
      fixHref: !s.ordersAttributing && !s.hasRunningExperiment ? "/experiments/new" : undefined,
      devDetail: `ordersAttributing=${s.ordersAttributing} webhooksReceiving=${s.webhooksReceiving} lastWebhook=${s.lastWebhookReceivedAt} lastOrder=${s.lastOrderAttributedAt}`,
    },
    {
      id: "experiment",
      label: "Active experiment",
      status: s.hasRunningExperiment ? "ok" : "warning",
      explanation: s.hasRunningExperiment
        ? `You have ${s.runningExperimentCount} running experiment${s.runningExperimentCount !== 1 ? "s" : ""}.`
        : "You do not have any active experiments. Create and launch one to start collecting data.",
      impact: "Analytics and revenue attribution only run when an experiment is live.",
      fixLabel: s.hasRunningExperiment ? undefined : "Create your first experiment",
      fixHref: s.hasRunningExperiment ? undefined : "/experiments/new",
      devDetail: `runningExperimentCount=${s.runningExperimentCount}`,
    },
    {
      id: "scopes",
      label: "App permissions",
      status: s.scopesGranted ? "ok" : "error",
      explanation: s.scopesGranted
        ? "MarginLab has the necessary permissions to manage your experiments."
        : "Some required permissions are missing. Reinstalling the app should fix this.",
      impact: "Missing permissions may prevent experiments from launching or orders from being tracked.",
      fixLabel: s.scopesGranted ? undefined : "Reinstall app",
      fixHref: s.scopesGranted ? undefined : "/",
      supportSuggested: !s.scopesGranted,
      devDetail: `scopesGranted=${s.scopesGranted}`,
    },
    {
      id: "checkout-extension",
      label: "Checkout Extension",
      status: s.checkoutExtensionActive ? "ok" : "pending",
      explanation: s.checkoutExtensionActive
        ? `The MarginLab Checkout Extension is active. ${s.checkoutBlockCount} checkout block${s.checkoutBlockCount !== 1 ? "s" : ""} configured.`
        : "The Checkout Extension is not yet configured. Add a checkout block to enable in-checkout experiments.",
      impact: "Checkout blocks allow you to inject banners, upsells, and trust signals directly at checkout.",
      fixLabel: s.checkoutExtensionActive ? undefined : "Create a checkout block",
      fixHref: s.checkoutExtensionActive ? undefined : "/checkout-blocks/new",
      devDetail: `checkoutBlockCount=${s.checkoutBlockCount}`,
    },
    {
      id: "discount-engine",
      label: "Discount Engine",
      status: s.discountEngineActive ? "ok" : "pending",
      explanation: s.discountEngineActive
        ? `The discount engine is active — used by ${s.discountFunctionExperimentCount} test${s.discountFunctionExperimentCount !== 1 ? "s" : ""}.`
        : "The Discount Engine has not been used yet. It powers price tests and discount experiments via Shopify Functions.",
      impact: "Required for price tests and discount experiments that enforce prices at checkout level.",
      fixLabel: s.discountEngineActive ? undefined : "Create a price test",
      fixHref: s.discountEngineActive ? undefined : "/price-tests/new",
      devDetail: `discountFunctionExperiments=${s.discountFunctionExperimentCount}`,
    },
    {
      id: "cogs",
      label: "COGS / Profit data",
      status: s.cogsConfigured ? "ok" : "warning",
      explanation: s.cogsConfigured
        ? `Cost data configured for ${s.cogsVariantCount} product variant${s.cogsVariantCount !== 1 ? "s" : ""}. Profit analytics are enabled.`
        : "No product cost data has been uploaded yet. Profit and margin analytics will not be available.",
      impact: "Without COGS data, revenue analytics will show gross revenue only — not net profit or margins.",
      fixLabel: s.cogsConfigured ? undefined : "Upload COGS data",
      fixHref: s.cogsConfigured ? undefined : "/cogs",
      devDetail: `cogsVariantCount=${s.cogsVariantCount}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InstallHealthPage() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/onboarding/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setLastRefreshed(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const checks = status ? buildChecks(status) : [];
  const okCount = checks.filter((c) => c.status === "ok").length;
  const allOk = checks.length > 0 && okCount === checks.length;
  const hasIssues = checks.some((c) => c.status === "error" || c.status === "warning");

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Setup &amp; Health</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Check that MarginLab is properly connected to your store.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="shrink-0">
            <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Loading */}
        {loading && !status && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white border border-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-danger-200 bg-danger-50">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-danger-500" />
              <div>
                <p className="text-sm font-semibold text-danger-800">Could not load health status</p>
                <p className="text-xs text-danger-600 mt-0.5">
                  Please refresh the page or{" "}
                  <a href="mailto:support@marginlab.io" className="underline">contact support</a>{" "}
                  if the issue persists.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Summary banner */}
        {status && !loading && (
          <Card className={cn("border-2",
            allOk ? "border-success-400 bg-success-50"
              : hasIssues ? "border-danger-300 bg-danger-50/50"
              : "border-warning-300 bg-warning-50/50"
          )}>
            <div className="flex items-center gap-3">
              {allOk ? (
                <CheckCircle2 className="w-6 h-6 text-success-600 shrink-0" />
              ) : hasIssues ? (
                <XCircle className="w-6 h-6 text-danger-500 shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-warning-600 shrink-0" />
              )}
              <div>
                <p className={cn("font-semibold",
                  allOk ? "text-success-800" : hasIssues ? "text-danger-800" : "text-warning-800"
                )}>
                  {allOk ? "Everything looks good!" : `${okCount} of ${checks.length} checks passing`}
                </p>
                <p className={cn("text-sm",
                  allOk ? "text-success-700" : hasIssues ? "text-danger-700" : "text-warning-700"
                )}>
                  {allOk
                    ? "MarginLab is active and connected to your store."
                    : "Review the items below to ensure everything is working correctly."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Checks */}
        {checks.length > 0 && (
          <Card padding="none">
            {checks.map((check) => (
              <HealthCheckRow key={check.id} check={check} />
            ))}
          </Card>
        )}

        {/* Setup guide */}
        {status && (
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">First-time setup guide</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-600">
              <li>
                <span className="font-medium text-neutral-800">Enable the app embed</span> — open
                your Shopify theme editor, find MarginLab under App Embeds, and turn it on.
              </li>
              <li>
                <span className="font-medium text-neutral-800">Activate the Web Pixel</span> — go
                to Shopify Admin → Settings → Customer Events and enable the MarginLab pixel.
              </li>
              <li>
                <span className="font-medium text-neutral-800">Create an experiment</span> — head
                to Experiments and launch your first A/B test.
              </li>
              <li>
                <span className="font-medium text-neutral-800">Import COGS (optional)</span> —
                upload product costs to unlock profit analytics.
              </li>
            </ol>
            <div className="mt-4 flex gap-4 flex-wrap">
              <a
                href="https://admin.shopify.com/store/themes"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Open Theme Editor <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://admin.shopify.com/settings/customer_events"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Open Customer Events <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </Card>
        )}

        {/* Footer */}
        {lastRefreshed && (
          <p className="text-center text-xs text-neutral-400">
            Last checked {lastRefreshed.toLocaleTimeString()} ·{" "}
            <button onClick={load} className="underline hover:text-neutral-600">Check again</button>
          </p>
        )}

      </div>
    </div>
  );
}
