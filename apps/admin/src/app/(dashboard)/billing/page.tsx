"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, Zap, Crown, Building2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanData {
  key: string;
  name: string;
  description: string;
  price: number;
  isCurrent: boolean;
  trialDays: number;
  maxRunningExperiments: number | null;
  maxActiveOffers: number | null;
  maxCheckoutBlocks: number | null;
  hasAdvancedAnalytics: boolean;
  hasIntegrations: boolean;
  hasPrioritySupport: boolean;
}

interface UsageStat {
  current: number;
  max: number;
}

interface BillingData {
  plans: PlanData[];
  currentPlan: { key: string; name: string };
  isTrialing: boolean;
  usage: {
    experiments: UsageStat;
    offers: UsageStat;
    checkoutBlocks: UsageStat;
    integrations: UsageStat;
  };
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="w-5 h-5" />,
  growth: <Zap className="w-5 h-5 text-brand-600" />,
  pro: <Crown className="w-5 h-5 text-amber-500" />,
  enterprise: <Building2 className="w-5 h-5 text-purple-600" />,
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["1 running experiment", "Basic analytics", "Community support"],
  growth: [
    "10 running experiments",
    "5 active offers",
    "Full analytics + P&L",
    "Segment breakdowns",
    "3 integrations",
    "Email support",
  ],
  pro: [
    "Unlimited experiments",
    "Unlimited offers",
    "All analytics features",
    "All integrations + webhooks",
    "Priority email support",
  ],
  enterprise: [
    "Everything in Pro",
    "Dedicated account manager",
    "Custom SLA",
    "Priority support",
    "Custom integrations",
  ],
};

function UsageBar({ label, current, max }: { label: string; current: number; max: number | null }) {
  const pct = max === null ? 0 : Math.min(100, (current / max) * 100);
  const isUnlimited = max === null;
  const isWarning = !isUnlimited && pct >= 80;
  const isFull = !isUnlimited && current >= max;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-neutral-600">{label}</span>
        <span className={cn("text-xs font-medium", isFull ? "text-danger-600" : isWarning ? "text-amber-600" : "text-neutral-700")}>
          {isUnlimited ? `${current} / ∞` : `${current} / ${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isFull ? "bg-danger-500" : isWarning ? "bg-amber-400" : "bg-brand-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) setSuccess(true);
    if (params.get("error")) {
      const code = params.get("error");
      setError(
        code === "declined"
          ? "The billing charge was declined."
          : code === "missing_params"
          ? "Invalid billing callback — please try again."
          : "Billing activation failed. Please contact support."
      );
    }
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/plans");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function subscribe(planKey: string) {
    setSubscribing(planKey);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to initiate upgrade");
        return;
      }
      if (json.demo) {
        setError(json.error);
        return;
      }
      // Redirect to Shopify billing confirmation
      window.location.href = json.confirmationUrl;
    } finally {
      setSubscribing(null);
    }
  }

  async function cancel() {
    setShowCancelConfirm(false);
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (res.ok) {
        await fetchData();
        setSuccess(true);
      } else {
        const json = await res.json();
        setError(json.error ?? "Cancel failed");
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const currentPlanKey = data?.currentPlan?.key ?? "free";

  return (
    <>
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="m mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Manage your MarginLab subscription</p>
        </div>

        <div className="space-y-6">
        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 rounded-lg px-4 py-3 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            Plan updated successfully.
          </div>
        )}

        {/* Usage */}
        {data && (
          <Card>
            <CardHeader>
              <CardTitle>Current Usage</CardTitle>
              <span className="text-xs text-neutral-500 capitalize">
                {data.currentPlan.name} Plan
                {data.isTrialing && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                    Trial
                  </span>
                )}
              </span>
            </CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <UsageBar
                label="Running Experiments"
                current={data.usage.experiments.current}
                max={data.usage.experiments.max === Infinity ? null : data.usage.experiments.max}
              />
              <UsageBar
                label="Active Offers"
                current={data.usage.offers.current}
                max={data.usage.offers.max === Infinity ? null : data.usage.offers.max}
              />
              <UsageBar
                label="Checkout Blocks"
                current={data.usage.checkoutBlocks.current}
                max={data.usage.checkoutBlocks.max === Infinity ? null : data.usage.checkoutBlocks.max}
              />
              <UsageBar
                label="Integrations"
                current={data.usage.integrations.current}
                max={data.usage.integrations.max === Infinity ? null : data.usage.integrations.max}
              />
            </div>
          </Card>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(data?.plans ?? []).map((plan) => {
            const isCurrent = plan.key === currentPlanKey;
            const isDowngrade =
              (data?.plans ?? []).findIndex((p) => p.key === currentPlanKey) >
              (data?.plans ?? []).findIndex((p) => p.key === plan.key);

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative border rounded-xl p-5 flex flex-col gap-4",
                  isCurrent
                    ? "border-brand-400 bg-brand-50"
                    : "border-neutral-200 bg-white"
                )}
              >
                {isCurrent && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-brand-600 text-white text-xs font-medium rounded-full">
                    Current
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {PLAN_ICONS[plan.key]}
                    <span className="font-semibold text-neutral-900">{plan.name}</span>
                  </div>
                  <p className="text-xs text-neutral-500">{plan.description}</p>
                </div>

                <div>
                  <span className="text-2xl font-bold text-neutral-900">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-xs text-neutral-500 ml-1">/month</span>
                  )}
                  {plan.trialDays > 0 && (
                    <p className="text-xs text-brand-600 mt-0.5">{plan.trialDays}-day free trial</p>
                  )}
                </div>

                <ul className="space-y-1.5 flex-1">
                  {(PLAN_FEATURES[plan.key] ?? []).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-neutral-700">
                      <Check className="w-3.5 h-3.5 text-success-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isCurrent && plan.key !== "free" && (
                  <Button
                    size="sm"
                    variant={isDowngrade ? "secondary" : "primary"}
                    loading={subscribing === plan.key}
                    onClick={() => subscribe(plan.key)}
                    className="w-full"
                  >
                    {isDowngrade ? "Downgrade" : "Upgrade"}
                  </Button>
                )}

                {isCurrent && currentPlanKey !== "free" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cancelling}
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full text-danger-600 hover:bg-danger-50"
                  >
                    Cancel Plan
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>

    {showCancelConfirm && (
      <ConfirmDialog
        title="Downgrade to free plan?"
        description="You'll lose access to all premium features immediately. This cannot be undone."
        confirmLabel="Downgrade"
        variant="warning"
        onConfirm={cancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    )}
    </>
    
  );
}
