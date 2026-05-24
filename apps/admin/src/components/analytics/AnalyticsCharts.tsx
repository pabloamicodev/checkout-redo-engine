"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailyPoint = {
  date: string; // "YYYY-MM-DD"
  revenue: number;
  participants: number;
};

type Period = 7 | 30;

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const INDIGO  = "#6366f1";
const SKY     = "#0ea5e9";
const EMERALD = "#10b981";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAxisDate(iso: string, period: Period): string {
  const d = new Date(iso + "T00:00:00");
  if (period === 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(v: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return v.toString();
}

// ---------------------------------------------------------------------------
// Period toggle
// ---------------------------------------------------------------------------

function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
      {([7, 30] as Period[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all duration-150"
          style={{
            background: value === p ? "#fff" : "transparent",
            color: value === p ? "#1e293b" : "#94a3b8",
            boxShadow: value === p ? "0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
          }}
        >
          {p}d
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltips
// ---------------------------------------------------------------------------

function RevenueTooltip({
  active,
  payload,
  currency,
}: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  const date = payload[0]?.payload?.date as string | undefined;
  return (
    <div
      className="rounded-xl border border-neutral-100 bg-white px-3.5 py-2.5 shadow-2xl"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)" }}
    >
      {date && (
        <p className="text-[10px] font-medium text-neutral-400 mb-1">
          {formatTooltipDate(date)}
        </p>
      )}
      <p className="text-sm font-bold text-neutral-900">
        {formatMoney(v, currency)}
      </p>
      <p className="text-[10px] text-neutral-400">attributed revenue</p>
    </div>
  );
}

function ParticipantsTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  const date = payload[0]?.payload?.date as string | undefined;
  return (
    <div
      className="rounded-xl border border-neutral-100 bg-white px-3.5 py-2.5 shadow-2xl"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)" }}
    >
      {date && (
        <p className="text-[10px] font-medium text-neutral-400 mb-1">
          {formatTooltipDate(date)}
        </p>
      )}
      <p className="text-sm font-bold text-neutral-900">
        {v.toLocaleString()}
      </p>
      <p className="text-[10px] text-neutral-400">visitors enrolled</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart card wrapper
// ---------------------------------------------------------------------------

function ChartCard({
  title,
  subtitle,
  total,
  totalLabel,
  accentColor,
  period,
  onPeriodChange,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  total: string;
  totalLabel: string;
  accentColor: string;
  period: Period;
  onPeriodChange: (p: Period) => void;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              {subtitle}
            </p>
            <p className="text-2xl font-bold text-neutral-900 tracking-tight mt-0.5">
              {total}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">{totalLabel}</p>
          </div>
          <PeriodToggle value={period} onChange={onPeriodChange} />
        </div>
      </div>

      {/* Chart area */}
      <div className="px-2 pb-4" style={{ height: 200 }}>
        {empty ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ background: `${accentColor}12` }}
              >
                <div className="w-3 h-3 rounded-sm" style={{ background: accentColor, opacity: 0.4 }} />
              </div>
              <p className="text-xs text-neutral-400">No data yet for this period</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue area chart
// ---------------------------------------------------------------------------

export function RevenueChart({
  data,
  currency = "USD",
}: {
  data: DailyPoint[];
  currency?: string;
}) {
  const [period, setPeriod] = useState<Period>(30);

  const sliced = useMemo(
    () => data.slice(-period),
    [data, period]
  );

  const total = useMemo(
    () => sliced.reduce((s, d) => s + d.revenue, 0),
    [sliced]
  );

  const hasData = sliced.some((d) => d.revenue > 0);
  const tickInterval = period === 7 ? 0 : Math.floor(sliced.length / 5);

  return (
    <ChartCard
      title="Revenue"
      subtitle={`Revenue · last ${period} days`}
      total={formatMoney(total, currency)}
      totalLabel="attributed in period"
      accentColor={INDIGO}
      period={period}
      onPeriodChange={setPeriod}
      empty={!hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sliced} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={INDIGO} stopOpacity={0.18} />
              <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="#f1f5f9"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 500 }}
            tickFormatter={(v) => formatAxisDate(v as string, period)}
            interval={tickInterval}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v) => {
              if (v === 0) return "$0";
              if (v >= 1000) return `$${formatK(v as number)}`;
              return `$${v}`;
            }}
            width={44}
          />
          <Tooltip
            content={<RevenueTooltip currency={currency} />}
            cursor={{
              stroke: INDIGO,
              strokeWidth: 1,
              strokeDasharray: "4 3",
              strokeOpacity: 0.5,
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={INDIGO}
            strokeWidth={2}
            fill="url(#revGrad)"
            dot={false}
            activeDot={{
              r: 4,
              fill: INDIGO,
              stroke: "#fff",
              strokeWidth: 2,
            }}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Participants bar chart
// ---------------------------------------------------------------------------

export function ParticipantsChart({ data }: { data: DailyPoint[] }) {
  const [period, setPeriod] = useState<Period>(30);

  const sliced = useMemo(
    () => data.slice(-period),
    [data, period]
  );

  const total = useMemo(
    () => sliced.reduce((s, d) => s + d.participants, 0),
    [sliced]
  );

  const hasData = sliced.some((d) => d.participants > 0);
  const tickInterval = period === 7 ? 0 : Math.floor(sliced.length / 5);

  return (
    <ChartCard
      title="Participants"
      subtitle={`Visitors enrolled · last ${period} days`}
      total={formatK(total)}
      totalLabel="visitors in period"
      accentColor={SKY}
      period={period}
      onPeriodChange={setPeriod}
      empty={!hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sliced} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="38%">
          <defs>
            <linearGradient id="partGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={SKY} stopOpacity={1} />
              <stop offset="100%" stopColor={SKY} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="#f1f5f9"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 500 }}
            tickFormatter={(v) => formatAxisDate(v as string, period)}
            interval={tickInterval}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v) => formatK(v as number)}
            width={36}
          />
          <Tooltip
            content={<ParticipantsTooltip />}
            cursor={{ fill: `${SKY}08`, radius: 4 }}
          />
          <Bar
            dataKey="participants"
            fill="url(#partGrad)"
            radius={[3, 3, 0, 0]}
            maxBarSize={20}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Profit vs revenue stacked area chart (bonus — shows margin health)
// ---------------------------------------------------------------------------

export type DailyProfitPoint = {
  date: string;
  revenue: number;
  profit: number;
};

function ProfitTooltip({
  active,
  payload,
  currency,
}: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const rev = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const profit = payload.find((p) => p.dataKey === "profit")?.value ?? 0;
  const date = payload[0]?.payload?.date as string | undefined;
  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : "—";
  return (
    <div
      className="rounded-xl border border-neutral-100 bg-white px-3.5 py-2.5 shadow-2xl min-w-[140px]"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)" }}
    >
      {date && (
        <p className="text-[10px] font-medium text-neutral-400 mb-2">
          {formatTooltipDate(date)}
        </p>
      )}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: INDIGO }} />
            Revenue
          </span>
          <span className="text-[11px] font-semibold text-neutral-900">{formatMoney(rev, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: EMERALD }} />
            Profit
          </span>
          <span className="text-[11px] font-semibold" style={{ color: EMERALD }}>{formatMoney(profit, currency)}</span>
        </div>
        <div className="pt-1 border-t border-neutral-50 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400">Margin</span>
          <span className="text-[10px] font-bold text-neutral-600">{margin}%</span>
        </div>
      </div>
    </div>
  );
}

export function ProfitChart({
  data,
  currency = "USD",
}: {
  data: DailyProfitPoint[];
  currency?: string;
}) {
  const [period, setPeriod] = useState<Period>(30);

  const sliced = useMemo(() => data.slice(-period), [data, period]);

  const totalRevenue = useMemo(() => sliced.reduce((s, d) => s + d.revenue, 0), [sliced]);
  const totalProfit = useMemo(() => sliced.reduce((s, d) => s + d.profit, 0), [sliced]);
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0";

  const hasData = sliced.some((d) => d.revenue > 0);
  const tickInterval = period === 7 ? 0 : Math.floor(sliced.length / 5);

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Revenue &amp; Profit · last {period} days
            </p>
            <div className="flex items-baseline gap-3 mt-0.5">
              <p className="text-2xl font-bold text-neutral-900 tracking-tight">
                {formatMoney(totalRevenue, currency)}
              </p>
              <span className="text-sm font-semibold" style={{ color: EMERALD }}>
                {formatMoney(totalProfit, currency)} profit
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">{margin}% average margin</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ background: INDIGO }} />
                Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ background: EMERALD }} />
                Profit
              </span>
            </div>
            <PeriodToggle value={period} onChange={setPeriod} />
          </div>
        </div>
      </div>

      <div className="px-2 pb-4" style={{ height: 200 }}>
        {!hasData ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-neutral-400">No attributed orders yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={INDIGO} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profProfitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={EMERALD} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 500 }}
                tickFormatter={(v) => formatAxisDate(v as string, period)}
                interval={tickInterval}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => (v >= 1000 ? `$${formatK(v as number)}` : `$${v}`)}
                width={44}
              />
              <Tooltip
                content={<ProfitTooltip currency={currency} />}
                cursor={{ stroke: INDIGO, strokeWidth: 1, strokeDasharray: "4 3", strokeOpacity: 0.4 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={INDIGO}
                strokeWidth={2}
                fill="url(#profRevGrad)"
                dot={false}
                activeDot={{ r: 4, fill: INDIGO, stroke: "#fff", strokeWidth: 2 }}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke={EMERALD}
                strokeWidth={2}
                fill="url(#profProfitGrad)"
                dot={false}
                activeDot={{ r: 4, fill: EMERALD, stroke: "#fff", strokeWidth: 2 }}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
