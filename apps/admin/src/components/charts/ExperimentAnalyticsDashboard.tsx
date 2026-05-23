"use client";

import { useState, useCallback, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { ExperimentAnalytics, SegmentItem, SegmentDimension } from "@/services/analytics.service";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

const VARIANT_COLORS = [
  "#6B7280", // control — neutral gray
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
];

type MetricKey = "conversionRate" | "revenuePerVisitor" | "aov" | "profitPerVisitor";

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "conversionRate", label: "Conversion Rate" },
  { key: "revenuePerVisitor", label: "Revenue per Visitor" },
  { key: "aov", label: "Avg Order Value" },
  { key: "profitPerVisitor", label: "Profit per Visitor" },
];

const SEGMENT_OPTIONS: Array<{ value: SegmentDimension; label: string }> = [
  { value: "deviceType", label: "Device" },
  { value: "country", label: "Country" },
  { value: "utmSource", label: "UTM Source" },
];

type TimeSeriesPoint = Record<string, number | string>;

interface Props {
  experimentId: string;
  initialAnalytics: ExperimentAnalytics;
  initialTimeSeries: TimeSeriesPoint[];
  currencyCode: string;
}

function toDateStr(d: Date | string) {
  return new Date(d).toISOString().split("T")[0]!;
}

export function ExperimentAnalyticsDashboard({
  experimentId,
  initialAnalytics,
  initialTimeSeries,
  currencyCode,
}: Props) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [timeSeries, setTimeSeries] = useState(initialTimeSeries);
  const [metric, setMetric] = useState<MetricKey>("conversionRate");
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => toDateStr(initialAnalytics.dateRange.start));
  const [endDate, setEndDate] = useState(() => toDateStr(initialAnalytics.dateRange.end));

  // Segment breakdown state
  const [segmentDimension, setSegmentDimension] = useState<SegmentDimension>("deviceType");
  const [segmentData, setSegmentData] = useState<SegmentItem[] | null>(null);
  const [segmentLoading, setSegmentLoading] = useState(false);

  const refetch = useCallback(
    async (start: string, end: string, m: MetricKey) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ start, end, metric: m });
        const res = await fetch(`/api/experiments/${experimentId}/analytics?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          analytics: ExperimentAnalytics;
          timeSeries: TimeSeriesPoint[];
        };
        setAnalytics(data.analytics);
        setTimeSeries(data.timeSeries ?? []);
      } finally {
        setLoading(false);
      }
    },
    [experimentId]
  );

  const fetchSegments = useCallback(
    async (dim: SegmentDimension, start: string, end: string) => {
      setSegmentLoading(true);
      try {
        const params = new URLSearchParams({ dimension: dim, start, end });
        const res = await fetch(
          `/api/experiments/${experimentId}/analytics/segments?${params}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { breakdown: SegmentItem[] };
        setSegmentData(data.breakdown);
      } finally {
        setSegmentLoading(false);
      }
    },
    [experimentId]
  );

  // Load segments when dimension or date range changes
  useEffect(() => {
    fetchSegments(segmentDimension, startDate, endDate);
  }, [fetchSegments, segmentDimension, startDate, endDate]);

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    refetch(start, end, metric);
  };

  const handleMetricChange = (m: MetricKey) => {
    setMetric(m);
    refetch(startDate, endDate, m);
  };

  const variants = analytics.variants;

  const formatMetricValue = (value: number) => {
    if (metric === "conversionRate") return formatPercent(value);
    return formatCurrency(value, currencyCode);
  };

  // Funnel data derived from analytics variants (no extra API call needed)
  const funnelData = variants.map((v, i) => ({
    variantKey: v.variantKey,
    variantName: v.variantName,
    isControl: v.isControl,
    color: VARIANT_COLORS[i % VARIANT_COLORS.length]!,
    stages: [
      { stage: "Visitors", count: v.visitors },
      { stage: "Add to Cart", count: v.addToCarts },
      { stage: "Checkout", count: v.checkoutsStarted },
      { stage: "Orders", count: v.orders },
    ],
  }));

  // Bar chart: one row per variant with key metrics
  const barData = variants.map((v) => ({
    name: v.variantName,
    "Conv %": parseFloat((v.conversionRate * 100).toFixed(2)),
    "RPV": parseFloat(v.revenuePerVisitor.toFixed(2)),
    "AOV": parseFloat(v.aov.toFixed(2)),
  }));

  // Time series points with formatted date labels
  const timeSeriesFormatted = timeSeries.map((pt) => ({
    ...pt,
    _dateLabel:
      typeof pt["date"] === "number"
        ? format(new Date(pt["date"]), "MMM d")
        : String(pt["date"]),
  }));

  const variantKeys = variants.map((v) => v.variantKey);

  // Segment pivot: dimensionValue → { [variantKey]: visitors }
  type SegmentRow = { label: string } & Record<string, number>;
  const segmentRows: SegmentRow[] = [];
  if (segmentData) {
    const labelMap = new Map<string, Record<string, number>>();
    for (const item of segmentData) {
      if (!labelMap.has(item.dimensionValue)) {
        labelMap.set(item.dimensionValue, {});
      }
      labelMap.get(item.dimensionValue)![item.variantKey] = item.visitors;
    }
    for (const [label, counts] of labelMap) {
      segmentRows.push({ label, ...counts } as unknown as SegmentRow);
    }
    segmentRows.sort((a, b) => {
      const totalA = variantKeys.reduce((s, k) => s + (a[k] ?? 0), 0);
      const totalB = variantKeys.reduce((s, k) => s + (b[k] ?? 0), 0);
      return totalB - totalA;
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700">From</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => handleDateChange(e.target.value, endDate)}
              className="text-sm border border-neutral-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => handleDateChange(startDate, e.target.value)}
              className="text-sm border border-neutral-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium text-neutral-700">Metric</label>
            <select
              value={metric}
              onChange={(e) => handleMetricChange(e.target.value as MetricKey)}
              className="text-sm border border-neutral-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {loading && (
            <span className="text-xs text-neutral-400 animate-pulse">Refreshing…</span>
          )}
        </div>
      </Card>

      {/* ── Variant summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {variants.map((v, i) => {
          const test = v.conversionRateTest;
          const isWinner = test?.isSignificant && test.recommendation === "variant";
          const isLoser = test?.isSignificant && test.recommendation === "control";
          return (
            <div
              key={v.variantId}
              className="bg-white rounded-xl border border-neutral-200 p-4 space-y-1"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                />
                <span className="text-xs font-medium text-neutral-600 truncate">
                  {v.variantName}
                  {v.isControl && (
                    <span className="ml-1 text-neutral-400">(control)</span>
                  )}
                </span>
              </div>
              <p className="text-2xl font-semibold text-neutral-900 tabular-nums">
                {formatPercent(v.conversionRate)}
              </p>
              <p className="text-xs text-neutral-500">
                {formatCurrency(v.revenuePerVisitor, currencyCode)} RPV ·{" "}
                {formatCurrency(v.aov, currencyCode)} AOV
              </p>
              <p className="text-xs text-neutral-500">
                {formatNumber(v.visitors)} visitors · {v.orders} orders
              </p>
              {!v.isControl && test && (
                <p
                  className={`text-xs font-medium ${
                    isWinner
                      ? "text-success-600"
                      : isLoser
                      ? "text-danger-600"
                      : "text-neutral-400"
                  }`}
                >
                  {isWinner && `↑ ${formatPercent(test.relativeLift)} (significant)`}
                  {isLoser && `↓ ${formatPercent(Math.abs(test.relativeLift))} (significant)`}
                  {!test.isSignificant && "Not significant yet"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Time series chart ── */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5 pb-4 border-b border-neutral-100">
          <CardTitle>
            {METRICS.find((m) => m.key === metric)?.label} over time
          </CardTitle>
        </CardHeader>
        <div className="p-5">
          {timeSeriesFormatted.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
              No daily data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={timeSeriesFormatted}
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="_dateLabel"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatMetricValue}
                  width={72}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatMetricValue(value),
                    name,
                  ]}
                  labelStyle={{ color: "#374151", fontWeight: 600, fontSize: 12 }}
                  contentStyle={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {variantKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── Variant comparison bar chart ── */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5 pb-4 border-b border-neutral-100">
          <CardTitle>Variant comparison</CardTitle>
        </CardHeader>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Conv %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="RPV" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="AOV" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Conversion funnel ── */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5 pb-4 border-b border-neutral-100">
          <CardTitle>Conversion funnel</CardTitle>
        </CardHeader>
        <div className="p-5">
          {variants.every((v) => v.visitors === 0) ? (
            <div className="text-center py-8 text-sm text-neutral-500">
              No visitor data yet
            </div>
          ) : (
            <div
              className="grid gap-8"
              style={{
                gridTemplateColumns: `repeat(${Math.min(variants.length, 3)}, 1fr)`,
              }}
            >
              {funnelData.map((vf) => {
                const maxCount = vf.stages[0]?.count ?? 1;
                return (
                  <div key={vf.variantKey}>
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: vf.color }}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        {vf.variantName}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {vf.stages.map((stage, si) => {
                        const pct =
                          maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                        const dropFromPrev =
                          si > 0 && (vf.stages[si - 1]?.count ?? 0) > 0
                            ? (stage.count / vf.stages[si - 1]!.count) * 100
                            : null;
                        return (
                          <div key={stage.stage}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-neutral-500">{stage.stage}</span>
                              <span className="font-medium text-neutral-700 tabular-nums">
                                {formatNumber(stage.count)}
                                {dropFromPrev !== null && (
                                  <span className="text-neutral-400 ml-1.5">
                                    {dropFromPrev.toFixed(0)}%
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-100 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: vf.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ── Segment breakdown ── */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <CardTitle>Segment breakdown</CardTitle>
          <div className="flex gap-1">
            {SEGMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSegmentDimension(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  segmentDimension === opt.value
                    ? "bg-brand-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <div className="p-5">
          {segmentLoading ? (
            <div className="text-center py-8 text-sm text-neutral-400 animate-pulse">
              Loading…
            </div>
          ) : segmentRows.length === 0 ? (
            <div className="text-center py-8 text-sm text-neutral-500">
              No segment data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="text-left text-xs font-semibold text-neutral-500 uppercase pb-2 pr-4">
                      {SEGMENT_OPTIONS.find((o) => o.value === segmentDimension)?.label}
                    </th>
                    {variants.map((v, i) => (
                      <th
                        key={v.variantId}
                        className="text-right text-xs font-semibold text-neutral-500 uppercase pb-2 px-3"
                      >
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ color: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                        >
                          {v.variantName}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {segmentRows.slice(0, 15).map((row) => (
                    <tr key={row.label} className="hover:bg-neutral-50">
                      <td className="py-2 pr-4 text-neutral-700 font-medium">
                        {row.label || <span className="text-neutral-400">(none)</span>}
                      </td>
                      {variants.map((v) => (
                        <td
                          key={v.variantId}
                          className="py-2 px-3 text-right text-neutral-600 tabular-nums"
                        >
                          {formatNumber(row[v.variantKey] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {segmentRows.length > 15 && (
                <p className="text-xs text-neutral-400 mt-3 text-right">
                  Showing top 15 of {segmentRows.length}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
