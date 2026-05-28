"use client";

import React from "react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import {
  Eye, BarChart3, Check, ChevronDown, RefreshCw,
  Star, Filter, MessageSquare, ArrowUp, ArrowDown,
  ExternalLink, Tag, Truck, DollarSign, Box, Percent,
  Globe, Settings2, Users2, Activity,
} from "lucide-react";
import type { ExperimentAnalytics, VariantMetrics } from "@/services/analytics.service";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { TestGroupsEditor } from "./TestGroupsEditor";
import type { Experiment } from "./ExperimentDetailShell";

// Re-export the Variant interface shape used in tabs
interface Variant {
  id: string;
  name: string;
  key: string;
  isControl: boolean;
  allocationPercent: number;
  redirectUrl?: string | null;
  modifications?: unknown;
  priceOverrides?: unknown;
  discountConfig?: unknown;
  settings?: unknown;
}

interface ExperimentData extends Omit<Experiment, "variants"> {
  variants: Variant[];
}

interface Props {
  tab: string;
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
  shopDomain?: string;
}

// MarginLab color palette
const VARIANT_COLORS = ["#6366f1", "#6875f5", "#0e9f6e", "#f59e0b"];

export function ExperimentTabs({ tab, experiment, analytics, currencyCode, shopDomain }: Props) {
  switch (tab) {
    case "groups":
      return <TestGroupsTab experiment={experiment} />;
    case "modifications":
      return <ModificationsTab experiment={experiment} />;
    case "targeting":
      return <TargetingTab experiment={experiment} />;
    case "preview":
      return <PreviewTab experiment={experiment} shopDomain={shopDomain} />;
    case "analytics-config":
      return <AnalyticsConfigTab experiment={experiment} />;
    case "qa":
      return <QAHealthTab experiment={experiment} />;
    case "results":
      if (experiment.type === "CONTENT_TEST") {
        return <ContentAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "SPLIT_URL_TEST") {
        return <SplitUrlAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "OFFER_TEST") {
        return <OfferAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "CHECKOUT_TEST") {
        return <CheckoutAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "DISCOUNT_TEST") {
        return <DiscountAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "SHIPPING_TEST") {
        return <ShippingAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "PRICE_TEST") {
        return <PriceAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      if (experiment.type === "PERSONALIZATION") {
        return <PersonalizationAnalyticsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
      }
      return <ResultsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
    default:
      return <ResultsTab experiment={experiment} analytics={analytics} currencyCode={currencyCode} />;
  }
}

// ─────────────────────────────────────────────
// RESULTS TAB (main focus)
// ─────────────────────────────────────────────
function ResultsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const variants = experiment.variants;
  const variantNames = variants.map((v) => v.name);
  const orders = analytics?.summary.totalOrders ?? 0;
  const visitors = analytics?.summary.totalVisitors ?? 0;
  const revenue = analytics?.summary.totalRevenue ?? 0;

  // Build bar chart data for a metric
  const makeBarData = (metric: (v: VariantMetrics) => number) => {
    if (!analytics) return variantNames.map((name) => ({ name, value: 0 }));
    return analytics.variants.map((v) => ({
      name: v.variantName,
      value: metric(v),
    }));
  };

  const conversionData = makeBarData((v) => v.conversionRate * 100);
  const rpvData = makeBarData((v) => v.revenuePerVisitor);
  const ppvData = makeBarData((v) => v.profitPerVisitor);
  const aovData = makeBarData((v) => v.aov);

  // Time series mock data (would come from real daily metrics)
  const timeData = generateMockTimeSeries(variants.length);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto bg-neutral-50/50">
      {/* Top controls */}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 bg-white"
        >
          View: <span className="text-neutral-900 font-semibold">Key Metrics</span>
          <ChevronDown className="w-3 h-3 text-neutral-400 ml-0.5" />
        </button>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
            <Filter className="w-3.5 h-3.5" />
          </button>
          <button className="flex items-center gap-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 bg-white">
            Range: <span className="font-medium text-neutral-800">All (May 13 - Now)</span>
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date + summary stats row */}
      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8 text-xs">
          <div>
            <p className="text-neutral-400 mb-0.5">Start Date</p>
            <p className="font-medium text-neutral-800">
              {experiment.launchedAt
                ? new Date(experiment.launchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-neutral-400 mb-0.5">End Date</p>
            <p className="font-medium text-neutral-400">—</p>
          </div>
          <div>
            <p className="text-neutral-400 mb-0.5">Timezone</p>
            <p className="font-medium text-neutral-800">America/Los_Angeles</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-xs">
          <div className="text-right">
            <p className="text-neutral-400 mb-0.5">Orders</p>
            <p className="font-bold text-neutral-900 text-sm">{orders}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-400 mb-0.5">Visitors</p>
            <p className="font-bold text-neutral-900 text-sm">{visitors.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-400 mb-0.5">Revenue</p>
            <p className="font-bold text-neutral-900 text-sm">{formatCurrency(revenue, currencyCode)}</p>
          </div>
        </div>
      </div>

      {/* AI chat box */}
      <div className="bg-white rounded-xl border border-neutral-200 px-4 py-3 flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
        </div>
        <div className="flex-1 h-2 bg-neutral-100 rounded-full" />
        <div className="flex-1 h-2 bg-neutral-100 rounded-full" />
        <div className="flex-1 h-2 bg-neutral-100 rounded-full" />
        <span className="text-xs text-neutral-300 shrink-0">Chat about your results</span>
      </div>

      {/* Key Metrics section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-900">Key Metrics</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Compare</span>
            <button className="flex items-center gap-1 text-xs border border-neutral-200 rounded-md px-2 py-1 text-neutral-700 hover:bg-neutral-50">
              Control Group <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
            <span className="text-neutral-300">⇄</span>
            <button className="flex items-center gap-1 text-xs border border-neutral-200 rounded-md px-2 py-1 text-neutral-700 hover:bg-neutral-50">
              {variants[1]?.name ?? "Variant"} <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
            <button className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-md">
              +
            </button>
          </div>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          <MetricCard
            label="Conversion Rate"
            lift={analytics?.variants[1]?.conversionRateTest?.relativeLift}
            sublabel="EST. +5 ORDERS MONTHLY"
            data={conversionData}
            formatter={(v) => `${v.toFixed(2)}%`}
            color="#6366f1"
          />
          <MetricCard
            label="Revenue per Visitor"
            lift={analytics?.variants[1]?.revenuePerVisitorTest?.relativeLift}
            sublabel="EST. +$935.00 MONTHLY"
            data={rpvData}
            formatter={(v) => `$${v.toFixed(2)}`}
            color="#6366f1"
          />
          <MetricCard
            label="Profit per Visitor"
            lift={0.8483}
            sublabel="EST. +$935.00 MONTHLY"
            data={ppvData}
            formatter={(v) => `$${v.toFixed(2)}`}
            color="#6366f1"
          />
          <MetricCard
            label="Average Order Value"
            lift={0.3511}
            data={aovData}
            formatter={(v) => `$${v.toFixed(0)}`}
            color="#6366f1"
          />
          <MetricCard
            label="Checkout - begin rate"
            lift={0.28}
            data={conversionData}
            formatter={(v) => `${v.toFixed(2)}%`}
            color="#6366f1"
          />
          <MetricCard
            label="Add to Cart"
            lift={0.28}
            data={conversionData}
            formatter={(v) => `${v.toFixed(2)}%`}
            color="#6366f1"
          />
        </div>
      </div>

      {/* Metric Details */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Metric Details</span>
          <button className="flex items-center gap-1 text-xs border border-neutral-200 rounded-md px-2 py-1 text-neutral-700 hover:bg-neutral-50">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Conversion Rate
            <ChevronDown className="w-3 h-3 ml-0.5 text-neutral-400" />
          </button>
          <span className="text-xs text-neutral-400">Orders divided by unique visitors.</span>
        </div>

        {/* Statistical Significance */}
        <div className="p-4">
          <div className="rounded-lg overflow-hidden border border-neutral-100">
            <div className="px-4 py-2.5 flex items-center gap-2 bg-neutral-50/50">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-semibold text-neutral-700">Statistical Significance</span>
              <span className="text-xs text-neutral-400">Conversion Rate</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Group</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Uplift</th>
                  <th className="px-4 py-2 text-center font-medium text-neutral-500">Probability to Beat Control Group</th>
                  <th className="px-4 py-2 text-center font-medium text-neutral-500">Probability to Be Best</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-500">Value</th>
                </tr>
              </thead>
              <tbody>
                {experiment.variants.map((v, i) => {
                  const av = analytics?.variants.find((av) => av.variantId === v.id);
                  const lift = av?.conversionRateTest?.relativeLift;
                  const isControl = v.isControl;
                  return (
                    <tr key={v.id} className="border-b border-neutral-100">
                      <td className="px-4 py-3 font-medium text-neutral-800">{v.name}</td>
                      <td className="px-4 py-3">
                        {isControl ? (
                          <span className="text-neutral-400">n/a</span>
                        ) : lift != null ? (
                          <LiftBadge value={lift} />
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-300">
                        {isControl ? "n/a" : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-300">—</td>
                      <td className="px-4 py-3 text-right text-neutral-400">Not Enough Data</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time Series */}
        <div className="px-4 pb-4">
          <div className="rounded-lg overflow-hidden border border-neutral-100">
            <div className="px-4 py-2.5 flex items-center gap-3 bg-neutral-50/50">
              <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                Time Series
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-0.5" />
                Conversion Rate
              </span>
            </div>
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              {["Hourly", "Daily", "Weekly"].map((t, i) => (
                <button
                  key={t}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    i === 1
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  {t}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-neutral-600 ml-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-3 h-3 rounded" />
                Cumulative
              </label>
            </div>
            <div className="px-2 py-2">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  {experiment.variants.map((v, i) => (
                    <Line
                      key={v.id}
                      type="monotone"
                      dataKey={v.name}
                      stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 pt-1">
                {experiment.variants.map((v, i) => (
                  <span key={v.id} className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                    />
                    {v.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* By Audience */}
      <AudienceTable experiment={experiment} analytics={analytics} currencyCode={currencyCode} />

      {/* Custom Metrics */}
      <CustomMetricsCard experimentId={experiment.id} variants={experiment.variants} />
    </div>
  );
}

// ─────────────────────────────────────────────
// CUSTOM METRICS CARD
// ─────────────────────────────────────────────

interface CustomEventOption {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
}

interface CustomMetricResult {
  eventName: string;
  eventDisplayName: string;
  variants: Array<{
    variantId: string;
    variantKey: string;
    variantName: string;
    isControl: boolean;
    totalVisitors: number;
    eventCount: number;
    uniqueVisitors: number;
    conversionRate: number;
    test?: {
      pValue: number;
      isSignificant: boolean;
      recommendation: string;
      relativeUplift: number;
    };
  }>;
}

function CustomMetricsCard({ experimentId, variants }: { experimentId: string; variants: { id: string; name: string; key: string; isControl: boolean }[] }) {
  const [events, setEvents] = React.useState<CustomEventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<string>("");
  const [result, setResult] = React.useState<CustomMetricResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [eventsLoading, setEventsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/custom-events")
      .then((r) => r.json())
      .then((d: { events: CustomEventOption[] }) => {
        setEvents(d.events ?? []);
        if (d.events?.length > 0) setSelectedEvent(d.events[0]!.name);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const fetchMetrics = React.useCallback(async (eventName: string) => {
    if (!eventName) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/experiments/${experimentId}/analytics/custom-metrics?eventName=${encodeURIComponent(eventName)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Failed to load" })) as { error: string };
        setError(d.error ?? "Failed to load custom metrics");
        return;
      }
      const data = await res.json() as CustomMetricResult;
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  const handleSelect = (name: string) => {
    setSelectedEvent(name);
    fetchMetrics(name);
  };

  if (eventsLoading) return null;
  if (events.length === 0) return null;

  const controlVariant = result?.variants.find((v) => v.isControl);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-500" />
            Custom Metrics
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">Per-variant breakdown for your registered custom events</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedEvent}
            onChange={(e) => handleSelect(e.target.value)}
            className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {events.map((e) => (
              <option key={e.id} value={e.name}>{e.displayName}</option>
            ))}
          </select>
          <button
            onClick={() => fetchMetrics(selectedEvent)}
            disabled={loading || !selectedEvent}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {!result && !loading && !error && (
          <p className="text-xs text-neutral-400 text-center py-4">
            Select an event and click refresh to see per-variant data.
          </p>
        )}
        {loading && (
          <p className="text-xs text-neutral-400 text-center py-4 animate-pulse">Loading…</p>
        )}
        {error && (
          <p className="text-xs text-danger-600 text-center py-4">{error}</p>
        )}
        {result && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left py-2 pr-4 font-medium text-neutral-500">Variant</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-500">Visitors</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-500">Event Count</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-500">Unique Visitors</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-500">Conv. Rate</th>
                  <th className="text-right py-2 pl-3 font-medium text-neutral-500">vs. Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {result.variants.map((v) => {
                  const uplift = v.test?.relativeUplift;
                  const sig = v.test?.isSignificant;
                  return (
                    <tr key={v.variantId} className="hover:bg-neutral-50">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-neutral-800">{v.variantName}</span>
                        {v.isControl && (
                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">Control</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-700 tabular-nums">{v.totalVisitors.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-neutral-700 tabular-nums">{v.eventCount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-neutral-700 tabular-nums">{v.uniqueVisitors.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-neutral-800 tabular-nums">
                        {(v.conversionRate * 100).toFixed(2)}%
                        {controlVariant && !v.isControl && controlVariant.conversionRate > 0 && (
                          <span className="ml-1 text-[10px] text-neutral-400">
                            ({controlVariant.conversionRate > 0
                              ? ((v.conversionRate / controlVariant.conversionRate - 1) * 100 >= 0 ? "+" : "")
                              + ((v.conversionRate / controlVariant.conversionRate - 1) * 100).toFixed(1) + "%"
                              : "—"})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {v.isControl ? (
                          <span className="text-neutral-300">—</span>
                        ) : uplift !== undefined ? (
                          <span className={`inline-flex items-center gap-0.5 font-semibold ${sig ? (uplift >= 0 ? "text-success-600" : "text-danger-600") : "text-neutral-500"}`}>
                            {uplift >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {Math.abs(uplift * 100).toFixed(1)}%
                            {sig ? <span className="text-[9px] ml-0.5">{v.test?.recommendation === "variant" ? "✓" : "✗"}</span> : null}
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {result.variants.some((v) => v.test?.isSignificant) && (
              <p className="text-[10px] text-neutral-400 mt-3">
                ✓ = statistically significant at 95% confidence. Uplift is relative to control.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONTENT TEST ANALYTICS TAB
// ─────────────────────────────────────────────
function ContentAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#7c3aed";

  const cvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });

  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });

  // Modification health per variant (non-control only)
  const modsByVariant = new Map<string, { total: number; broken: number }>();
  for (const v of experiment.variants) {
    if (v.isControl) continue;
    const mods = v.modifications as Array<Record<string, unknown>> | null | undefined;
    if (Array.isArray(mods)) {
      let broken = 0;
      for (const m of mods) {
        const sel = String(m.selector ?? "").trim();
        const ct = String(m.changeType ?? m.type ?? "").trim();
        if (!sel || !KNOWN_CHANGE_TYPES.has(ct)) broken++;
      }
      modsByVariant.set(v.id, { total: mods.length, broken });
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Content Test Results</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 bg-white">
            Range: <span className="font-medium text-neutral-800">All time</span>
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Variant comparison table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Variant Comparison</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            DOM Content Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    Conv. Rate
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Visitor</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Mods</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const mods = modsByVariant.get(av.variantId);
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                      <td className="px-4 py-3 text-right">
                        {mods ? (
                          <span className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                            mods.broken > 0 ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-700"
                          )}>
                            {mods.total - mods.broken}/{mods.total}
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                            Control
                          </span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts: CVR + RPV side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Conversion Rate
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={cvData} barSize={18} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip
                formatter={(v: number) => `${v.toFixed(2)}%`}
                contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue per Visitor</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={rpvData} barSize={18} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v, currencyCode)}
                contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="value" fill="#0284c7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tracking note */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Activity className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-500">
          Session counts reflect visitors assigned by the storefront script.
          Page view depth and add-to-cart rate require dedicated Web Pixel event tracking —{" "}
          <a href="/install-health" className="underline text-neutral-700 font-medium">check install health</a>.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SPLIT URL TEST ANALYTICS TAB
// ─────────────────────────────────────────────
function SplitUrlAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#0284c7";

  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });

  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Split URL Results</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 bg-white">
            Range: <span className="font-medium text-neutral-800">All time</span>
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Per-URL stat cards */}
      <div className={cn("grid gap-2", experiment.variants.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
        {experiment.variants.map((v) => {
          const s = v.settings as Record<string, unknown> | null | undefined;
          const url = (v.redirectUrl) ?? (s?.url ?? s?.redirectUrl) as string | undefined;
          const av = analytics?.variants.find((a) => a.variantId === v.id);
          return (
            <div key={v.id} className="bg-white rounded-xl border border-neutral-200 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-neutral-800">{v.name}</span>
                {v.isControl && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                    Control
                  </span>
                )}
              </div>
              {url && <p className="text-[10px] font-mono text-neutral-400 truncate mb-2">{url}</p>}
              <p className="text-lg font-bold text-neutral-900">
                {av ? `${(av.conversionRate * 100).toFixed(2)}%` : "—"}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {av ? `${av.visitors.toLocaleString()} sessions` : "No data"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Results table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Results by URL</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Split URL Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant / URL</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    Landing CVR
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Session</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const v = experiment.variants.find((vv) => vv.id === av.variantId);
                  const s = v?.settings as Record<string, unknown> | null | undefined;
                  const url = (v?.redirectUrl) ?? (s?.url ?? s?.redirectUrl) as string | undefined;
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-800 block">{av.variantName}</span>
                        {url && <span className="text-[10px] font-mono text-neutral-400 truncate block max-w-xs">{url}</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => {
                  const s = v.settings as Record<string, unknown> | null | undefined;
                  const url = (v.redirectUrl) ?? (s?.url ?? s?.redirectUrl) as string | undefined;
                  return (
                    <tr key={v.id} className="border-b border-neutral-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-800 block">{v.name}</span>
                        {url && <span className="text-[10px] font-mono text-neutral-400 truncate block max-w-xs">{url}</span>}
                      </td>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Landing Conversion Rate
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={cvrData} barSize={18} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip
                formatter={(v: number) => `${v.toFixed(2)}%`}
                contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue per Session</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={rpvData} barSize={18} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v, currencyCode)}
                contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="value" fill="#059669" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OFFER TEST ANALYTICS TAB
// ─────────────────────────────────────────────
function OfferAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#059669";

  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });
  const aovData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.aov ?? 0 };
  });
  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Offer Test Results</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 bg-white">
            Range: <span className="font-medium text-neutral-800">All time</span>
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Offer Performance</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Offer Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Claims</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    Claim Rate
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Visitor</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Net Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.netRevenue, currencyCode)}</td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                            Control
                          </span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-metric charts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Claim Rate
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={cvrData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Avg Order Value</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={aovData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue / Visitor</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={rpvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHECKOUT TEST ANALYTICS TAB
// ─────────────────────────────────────────────
function CheckoutAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#4f46e5";

  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });
  const aovData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.aov ?? 0 };
  });
  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Checkout Block Results</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 bg-white">
            Range: <span className="font-medium text-neutral-800">All time</span>
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Impressions summary strip */}
      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-3 flex items-center gap-8 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Block Impressions</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.events.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Assignments</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.assignments.toLocaleString()}</p>
        </div>
        {analytics && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Orders</p>
              <p className="text-lg font-bold text-neutral-900">{analytics.summary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Revenue</p>
              <p className="text-lg font-bold text-neutral-900">{formatCurrency(analytics.summary.totalRevenue, currencyCode)}</p>
            </div>
          </>
        )}
      </div>

      {/* Results table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Variant Results</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Checkout Block Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    Checkout CVR
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Visitor</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                            Control
                          </span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Checkout CVR
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={cvrData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Avg Order Value</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={aovData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue / Visitor</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={rpvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── DISCOUNT TEST: analytics ──
function DiscountAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#d97706";

  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });
  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });
  const ppvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.profitPerVisitor ?? 0 };
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Discount Test Results</span>
        </div>
        <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-3 flex items-center gap-8 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Assignments</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.assignments.toLocaleString()}</p>
        </div>
        {analytics && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Orders</p>
              <p className="text-lg font-bold text-neutral-900">{analytics.summary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Revenue</p>
              <p className="text-lg font-bold text-neutral-900">{formatCurrency(analytics.summary.totalRevenue, currencyCode)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Best RPV Lift</p>
              <p className="text-lg font-bold" style={{ color: ACCENT }}>
                {(() => {
                  const best = analytics.variants.filter(v => !v.isControl).sort((a, b) =>
                    (b.revenuePerVisitorTest?.relativeLift ?? -Infinity) - (a.revenuePerVisitorTest?.relativeLift ?? -Infinity))[0];
                  const lift = best?.revenuePerVisitorTest?.relativeLift;
                  return lift != null ? `${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)}%` : "—";
                })()}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Variant Results</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Discount Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    CVR
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Visitor</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Profit / Visitor</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                        {formatCurrency(av.profitPerVisitor, currencyCode)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>Control</span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Conversion Rate
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={cvrData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue / Visitor</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={rpvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Profit / Visitor</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={ppvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#059669" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── SHIPPING TEST: analytics ──
function ShippingAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#0891b2";

  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });
  const aovData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.aov ?? 0 };
  });
  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Shipping Test Results</span>
        </div>
        <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-3 flex items-center gap-8 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Assignments</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.assignments.toLocaleString()}</p>
        </div>
        {analytics && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Orders</p>
              <p className="text-lg font-bold text-neutral-900">{analytics.summary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Revenue</p>
              <p className="text-lg font-bold text-neutral-900">{formatCurrency(analytics.summary.totalRevenue, currencyCode)}</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Variant Results</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Shipping Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    CVR
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Visitor</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>Control</span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Conversion Rate
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={cvrData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Avg Order Value</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={aovData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue / Visitor</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={rpvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── PRICE TEST: analytics ──
function PriceAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#e11d48";

  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });
  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });
  const aovData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.aov ?? 0 };
  });

  // Elasticity hint: best non-control CVR vs control
  const controlMetrics = analytics?.variants.find(v => v.isControl);
  const bestVariant = analytics?.variants.filter(v => !v.isControl).sort((a, b) =>
    (b.revenuePerVisitorTest?.relativeLift ?? -Infinity) - (a.revenuePerVisitorTest?.relativeLift ?? -Infinity))[0];
  const cvrDown = bestVariant && controlMetrics && bestVariant.conversionRate < controlMetrics.conversionRate;
  const rpvUp = bestVariant && (bestVariant.revenuePerVisitorTest?.relativeLift ?? 0) > 0;
  const showElasticityHint = cvrDown && rpvUp;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Price Test Results</span>
        </div>
        <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {showElasticityHint && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">Inelastic demand detected</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              CVR is lower but revenue per visitor is higher, suggesting the higher price has not significantly reduced purchase intent.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-3 flex items-center gap-8 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Assignments</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.assignments.toLocaleString()}</p>
        </div>
        {analytics && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Orders</p>
              <p className="text-lg font-bold text-neutral-900">{analytics.summary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Revenue</p>
              <p className="text-lg font-bold text-neutral-900">{formatCurrency(analytics.summary.totalRevenue, currencyCode)}</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Variant Results</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Price Test
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">CVR</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    Rev / Visitor
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Profit / Visitor</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                        {formatCurrency(av.profitPerVisitor, currencyCode)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>Control</span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Revenue / Visitor
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={rpvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Conversion Rate</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={cvrData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Avg Order Value</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={aovData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── PERSONALIZATION: analytics ──
function PersonalizationAnalyticsTab({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const ACCENT = "#4f46e5";

  const cvrData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: parseFloat(((av?.conversionRate ?? 0) * 100).toFixed(2)) };
  });
  const rpvData = experiment.variants.map((v) => {
    const av = analytics?.variants.find((a) => a.variantId === v.id);
    return { name: v.name, value: av?.revenuePerVisitor ?? 0 };
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto bg-neutral-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-neutral-800">Personalization Results</span>
        </div>
        <button className="p-1.5 text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded-lg bg-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-3 flex items-center gap-8 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Impressions</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.events.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Assignments</p>
          <p className="text-lg font-bold text-neutral-900">{experiment._count.assignments.toLocaleString()}</p>
        </div>
        {analytics && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Orders</p>
              <p className="text-lg font-bold text-neutral-900">{analytics.summary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Total Revenue</p>
              <p className="text-lg font-bold text-neutral-900">{formatCurrency(analytics.summary.totalRevenue, currencyCode)}</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Variant Results</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            Personalization
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    CVR
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev / Visitor</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
              </tr>
            </thead>
            <tbody>
              {analytics ? (
                analytics.variants.map((av) => {
                  const cvLift = av.conversionRateTest?.relativeLift;
                  const rpvLift = av.revenuePerVisitorTest?.relativeLift;
                  return (
                    <tr key={av.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          {av.variantName}
                          {av.isControl && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                              Control
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.visitors.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{av.orders}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatPercent(av.conversionRate)}</span>
                          {!av.isControl && cvLift != null && <LiftBadge value={cvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums text-neutral-700">{formatCurrency(av.revenuePerVisitor, currencyCode)}</span>
                          {!av.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{formatCurrency(av.aov, currencyCode)}</td>
                    </tr>
                  );
                })
              ) : (
                experiment.variants.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      <span className="flex items-center gap-1.5">
                        {v.name}
                        {v.isControl && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>Control</span>
                        )}
                      </span>
                    </td>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Conversion Rate
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={cvrData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Revenue / Visitor</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={rpvData} barSize={16} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currencyCode)} contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Metric Card with bar chart ──
function MetricCard({
  label,
  lift,
  sublabel,
  data,
  formatter,
  color,
}: {
  label: string;
  lift?: number | null;
  sublabel?: string;
  data: { name: string; value: number }[];
  formatter: (v: number) => string;
  color: string;
}) {
  const hasLift = lift != null;
  const liftPct = hasLift ? lift * 100 : 0;
  const positive = liftPct >= 0;

  return (
    <div className="rounded-lg p-3.5 border border-neutral-100">
      <p className="text-xs font-medium text-neutral-600 mb-1">{label}</p>
      {hasLift ? (
        <div className="flex items-baseline gap-1 mb-0.5">
          <span
            className="text-lg font-bold"
            style={{ color: positive ? "#059669" : "#dc2626" }}
          >
            {positive ? "+" : ""}{liftPct.toFixed(2)}%
          </span>
        </div>
      ) : (
        <p className="text-lg font-bold text-neutral-300 mb-0.5">—</p>
      )}
      {sublabel && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">
          {sublabel}
        </p>
      )}
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={data} barSize={14} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => formatter(v)}
            contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid #e5e7eb", padding: "4px 8px" }}
          />
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Lift badge ──
function LiftBadge({ value }: { value: number }) {
  const pct = value * 100;
  const positive = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded"
      style={{
        background: positive ? "#d1fae5" : "#fee2e2",
        color: positive ? "#065f46" : "#991b1b",
      }}
    >
      {positive ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── Audience table ──
function AudienceTable({
  experiment,
  analytics,
  currencyCode,
}: {
  experiment: ExperimentData;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
}) {
  const segmentTabs = ["All Visitors", "Desktop/Mobile", "New/Returning", "Source Channels", "Source Sites", "Top 10 Countries", "Top 10 Landing Pages"];

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 pt-3 pb-0 border-b border-neutral-100">
        <div className="flex items-center gap-0 -mb-px overflow-x-auto">
          {segmentTabs.map((t, i) => (
            <button
              key={t}
              className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                i === 0
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50">
              <th className="px-4 py-3 text-left font-medium text-neutral-500 whitespace-nowrap">Group</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Actions</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">Visitors</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">Orders</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">Net Revenue</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500 whitespace-nowrap">
                <span className="flex items-center justify-end gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  Conv. Rate
                </span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">Rev/Visitor</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">Profit/Visitor</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">AOV</th>
            </tr>
          </thead>
          <tbody>
            {analytics ? (
              analytics.variants.map((v) => {
                const lift = v.conversionRateTest?.relativeLift;
                const rpvLift = v.revenuePerVisitorTest?.relativeLift;
                return (
                  <tr key={v.variantId} className="border-b border-neutral-50 hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800 whitespace-nowrap">{v.variantName}</td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs font-medium px-2.5 py-1 rounded border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
                      >
                        Roll out
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">{v.visitors.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">{v.orders}</td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">{formatCurrency(v.netRevenue, currencyCode)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-neutral-700 tabular-nums">{formatPercent(v.conversionRate)}</span>
                        {!v.isControl && lift != null && <LiftBadge value={lift} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-neutral-700 tabular-nums">{formatCurrency(v.revenuePerVisitor, currencyCode)}</span>
                        {!v.isControl && rpvLift != null && <LiftBadge value={rpvLift} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">
                      {formatCurrency(v.profitPerVisitor, currencyCode)}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">
                      {formatCurrency(v.aov, currencyCode)}
                    </td>
                  </tr>
                );
              })
            ) : (
              experiment.variants.map((v) => (
                <tr key={v.id} className="border-b border-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{v.name}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs font-medium px-2.5 py-1 rounded border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors">
                      Roll out
                    </button>
                  </td>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <td key={i} className="px-4 py-3 text-right text-neutral-300">—</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TEST GROUPS TAB
// ─────────────────────────────────────────────
function TestGroupsTab({ experiment }: { experiment: ExperimentData }) {
  return (
    <div className="p-6 max-w-5xl mx-auto bg-neutral-50/50">
      <TestGroupsEditor initialVariants={experiment.variants} />
    </div>
  );
}

// ─────────────────────────────────────────────
// MODIFICATIONS TAB — type-aware router
// ─────────────────────────────────────────────
function ModificationsTab({ experiment }: { experiment: ExperimentData }) {
  switch (experiment.type) {
    case "CONTENT_TEST":
      return <ContentModificationsTab experiment={experiment} />;
    case "SPLIT_URL_TEST":
      return <SplitUrlRoutesTab experiment={experiment} />;
    case "CHECKOUT_TEST":
      return <CheckoutBlockConfigTab experiment={experiment} />;
    case "DISCOUNT_TEST":
      return <DiscountConfigTab experiment={experiment} />;
    case "SHIPPING_TEST":
      return <ShippingConfigTab experiment={experiment} />;
    case "PRICE_TEST":
      return <PriceMatrixTab experiment={experiment} />;
    case "OFFER_TEST":
      return <OfferConfigTab experiment={experiment} />;
    case "PERSONALIZATION":
      return <PersonalizationConfigTab experiment={experiment} />;
    default:
      return <GenericConfigTab experiment={experiment} />;
  }
}

// ── CONTENT TEST: list variant modifications ──
const KNOWN_CHANGE_TYPES = new Set(["text","html","hide","style","addClass","removeClass","attr"]);

function ContentModificationsTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#7c3aed";

  type ModRow = {
    variantName: string;
    variantIsControl: boolean;
    selector: string;
    changeType: string;
    value: string;
    status: "valid" | "broken" | "unknown";
    statusReason?: string;
  };

  const allMods: ModRow[] = [];
  for (const v of experiment.variants) {
    if (v.isControl) continue; // control has no mods
    const mods = v.modifications as Array<Record<string, unknown>> | null | undefined;
    if (Array.isArray(mods)) {
      for (const m of mods) {
        const selector = String(m.selector ?? "").trim();
        const changeType = String(m.changeType ?? m.type ?? "unknown").trim();
        const value = String(m.value ?? "").trim();

        let status: ModRow["status"] = "unknown";
        let statusReason: string | undefined;

        if (!selector) {
          status = "broken";
          statusReason = "Selector is empty — this modification will never apply";
        } else if (!KNOWN_CHANGE_TYPES.has(changeType)) {
          status = "broken";
          statusReason = `Unknown change type "${changeType}"`;
        } else {
          status = "valid";
        }

        allMods.push({ variantName: v.name, variantIsControl: v.isControl, selector, changeType, value, status, statusReason });
      }
    }
  }

  const brokenCount = allMods.filter(m => m.status === "broken").length;

  const TYPE_COLORS: Record<string, string> = {
    text: "#7c3aed", html: "#0284c7", hide: "#6b7280",
    style: "#059669", addClass: "#d97706", removeClass: "#e11d48", attr: "#0891b2",
  };

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Inline guard: broken selectors */}
      {brokenCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">
              {brokenCount} modification{brokenCount > 1 ? "s" : ""} won&apos;t apply
            </p>
            <p className="text-[11px] text-red-700 mt-0.5">
              Empty or invalid selectors are highlighted below. Fix the CSS selector so the storefront runtime can locate the element.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4" style={{ color: ACCENT }} />
            <h2 className="text-sm font-semibold text-neutral-900">DOM Modifications</h2>
            {allMods.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                {allMods.length} total
              </span>
            )}
          </div>
        </div>

        {allMods.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${ACCENT}10` }}>
              <Box className="w-5 h-5" style={{ color: ACCENT }} />
            </div>
            <p className="text-sm text-neutral-500 font-medium mb-1">No modifications yet</p>
            <p className="text-xs text-neutral-400">Add DOM modifications to define what changes per variant</p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="px-5 py-2 bg-neutral-50 border-b border-neutral-100 grid grid-cols-[80px_1fr_1fr_80px_60px] gap-3">
              {["Type","Selector","Value","Variant","Status"].map(h => (
                <span key={h} className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-neutral-50">
              {allMods.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-5 py-3 grid grid-cols-[80px_1fr_1fr_80px_60px] gap-3 items-start text-xs",
                    m.status === "broken" && "bg-red-50/50"
                  )}
                >
                  {/* Type */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit shrink-0"
                    style={{
                      background: `${TYPE_COLORS[m.changeType] ?? "#6b7280"}15`,
                      color: TYPE_COLORS[m.changeType] ?? "#6b7280",
                    }}
                  >
                    {m.changeType.toUpperCase()}
                  </span>

                  {/* Selector */}
                  <div className="min-w-0">
                    {m.selector ? (
                      <span className="font-mono text-neutral-700 bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-100 text-[11px] truncate block">
                        {m.selector}
                      </span>
                    ) : (
                      <span className="text-red-500 italic font-medium">Empty selector</span>
                    )}
                    {m.status === "broken" && m.statusReason && (
                      <p className="text-[10px] text-red-500 mt-0.5">{m.statusReason}</p>
                    )}
                  </div>

                  {/* Value */}
                  <p className={cn("text-neutral-500 truncate", !m.value && "italic text-neutral-300")}>
                    {m.value || "—"}
                  </p>

                  {/* Variant */}
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full truncate" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                    {m.variantName}
                  </span>

                  {/* Status */}
                  {m.status === "valid" && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">Valid</span>
                  )}
                  {m.status === "broken" && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full w-fit">Broken</span>
                  )}
                  {m.status === "unknown" && (
                    <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full w-fit">Unknown</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Help callout */}
      <div className="px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-start gap-3">
        <Eye className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-500">
          Selector validity is verified against known change types. To check whether a selector actually matches elements on your store, use{" "}
          <a href="/debug" className="underline text-neutral-700 font-medium">Debug &amp; QA</a>.
        </p>
      </div>
    </div>
  );
}

// Helper: resolve the display URL for a split-URL variant.
// Control → splitUrlConfig.baseUrl; non-control → variant.redirectUrl
function resolveSplitUrl(v: Variant, splitUrlConfig: unknown): string | undefined {
  if (v.isControl) {
    const cfg = splitUrlConfig as Record<string, unknown> | null | undefined;
    return (cfg?.baseUrl as string | undefined) || undefined;
  }
  return v.redirectUrl || undefined;
}

// ── SPLIT URL TEST: list variants with URLs ──
function SplitUrlRoutesTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#0284c7";

  // Detect duplicate and missing URLs
  const urlMap = new Map<string, string[]>();
  for (const v of experiment.variants) {
    const url = resolveSplitUrl(v, experiment.splitUrlConfig);
    if (url) {
      const existing = urlMap.get(url) ?? [];
      existing.push(v.name);
      urlMap.set(url, existing);
    }
  }
  const duplicateEntries = [...urlMap.entries()].filter(([, names]) => names.length > 1);
  const missingUrlVariants = experiment.variants.filter(v => !resolveSplitUrl(v, experiment.splitUrlConfig));

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Guard: duplicate URLs */}
      {duplicateEntries.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">Duplicate URLs detected</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              {duplicateEntries.map(([url, names]) => `"${url}" shared by ${names.join(" and ")}`).join("; ")}. Visitors may be incorrectly split — each variant must have a unique URL.
            </p>
          </div>
        </div>
      )}

      {/* Guard: missing URLs */}
      {missingUrlVariants.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">
              {missingUrlVariants.length} variant{missingUrlVariants.length > 1 ? "s" : ""} missing a URL
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              {missingUrlVariants.map(v => v.name).join(", ")} — visitors assigned to this variant cannot be redirected.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">URL Routes</h2>
        </div>
        <div className="divide-y divide-neutral-50">
          {experiment.variants.map((v) => {
            const url = resolveSplitUrl(v, experiment.splitUrlConfig);
            const isDuplicate = url ? (urlMap.get(url)?.length ?? 0) > 1 : false;
            return (
              <div key={v.id} className={cn("px-5 py-4 flex items-center gap-4", isDuplicate && "bg-red-50/40")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-neutral-800">{v.name}</span>
                    {v.isControl && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>
                        Control
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                        Duplicate URL
                      </span>
                    )}
                    {!url && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                        No URL
                      </span>
                    )}
                  </div>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-600 bg-neutral-50 px-2 py-1 rounded border border-neutral-100 max-w-lg truncate hover:text-blue-600 hover:border-blue-100 transition-colors"
                    >
                      {url}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                    </a>
                  ) : (
                    <p className="text-xs text-neutral-400 italic">No URL configured</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400">
                    Status: Unknown
                  </span>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: `${ACCENT}10`, color: ACCENT }}
                  >
                    {v.allocationPercent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {experiment.variants.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-400">No variants configured</div>
        )}
      </div>

      {/* SEO / canonical note */}
      <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
        <Globe className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <span className="font-semibold">SEO:</span> Add a <code className="bg-amber-100 px-1 rounded text-[10px]">{"<link rel=\"canonical\">"}</code> tag on each variant page pointing to the control URL to prevent search engines from indexing duplicate content.
        </p>
      </div>
    </div>
  );
}

// ── CHECKOUT TEST: show block config per variant ──
function CheckoutBlockConfigTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#4f46e5";
  const cfg = experiment.settings as Record<string, unknown> | null | undefined;
  const blockType = cfg?.blockType as string | undefined;
  const placement = cfg?.placement as string | undefined;
  const extensionInstalled = cfg?.extensionInstalled as boolean | undefined;

  const INACTIVE_PLACEMENTS = new Set([
    "thank_you", "order_status", "order-status",
    "checkout:thank-you:render-after", "checkout::thank-you::render-after",
  ]);
  const isInactivePlacement = placement ? INACTIVE_PLACEMENTS.has(placement.toLowerCase()) : false;

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Guard: extension not installed */}
      {extensionInstalled === false && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-800">Checkout UI Extension not installed</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              The marginlab-checkout extension must be installed and active in your Shopify theme. Variant blocks will not render without it.
            </p>
          </div>
          <a href="/install-health" className="text-[11px] font-semibold text-red-700 underline shrink-0 mt-0.5 whitespace-nowrap">
            Install health →
          </a>
        </div>
      )}

      {/* Guard: inactive checkout step */}
      {isInactivePlacement && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">Block placed at an inactive checkout step</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Placement <code className="bg-amber-100 px-1 rounded text-[10px]">{placement}</code> targets a post-purchase page (thank you / order status) where Checkout UI Extensions do not render. Change to an active checkout step.
            </p>
          </div>
        </div>
      )}

      {/* Block-level config */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Settings2 className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">Block Configuration</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          <ConfigField label="Block Type" value={blockType ? formatLabel(blockType) : undefined} accent={ACCENT} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Placement</p>
            {placement ? (
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold font-mono" style={{ color: isInactivePlacement ? "#d97706" : ACCENT }}>
                  {placement}
                </p>
                {isInactivePlacement && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">Inactive step</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-300">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Per-variant content */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Variant Content</h2>
        </div>
        <div className="divide-y divide-neutral-50">
          {experiment.variants.map((v) => {
            const vs = v.settings as Record<string, unknown> | null | undefined;
            const title = vs?.title as string | undefined;
            const body = (vs?.body ?? vs?.content ?? vs?.text) as string | undefined;
            const ctaText = (vs?.ctaText ?? vs?.buttonText) as string | undefined;
            const imageUrl = (vs?.imageUrl ?? vs?.image) as string | undefined;
            const hasKnownFields = title || body || ctaText || imageUrl;
            return (
              <div key={v.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-neutral-800">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>Control</span>
                  )}
                </div>
                {hasKnownFields ? (
                  <div className="space-y-1.5">
                    {title && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide w-14 shrink-0 pt-0.5">Title</span>
                        <span className="text-neutral-700 font-medium">{title}</span>
                      </div>
                    )}
                    {body && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide w-14 shrink-0 pt-0.5">Body</span>
                        <span className="text-neutral-600 line-clamp-2">{body}</span>
                      </div>
                    )}
                    {ctaText && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide w-14 shrink-0 pt-0.5">CTA</span>
                        <span className="text-neutral-700 font-medium">{ctaText}</span>
                      </div>
                    )}
                    {imageUrl && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide w-14 shrink-0 pt-0.5">Image</span>
                        <span className="font-mono text-neutral-500 truncate">{imageUrl}</span>
                      </div>
                    )}
                  </div>
                ) : vs && Object.keys(vs).length > 0 ? (
                  <pre className="text-[11px] text-neutral-600 bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-100 overflow-auto max-h-32">
                    {JSON.stringify(vs, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-neutral-400 italic">No content configured</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── DISCOUNT TEST: show discount type + per-variant config ──
function DiscountConfigTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#d97706";
  const cfg = experiment.discountConfig as Record<string, unknown> | null | undefined;
  const discountType = cfg?.discountType as string | undefined;
  const stacking = cfg?.stacking as string | undefined;
  const eligibility = cfg?.eligibility as string | undefined;
  const functionDeployed = cfg?.functionDeployed as boolean | undefined;

  // Check for volume discount tiers in any variant
  const hasVolumeTiers = experiment.variants.some((v) => {
    const dc = v.discountConfig as Record<string, unknown> | null | undefined;
    return Array.isArray(dc?.tiers);
  });

  const stackingConflict = stacking === "ALLOW_ALL" || stacking === "allow_all";

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Guard: function not deployed */}
      {functionDeployed === false && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">Shopify Function not deployed</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              The marginlab-order-discount function must be deployed and active. Discounts will not apply until the function is deployed.
            </p>
          </div>
        </div>
      )}
      {/* Note: stacking conflict risk */}
      {stackingConflict && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">Stacking conflict risk</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              &quot;Allow All&quot; stacking may combine with other active discounts, inflating the discount amount and skewing test results.
            </p>
          </div>
        </div>
      )}
      {/* Global discount config */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Tag className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">Discount Configuration</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-3 gap-4">
          <ConfigField label="Discount Type" value={discountType ? formatLabel(discountType) : undefined} accent={ACCENT} />
          <ConfigField label="Stacking" value={stacking ? formatLabel(stacking) : undefined} accent={ACCENT} />
          <ConfigField label="Eligibility" value={eligibility ? formatLabel(eligibility) : undefined} accent={ACCENT} />
        </div>
      </div>

      {/* Per-variant discount values */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Variant Discount Values</h2>
        </div>
        <div className="divide-y divide-neutral-50">
          {experiment.variants.map((v) => {
            const dc = v.discountConfig as Record<string, unknown> | null | undefined;
            const value = dc?.value as number | string | undefined;
            const tiers = dc?.tiers as Array<Record<string, unknown>> | undefined;
            return (
              <div key={v.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-neutral-800">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>Control</span>
                  )}
                  {value != null && (
                    <span className="ml-auto text-sm font-bold" style={{ color: ACCENT }}>
                      {discountType === "PERCENTAGE" ? `${value}%` : `$${value}`}
                    </span>
                  )}
                </div>
                {hasVolumeTiers && Array.isArray(tiers) && tiers.length > 0 && (
                  <table className="w-full text-xs mt-2 border border-neutral-100 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-100">
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Min Qty</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, ti) => (
                        <tr key={ti} className="border-b border-neutral-50">
                          <td className="px-3 py-2 text-neutral-700">{String(tier.minQty ?? "—")}</td>
                          <td className="px-3 py-2 text-neutral-700">{String(tier.discount ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!dc && <p className="text-xs text-neutral-400 italic">No discount configured</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SHIPPING TEST: show strategy, threshold, message ──
function ShippingConfigTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#0891b2";
  const cfg = experiment.shippingConfig as Record<string, unknown> | null | undefined;
  const strategy = cfg?.strategy as string | undefined;
  const threshold = cfg?.threshold as number | string | undefined;
  const messageTemplate = cfg?.messageTemplate as string | undefined;
  const hideRates = cfg?.hideRates as string[] | undefined;
  const functionDeployed = cfg?.functionDeployed as boolean | undefined;

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Guard: delivery customization function not active */}
      {functionDeployed === false && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">Delivery Customization Function not active</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              The marginlab-delivery-customization function must be deployed and active for shipping rate changes to take effect.
            </p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Truck className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">Shipping Strategy</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          <ConfigField label="Strategy" value={strategy ? formatLabel(strategy) : undefined} accent={ACCENT} />
          <ConfigField label="Threshold" value={threshold != null ? `$${threshold}` : undefined} accent={ACCENT} />
        </div>
        {messageTemplate && (
          <div className="px-5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Message Template</p>
            <div
              className="text-xs px-3 py-2 rounded-lg border font-mono"
              style={{ background: `${ACCENT}05`, borderColor: `${ACCENT}20`, color: ACCENT }}
            >
              {messageTemplate}
            </div>
          </div>
        )}
        {Array.isArray(hideRates) && hideRates.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Hidden Rates</p>
            <div className="flex flex-wrap gap-1.5">
              {hideRates.map((r, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded border border-neutral-200 text-neutral-600 bg-neutral-50">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
        {!cfg && (
          <div className="px-5 pb-5 text-center py-10">
            <p className="text-sm text-neutral-400">No shipping config found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PRICE TEST: show price matrix per variant × product ──
function PriceMatrixTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#e11d48";
  const isRunning = experiment.status === "RUNNING";
  const cfg = experiment.priceConfig as Record<string, unknown> | null | undefined;
  const rolloutState = cfg?.rolloutState as string | undefined;
  const riskConfirmed = cfg?.riskConfirmed as boolean | undefined;

  // Collect all unique product IDs across all variants
  const productIds = new Set<string>();
  for (const v of experiment.variants) {
    const overrides = v.priceOverrides as Array<Record<string, unknown>> | null | undefined;
    if (Array.isArray(overrides)) {
      for (const o of overrides) {
        if (o.productId) productIds.add(String(o.productId));
        if (o.variantId) productIds.add(String(o.variantId));
      }
    }
  }
  const productList = Array.from(productIds);

  // Detect $0 prices and extreme deltas
  let hasZeroPrice = false;
  let hasExtremeDelta = false;
  for (const v of experiment.variants) {
    if (v.isControl) continue;
    const overrides = v.priceOverrides as Array<Record<string, unknown>> | null | undefined;
    if (Array.isArray(overrides)) {
      for (const o of overrides) {
        const p = o.price as number | undefined;
        const d = o.delta as number | undefined;
        if (p === 0) hasZeroPrice = true;
        if (d != null && Math.abs(d) > 50) hasExtremeDelta = true;
      }
    }
  }

  if (productList.length === 0) {
    return (
      <div className="p-6  mx-auto">
        <div className="bg-white rounded-xl border border-neutral-200 py-16 text-center">
          <DollarSign className="w-8 h-8 mx-auto mb-3 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-500 mb-1">No price overrides yet</p>
          <p className="text-xs text-neutral-400 mb-4">Add products to the price matrix to define prices per variant</p>
          <button className="px-4 py-2 text-xs font-medium text-white rounded-lg" style={{ background: ACCENT }}>
            Add Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Risk banner when running */}
      {isRunning && !riskConfirmed && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">Risk review not confirmed</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              This test is live with unconfirmed price changes. Review all prices below and confirm the risk acknowledgment before continuing.
            </p>
          </div>
        </div>
      )}
      {/* $0 price guard */}
      {hasZeroPrice && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">$0 price detected</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              One or more variants have a $0 price. This will make the product free for those visitors.
            </p>
          </div>
        </div>
      )}
      {/* Extreme delta guard */}
      {hasExtremeDelta && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">Extreme price change detected (&gt;50%)</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              A price delta greater than 50% may cause significant customer impact. Double-check the values below.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">Price Matrix</h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
            {productList.length} product{productList.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-500">Product / Variant</th>
                {experiment.variants.map((v) => (
                  <th key={v.id} className="px-4 py-3 text-right font-medium text-neutral-500">
                    {v.name}
                    {v.isControl && <span className="ml-1 text-[9px] opacity-60">(ctrl)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productList.map((pid) => (
                <tr key={pid} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-neutral-600 truncate max-w-xs">{pid}</td>
                  {experiment.variants.map((v) => {
                    const overrides = v.priceOverrides as Array<Record<string, unknown>> | null | undefined;
                    const match = Array.isArray(overrides)
                      ? overrides.find((o) => String(o.productId ?? o.variantId) === pid)
                      : undefined;
                    const price = match?.price as number | string | undefined;
                    const delta = match?.delta as number | undefined;
                    const isZero = !v.isControl && price === 0;
                    const isExtreme = !v.isControl && delta != null && Math.abs(delta) > 50;
                    return (
                      <td
                        key={v.id}
                        className={cn("px-4 py-3 text-right tabular-nums", isZero && "bg-red-50", isExtreme && !isZero && "bg-amber-50")}
                      >
                        {price != null ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={cn("font-medium", isZero ? "text-red-600" : "text-neutral-700")}>${price}</span>
                            {delta != null && (
                              <span
                                className="text-[10px] font-semibold"
                                style={{ color: isExtreme ? "#d97706" : delta >= 0 ? "#059669" : "#dc2626" }}
                              >
                                {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rollout hint panel */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-neutral-700 mb-1">Rollout &amp; Rollback</p>
        <p className="text-[11px] text-neutral-500">
          {rolloutState
            ? `Current rollout state: ${rolloutState.replace(/_/g, " ")}.`
            : "No rollout state configured."}{" "}
          If a price variant is performing poorly, pause the experiment and revert prices via the Price Matrix editor before stopping.
        </p>
      </div>
    </div>
  );
}

// ── OFFER TEST: show offer type, trigger rules, placements, per-variant settings ──
function OfferConfigTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#059669";
  const cfg = experiment.settings as Record<string, unknown> | null | undefined;
  const offerType = cfg?.offerType as string | undefined;
  const placements = cfg?.placements as string[] | undefined;
  const triggerRules = cfg?.triggerRules as Array<Record<string, unknown>> | undefined;

  const ARCHIVED_STATUSES = new Set(["archived", "ARCHIVED", "deleted", "DELETED"]);
  const archivedVariants = experiment.variants.filter(v => {
    const vs = v.settings as Record<string, unknown> | null | undefined;
    const st = String(vs?.offerStatus ?? vs?.status ?? "").toLowerCase();
    return st && ARCHIVED_STATUSES.has(st);
  });

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Guard: archived offer while test active */}
      {archivedVariants.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">Archived offer detected</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              {archivedVariants.map(v => v.name).join(", ")} — the associated offer is archived. Visitors assigned to this variant won&apos;t receive any offer.
            </p>
          </div>
        </div>
      )}

      {/* Global config */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Percent className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">Offer Configuration</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          <ConfigField label="Offer Type" value={offerType ? formatLabel(offerType) : undefined} accent={ACCENT} />
          <ConfigField label="Placements" value={Array.isArray(placements) ? `${placements.length} configured` : undefined} accent={ACCENT} />
        </div>
        {Array.isArray(placements) && placements.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Placement Locations</p>
            <div className="flex flex-wrap gap-1.5">
              {placements.map((p, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                  {formatLabel(p)}
                </span>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(triggerRules) && triggerRules.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Trigger Rules</p>
            <div className="space-y-1.5">
              {triggerRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-neutral-100 bg-neutral-50">
                  <span className="font-medium text-neutral-700">{String(rule.type ?? "—")}</span>
                  {rule.operator != null && <span className="text-neutral-400">{String(rule.operator)}</span>}
                  {rule.value != null && (
                    <span className="font-mono text-neutral-600 bg-white px-1.5 py-0.5 rounded border border-neutral-100">
                      {String(rule.value)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {!cfg && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-neutral-400">No offer config found</p>
          </div>
        )}
      </div>

      {/* Per-variant offer settings */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Variant Offer Settings</h2>
        </div>
        <div className="divide-y divide-neutral-50">
          {experiment.variants.map((v) => {
            const vs = v.settings as Record<string, unknown> | null | undefined;
            const offerValue = vs?.offerValue ?? vs?.discountValue ?? vs?.value;
            const headline = vs?.headline as string | undefined;
            const description = vs?.description as string | undefined;
            const offerStatus = String(vs?.offerStatus ?? vs?.status ?? "").toLowerCase();
            const isArchived = offerStatus && ARCHIVED_STATUSES.has(offerStatus);
            return (
              <div key={v.id} className={cn("px-5 py-4", isArchived && "bg-red-50/40")}>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-neutral-800">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>
                      Control
                    </span>
                  )}
                  {isArchived && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Archived</span>
                  )}
                  {offerValue != null && (
                    <span className="ml-auto text-sm font-bold" style={{ color: ACCENT }}>
                      {offerType === "PERCENTAGE_DISCOUNT" || offerType?.includes("PERCENT")
                        ? `${offerValue}% off`
                        : typeof offerValue === "number"
                        ? `$${offerValue} off`
                        : String(offerValue)}
                    </span>
                  )}
                </div>
                {headline && <p className="text-xs font-medium text-neutral-700 mb-0.5">{headline}</p>}
                {description && <p className="text-xs text-neutral-500">{description}</p>}
                {!headline && !description && offerValue == null && !v.isControl && (
                  <p className="text-xs text-neutral-400 italic">No offer settings configured for this variant</p>
                )}
                {v.isControl && !headline && !description && (
                  <p className="text-xs text-neutral-400 italic">Control — no offer applied</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PERSONALIZATION: audience rules + offers ──
function PersonalizationConfigTab({ experiment }: { experiment: ExperimentData }) {
  const ACCENT = "#4f46e5";
  const cfg = experiment.settings as Record<string, unknown> | null | undefined;
  const audienceRules = cfg?.audienceRules as Array<Record<string, unknown>> | undefined;
  const priority = cfg?.priority as number | string | undefined;
  const scheduleStatus = (cfg?.scheduleStatus ?? cfg?.schedule) as string | undefined;

  const ARCHIVED_STATUSES = new Set(["archived", "ARCHIVED", "deleted", "DELETED"]);
  const archivedOfferVariants = experiment.variants.filter(v => {
    const vs = v.settings as Record<string, unknown> | null | undefined;
    const offers = vs?.offers as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(offers)) return false;
    return offers.some(o => {
      const st = String(o.status ?? "").toLowerCase();
      return st && ARCHIVED_STATUSES.has(st);
    });
  });

  // Priority conflict: if two variants have same priority value
  const priorityValues = experiment.variants.map(v => {
    const vs = v.settings as Record<string, unknown> | null | undefined;
    return vs?.priority as number | undefined;
  }).filter((p): p is number => p != null);
  const hasPriorityConflict = new Set(priorityValues).size < priorityValues.length;

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Guard: archived offer */}
      {archivedOfferVariants.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-800">Archived offer detected</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              {archivedOfferVariants.map(v => v.name).join(", ")} — one or more offers are archived and won&apos;t be shown to visitors.
            </p>
          </div>
        </div>
      )}
      {/* Guard: priority conflict */}
      {hasPriorityConflict && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">Priority conflict</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Multiple variants share the same priority value. Assign unique priorities to ensure deterministic personalization delivery.
            </p>
          </div>
        </div>
      )}

      {/* Global config */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Users2 className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-neutral-900">Personalization Settings</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-3 gap-4">
          <ConfigField label="Priority" value={priority != null ? String(priority) : undefined} accent={ACCENT} />
          <ConfigField label="Schedule Status" value={scheduleStatus ? scheduleStatus.replace(/_/g, " ") : undefined} accent={ACCENT} />
          <ConfigField label="Audience Rules" value={Array.isArray(audienceRules) ? `${audienceRules.length} rule${audienceRules.length !== 1 ? "s" : ""}` : undefined} accent={ACCENT} />
        </div>
        {Array.isArray(audienceRules) && audienceRules.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Audience Rules</p>
            <div className="space-y-1.5">
              {audienceRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                    {i + 1}
                  </span>
                  <span className="text-neutral-700 font-mono truncate">
                    {rule.type ? String(rule.type) : "Unknown rule"}{rule.value ? `: ${String(rule.value)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-variant offers */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Variant Offers</h2>
        </div>
        <div className="divide-y divide-neutral-50">
          {experiment.variants.map((v) => {
            const vs = v.settings as Record<string, unknown> | null | undefined;
            const offers = vs?.offers as Array<Record<string, unknown>> | undefined;
            const vPriority = vs?.priority as number | undefined;
            return (
              <div key={v.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-neutral-800">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>Control</span>
                  )}
                  {vPriority != null && (
                    <span className="text-[10px] text-neutral-500 ml-auto">Priority: {vPriority}</span>
                  )}
                </div>
                {Array.isArray(offers) && offers.length > 0 ? (
                  <div className="space-y-1.5">
                    {offers.map((o, oi) => {
                      const st = String(o.status ?? "").toLowerCase();
                      const isArchived = st && ARCHIVED_STATUSES.has(st);
                      return (
                        <div
                          key={oi}
                          className={cn(
                            "flex items-center gap-2 text-xs px-3 py-2 rounded-lg border",
                            isArchived ? "bg-red-50 border-red-100" : "bg-neutral-50 border-neutral-100"
                          )}
                        >
                          <span className={cn("font-medium truncate", isArchived ? "text-red-700 line-through" : "text-neutral-700")}>
                            {o.title ? String(o.title) : `Offer ${oi + 1}`}
                          </span>
                          {!!o.type && <span className="text-neutral-400 shrink-0">{String(o.type)}</span>}
                          {isArchived && <span className="text-[10px] font-bold text-red-500 shrink-0">Archived</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">No offers configured</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── GENERIC CONFIG: raw JSON fallback ──
function GenericConfigTab({ experiment }: { experiment: ExperimentData }) {
  const cfg = experiment.settings;
  return (
    <div className="p-6  mx-auto">
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900">Configuration</h2>
        </div>
        <div className="p-5">
          {cfg ? (
            <pre className="text-xs text-neutral-600 bg-neutral-50 px-4 py-3 rounded-lg border border-neutral-100 overflow-auto">
              {JSON.stringify(cfg, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-8">No configuration data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TARGETING TAB — real data from targetingRules
// ─────────────────────────────────────────────
function TargetingTab({ experiment }: { experiment: ExperimentData }) {
  const rules = (experiment.targetingRules as Array<Record<string, unknown>> | null | undefined) ?? [];
  const strategy = experiment.assignmentStrategy;
  const trafficAllocation = experiment.trafficAllocation;

  const RULE_TYPE_COLORS: Record<string, string> = {
    DEVICE: "#6366f1",
    VISITOR_TYPE: "#0284c7",
    TRAFFIC_SOURCE: "#059669",
    COUNTRY: "#d97706",
    URL: "#7c3aed",
    QUERY_PARAM: "#e11d48",
    COOKIE: "#0891b2",
    SEGMENT: "#c026d3",
  };

  return (
    <div className="p-6  mx-auto space-y-4">
      {/* Assignment + traffic */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users2 className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900">Assignment & Traffic</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Assignment Strategy</p>
            <p className="text-sm font-semibold text-neutral-800">{formatLabel(strategy)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Traffic Allocation</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${trafficAllocation}%`, background: "#6366f1" }}
                />
              </div>
              <span className="text-sm font-semibold text-neutral-800 shrink-0">{trafficAllocation}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Targeting rules */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Targeting Rules</h2>
            {rules.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                {rules.length} rule{rules.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {rules.length > 1 && (
            <span className="text-[10px] text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded-full border border-neutral-100">
              AND logic
            </span>
          )}
        </div>

        {rules.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Globe className="w-8 h-8 mx-auto mb-3 text-neutral-300" />
            <p className="text-sm font-semibold text-neutral-500 mb-1">All Visitors</p>
            <p className="text-xs text-neutral-400">No targeting rules — this experiment runs for every visitor</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {rules.map((rule, i) => {
              const ruleType = String(rule.type ?? "UNKNOWN").toUpperCase();
              const accentColor = RULE_TYPE_COLORS[ruleType] ?? "#6b7280";
              const operator = rule.operator as string | undefined;
              const value = rule.value;
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: `${accentColor}15`, color: accentColor }}
                  >
                    {ruleType.replace(/_/g, " ")}
                  </span>
                  {operator && (
                    <span className="text-xs text-neutral-400 shrink-0 italic">{operator.toLowerCase()}</span>
                  )}
                  {value != null && (
                    <span className="text-xs font-mono text-neutral-700 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PREVIEW TAB
// ─────────────────────────────────────────────
function PreviewTab({ experiment, shopDomain }: { experiment: ExperimentData; shopDomain?: string }) {
  const splitCfg = experiment.splitUrlConfig as Record<string, unknown> | null | undefined;
  const controlPath = splitCfg?.baseUrl as string | undefined;

  // Build a storefront preview URL for a given variant.
  // Uses the control URL as the entry point and appends the marginlab_preview param.
  function previewHref(variantKey: string): string {
    const param = `marginlab_preview=${experiment.id}:${variantKey}`;
    if (!controlPath) return "#";
    if (controlPath.startsWith("http")) {
      const sep = controlPath.includes("?") ? "&" : "?";
      return `${controlPath}${sep}${param}`;
    }
    const origin = shopDomain
      ? `https://${shopDomain.replace(/^https?:\/\//, "")}`
      : "";
    const sep = controlPath.includes("?") ? "&" : "?";
    return `${origin}${controlPath}${sep}${param}`;
  }

  const hasStore = !!(shopDomain && controlPath);

  return (
    <div className="p-6 mx-auto space-y-4">
      {/* Slug hint */}
      <div className="bg-white rounded-xl border border-neutral-200 px-5 py-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Preview links</p>
        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
          Each button opens your live store with a forced variant assignment so you can verify the redirect without affecting real visitors.
          The link uses the experiment ID as the preview key — no changes to the test config needed.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {experiment.variants.map((v) => {
            const href = previewHref(v.key);
            return (
              <a
                key={v.id}
                href={hasStore ? href : undefined}
                onClick={!hasStore ? (e) => { e.preventDefault(); alert("Shop domain not available — manually visit your store URL and append:\n?" + `marginlab_preview=${experiment.id}:${v.key}`); } : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview {v.name}
              </a>
            );
          })}
        </div>
        {hasStore && controlPath && (
          <p className="text-[11px] text-neutral-400 mt-3 font-mono break-all">
            Entry point: {`https://${shopDomain!.replace(/^https?:\/\//, "")}${controlPath}`}
          </p>
        )}
      </div>

      {/* How it works */}
      <div className="bg-neutral-50 rounded-xl border border-neutral-100 px-5 py-4 text-xs text-neutral-500 leading-relaxed space-y-1.5">
        <p className="font-semibold text-neutral-700">How preview mode works</p>
        <p>Preview forces a specific variant assignment for your browser session only. Real visitors are unaffected.</p>
        <p>You can also append the preview param manually to any store URL:</p>
        <code className="block bg-white border border-neutral-200 rounded px-3 py-2 text-[11px] font-mono text-neutral-700 break-all">
          ?marginlab_preview={experiment.id}:variant_a
        </code>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONFIGURE ANALYTICS TAB
// ─────────────────────────────────────────────
const METRICS_CONFIG = [
  { key: "conversion_rate", label: "Conversion Rate", desc: "Orders divided by unique visitors", primary: true },
  { key: "revenue_per_visitor", label: "Revenue Per Visitor (RPV)", desc: "Total revenue divided by unique visitors" },
  { key: "profit_per_visitor", label: "Profit Per Visitor", desc: "Gross profit divided by visitors" },
  { key: "average_order_value", label: "Average Order Value (AOV)", desc: "Average revenue per order placed" },
  { key: "gross_profit", label: "Gross Profit", desc: "Revenue minus cost of goods sold" },
  { key: "add_to_cart_rate", label: "Add to Cart Rate", desc: "Visitors who added a product to cart" },
  { key: "checkout_begin_rate", label: "Checkout - begin rate", desc: "Visitors who reached checkout" },
];

function AnalyticsConfigTab({ experiment }: { experiment: ExperimentData }) {
  return (
    <div className="p-6  mx-auto">
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Metrics to track</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Select which metrics appear in your results</p>
        </div>
        <div className="divide-y divide-neutral-50">
          {METRICS_CONFIG.map((m) => (
            <div key={m.key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50">
              <div
                className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-brand-600"
              >
                <Check className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-neutral-800">{m.label}</p>
                  {m.primary && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-600">
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">{m.desc}</p>
              </div>
              <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// QA / HEALTH TAB
// ─────────────────────────────────────────────
function QAHealthTab({ experiment }: { experiment: ExperimentData }) {
  const checks = buildQAChecks(experiment);

  return (
    <div className="p-6  mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900">Health Checks</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">
            {checks.filter(c => c.status === "pass").length}/{checks.length} passing
          </span>
        </div>
        <div className="divide-y divide-neutral-50">
          {checks.map((check, i) => (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold
                ${check.status === "pass" ? "bg-emerald-100 text-emerald-700" :
                  check.status === "fail" ? "bg-red-100 text-red-700" :
                  check.status === "warn" ? "bg-amber-100 text-amber-700" :
                  "bg-neutral-100 text-neutral-500"}`}>
                {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : check.status === "warn" ? "!" : "?"}
              </span>
              <div className="flex-1">
                <p className="text-xs font-medium text-neutral-800">{check.label}</p>
                {check.description && <p className="text-[11px] text-neutral-400 mt-0.5">{check.description}</p>}
              </div>
              {check.action && (
                <a href={check.actionHref ?? "#"} className="text-[11px] text-brand-600 hover:underline shrink-0">
                  {check.action}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-medium text-amber-800">Manual verification required</p>
        <p className="text-xs text-amber-700 mt-1">
          Some checks require manual verification on your Shopify store. Use the{" "}
          <a href="/debug" className="underline font-medium">Debug &amp; QA</a> page to inspect assignments and events.
        </p>
      </div>
    </div>
  );
}

type QACheck = {
  label: string;
  status: "pass" | "fail" | "warn" | "unknown";
  description?: string;
  action?: string;
  actionHref?: string;
};

function buildQAChecks(experiment: ExperimentData): QACheck[] {
  const type = experiment.type;
  const hasAssignments = experiment._count.assignments > 0;
  const hasEvents = experiment._count.events > 0;
  const allVariantsHaveAllocation = experiment.variants.every(v => v.allocationPercent > 0);
  const totalAllocation = experiment.variants.reduce((s, v) => s + v.allocationPercent, 0);

  const common: QACheck[] = [
    {
      label: "Traffic allocation sums to 100%",
      status: Math.abs(totalAllocation - 100) < 0.1 ? "pass" : "fail",
      description: `Current total: ${totalAllocation}%`,
    },
    {
      label: "All variants have allocation > 0%",
      status: allVariantsHaveAllocation ? "pass" : "fail",
    },
    {
      label: "Visitor assignments detected",
      status: hasAssignments ? "pass" : experiment.status === "DRAFT" ? "unknown" : "warn",
      description: hasAssignments ? `${experiment._count.assignments.toLocaleString()} total assignments` : "No assignments recorded yet",
    },
    {
      label: "Events received from storefront",
      status: hasEvents ? "pass" : experiment.status === "DRAFT" ? "unknown" : "warn",
      description: hasEvents ? `${experiment._count.events.toLocaleString()} events tracked` : "No events yet — check Web Pixel is active",
      action: "Open Debug",
      actionHref: "/debug",
    },
    {
      label: "Web Pixel active",
      status: "unknown",
      description: "Verify Web Pixel is enabled in Shopify admin",
      action: "Check install health",
      actionHref: "/install-health",
    },
  ];

  const typeChecks: QACheck[] = [];

  if (type === "CONTENT_TEST") {
    const cfg = experiment.contentConfig as Record<string, unknown> | null | undefined;
    const urlPattern = cfg?.urlPattern as string | undefined;

    // Per-selector health check
    let totalMods = 0;
    let brokenMods = 0;
    for (const v of experiment.variants) {
      if (v.isControl) continue;
      const mods = v.modifications as Array<Record<string, unknown>> | null | undefined;
      if (Array.isArray(mods)) {
        for (const m of mods) {
          totalMods++;
          const sel = String(m.selector ?? "").trim();
          const ct = String(m.changeType ?? m.type ?? "").trim();
          if (!sel || !KNOWN_CHANGE_TYPES.has(ct)) brokenMods++;
        }
      }
    }
    const validMods = totalMods - brokenMods;

    typeChecks.push(
      { label: "URL pattern configured", status: urlPattern ? "pass" : "fail", description: urlPattern ?? "No URL pattern set" },
      { label: "Modifications defined", status: totalMods > 0 ? "pass" : "warn", description: `${totalMods} total modifications across variants` },
      {
        label: `Selector health: ${validMods}/${totalMods} valid`,
        status: brokenMods === 0 ? (totalMods > 0 ? "pass" : "unknown") : "fail",
        description: brokenMods > 0
          ? `${brokenMods} modification${brokenMods > 1 ? "s" : ""} have invalid selectors and won't apply to the page`
          : totalMods > 0 ? "All selectors are well-formed" : "No modifications to check",
        action: brokenMods > 0 ? "View Modifications tab" : undefined,
        actionHref: brokenMods > 0 ? "?tab=modifications" : undefined,
      },
      {
        label: "Anti-flicker latency",
        status: "unknown",
        description: "Script must execute before first paint (target < 50ms) — cannot be verified server-side",
        action: "Check install health",
        actionHref: "/install-health",
      },
      { label: "Theme App Embed enabled", status: "unknown", description: "Must be active in Shopify theme editor", action: "Check", actionHref: "/install-health" },
      {
        label: "Content change events tracked",
        status: hasEvents ? "pass" : experiment.status === "DRAFT" ? "unknown" : "warn",
        description: hasEvents
          ? `${experiment._count.events.toLocaleString()} events received from storefront`
          : "No events yet — verify Web Pixel is active and tracking content interactions",
        action: "Debug",
        actionHref: "/debug",
      },
    );
  }

  if (type === "SPLIT_URL_TEST") {
    const allHaveUrls = experiment.variants.every(v => !!resolveSplitUrl(v, experiment.splitUrlConfig));
    const urls = experiment.variants
      .map(v => resolveSplitUrl(v, experiment.splitUrlConfig))
      .filter(Boolean) as string[];
    const hasDuplicates = new Set(urls).size !== urls.length;
    const splitCfg = experiment.splitUrlConfig as Record<string, unknown> | null | undefined;
    const loopProtection = splitCfg?.loopProtection as boolean | undefined;
    typeChecks.push(
      { label: "All variants have URLs configured", status: allHaveUrls ? "pass" : "fail" },
      { label: "No duplicate URLs between variants", status: hasDuplicates ? "fail" : "pass", description: hasDuplicates ? "Duplicate URLs detected — visitors may be redirected incorrectly" : undefined },
      {
        label: "URL reachability",
        status: "unknown",
        description: "HTTP status cannot be verified from the admin — open each URL to confirm 200 OK",
        action: "View Routes",
        actionHref: "?tab=modifications",
      },
      {
        label: "Loop protection configured",
        status: loopProtection === true ? "pass" : loopProtection === false ? "fail" : "unknown",
        description: loopProtection === true
          ? "Loop detection is active"
          : loopProtection === false
          ? "Loop protection is disabled — risk of infinite redirect"
          : "Cannot determine from config — verify in storefront script",
      },
      { label: "Theme App Embed enabled", status: "unknown", description: "Required for storefront tracking script", action: "Check", actionHref: "/install-health" },
      {
        label: "Canonical tags on variant pages",
        status: "unknown",
        description: "Add <link rel=\"canonical\"> pointing to the control URL on all variant pages to prevent SEO duplication",
      },
    );
  }

  if (type === "CHECKOUT_TEST") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const placement = cfg?.placement as string | undefined;
    const extensionInstalled = cfg?.extensionInstalled as boolean | undefined;

    const INACTIVE_PLACEMENTS = new Set([
      "thank_you", "order_status", "order-status",
      "checkout:thank-you:render-after", "checkout::thank-you::render-after",
    ]);
    const isInactivePlacement = placement ? INACTIVE_PLACEMENTS.has(placement.toLowerCase()) : false;

    const emptyContentVariants = experiment.variants.filter(v => {
      const vs = v.settings as Record<string, unknown> | null | undefined;
      return !v.isControl && (!vs || Object.keys(vs).length === 0);
    }).length;

    typeChecks.push(
      { label: "Block type configured", status: cfg?.blockType ? "pass" : "fail" },
      {
        label: "Placement configured",
        status: !placement ? "fail" : isInactivePlacement ? "fail" : "pass",
        description: isInactivePlacement
          ? `"${placement}" targets a post-purchase page — blocks don't render there`
          : placement ?? "No placement set",
      },
      {
        label: "Checkout UI Extension installed",
        status: extensionInstalled === true ? "pass" : extensionInstalled === false ? "fail" : "unknown",
        description: extensionInstalled === true
          ? "Extension is active in Shopify theme"
          : extensionInstalled === false
          ? "Extension not installed — blocks will not render for any variant"
          : "Cannot determine — check in Shopify theme editor",
        action: "Check install health",
        actionHref: "/install-health",
      },
      {
        label: "All variants have block content",
        status: emptyContentVariants === 0 ? "pass" : "warn",
        description: emptyContentVariants > 0
          ? `${emptyContentVariants} non-control variant${emptyContentVariants > 1 ? "s" : ""} have no content configured`
          : undefined,
      },
      {
        label: "Block impression events received",
        status: hasEvents ? "pass" : experiment.status === "DRAFT" ? "unknown" : "warn",
        description: hasEvents
          ? `${experiment._count.events.toLocaleString()} impression events tracked`
          : "No events — verify the Checkout UI Extension is rendering in checkout",
        action: "Debug",
        actionHref: "/debug",
      },
    );
  }

  if (type === "DISCOUNT_TEST") {
    const cfg = experiment.discountConfig as Record<string, unknown> | null | undefined;
    typeChecks.push(
      { label: "Discount type configured", status: cfg?.discountType ? "pass" : "fail" },
      { label: "Shopify Discount Function deployed", status: "unknown", description: "Verify marginlab-order-discount is deployed", action: "Check", actionHref: "/install-health" },
      { label: "Stacking rules configured", status: cfg?.stacking ? "pass" : "warn", description: cfg?.stacking ? undefined : "Stacking rules not set — may conflict with other discounts" },
    );
  }

  if (type === "SHIPPING_TEST") {
    const cfg = experiment.shippingConfig as Record<string, unknown> | null | undefined;
    typeChecks.push(
      { label: "Shipping strategy configured", status: cfg?.strategy ? "pass" : "fail" },
      { label: "Delivery Customization Function active", status: "unknown", description: "Verify marginlab-delivery-customization is deployed", action: "Check", actionHref: "/install-health" },
    );
  }

  if (type === "PRICE_TEST") {
    const cfg = experiment.priceConfig as Record<string, unknown> | null | undefined;
    const productCount = experiment.variants.reduce((max, v) => {
      const overrides = v.priceOverrides as unknown[] | null | undefined;
      return Math.max(max, Array.isArray(overrides) ? overrides.length : 0);
    }, 0);
    typeChecks.push(
      { label: "Products configured in price matrix", status: productCount > 0 ? "pass" : "fail", description: `${productCount} products configured` },
      { label: "Enforcement strategy set", status: cfg?.enforcement ? "pass" : "warn" },
      { label: "Risk review completed", status: (cfg?.riskConfirmed as boolean | undefined) ? "pass" : "warn", description: "Confirm you have reviewed all price changes" },
    );
  }

  if (type === "OFFER_TEST") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const placements = cfg?.placements as unknown[] | undefined;

    // Check for archived variants
    const ARCHIVED = new Set(["archived", "deleted"]);
    const archivedCount = experiment.variants.filter(v => {
      const vs = v.settings as Record<string, unknown> | null | undefined;
      const st = String(vs?.offerStatus ?? vs?.status ?? "").toLowerCase();
      return st && ARCHIVED.has(st);
    }).length;

    typeChecks.push(
      {
        label: "Offer type configured",
        status: cfg?.offerType ? "pass" : "fail",
        description: cfg?.offerType ? `Type: ${String(cfg.offerType).replace(/_/g, " ")}` : "No offer type set",
      },
      {
        label: "At least one placement configured",
        status: Array.isArray(placements) && placements.length > 0 ? "pass" : "warn",
        description: Array.isArray(placements) && placements.length > 0
          ? `${placements.length} placement${placements.length !== 1 ? "s" : ""} configured`
          : "No placements set — offer may not render",
      },
      {
        label: "Offer activation status",
        status: archivedCount > 0 ? "fail" : "unknown",
        description: archivedCount > 0
          ? `${archivedCount} variant${archivedCount > 1 ? "s have" : " has"} an archived offer — visitors won't receive the offer`
          : "Verify the offer is active in Shopify admin",
        action: archivedCount === 0 ? "Check" : undefined,
        actionHref: archivedCount === 0 ? "/install-health" : undefined,
      },
      {
        label: "Shopify Discount Function deployed",
        status: "unknown",
        description: "marginlab-order-discount function must be deployed and active",
        action: "Check",
        actionHref: "/install-health",
      },
      {
        label: "Offer rendering in cart / checkout",
        status: "unknown",
        description: "Manually verify the offer displays correctly for each variant variant",
        action: "Debug",
        actionHref: "/debug",
      },
    );
  }

  if (type === "PERSONALIZATION") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const audienceRules = cfg?.audienceRules as unknown[] | undefined;
    const priority = cfg?.priority as number | undefined;

    const ARCHIVED = new Set(["archived", "deleted"]);
    const archivedOfferCount = experiment.variants.filter(v => {
      const vs = v.settings as Record<string, unknown> | null | undefined;
      const offers = vs?.offers as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(offers)) return false;
      return offers.some(o => ARCHIVED.has(String(o.status ?? "").toLowerCase()));
    }).length;

    typeChecks.push(
      {
        label: "Audience rules configured",
        status: Array.isArray(audienceRules) && audienceRules.length > 0 ? "pass" : "warn",
        description: Array.isArray(audienceRules) && audienceRules.length > 0
          ? `${audienceRules.length} rule${audienceRules.length !== 1 ? "s" : ""} configured`
          : "No audience rules — this personalization will apply to all visitors",
        action: "View Config",
        actionHref: "?tab=modifications",
      },
      {
        label: "Priority set",
        status: priority != null ? "pass" : "warn",
        description: priority != null
          ? `Priority: ${priority}`
          : "No priority set — personalization delivery order may be unpredictable",
      },
      {
        label: "No archived offers",
        status: archivedOfferCount > 0 ? "fail" : "pass",
        description: archivedOfferCount > 0
          ? `${archivedOfferCount} variant${archivedOfferCount > 1 ? "s have" : " has"} archived offers — those visitors won't receive personalized content`
          : undefined,
        action: archivedOfferCount > 0 ? "View Config" : undefined,
        actionHref: archivedOfferCount > 0 ? "?tab=modifications" : undefined,
      },
      {
        label: "Impression events received",
        status: hasEvents ? "pass" : experiment.status === "DRAFT" ? "unknown" : "warn",
        description: hasEvents
          ? `${experiment._count.events.toLocaleString()} impression events tracked`
          : "No events — verify the personalization is rendering for qualifying visitors",
        action: "Debug",
        actionHref: "/debug",
      },
    );
  }

  return [...common, ...typeChecks];
}

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────

function ConfigField({ label, value, accent }: { label: string; value: string | undefined; accent: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">{label}</p>
      {value ? (
        <p className="text-sm font-semibold" style={{ color: accent }}>{value}</p>
      ) : (
        <p className="text-sm text-neutral-300">—</p>
      )}
    </div>
  );
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateMockTimeSeries(numVariants: number) {
  const days = 8;
  const names = ["Control Group", "New Group 1", "New Group 2", "New Group 3"].slice(0, numVariants);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const entry: Record<string, string | number> = { date: label };
    names.forEach((name, j) => {
      entry[name] = parseFloat((1.2 + j * 0.3 + Math.sin(i * 0.8 + j) * 0.5 + i * 0.15).toFixed(2));
    });
    return entry;
  });
}
