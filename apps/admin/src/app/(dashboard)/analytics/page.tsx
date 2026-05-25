import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, TrendingUp, ShoppingCart, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getSessionShop } from "@/lib/session-shop";
import { getTestTypeTheme } from "@/lib/design/testTypeTheme";
import { RevenueChart, ParticipantsChart, ProfitChart, type DailyPoint, type DailyProfitPoint } from "@/components/analytics/AnalyticsCharts";

type RunningExperiment = NonNullable<Awaited<ReturnType<typeof getAnalyticsOverview>>>["runningExperiments"][number];
type RecentOrder = NonNullable<Awaited<ReturnType<typeof getAnalyticsOverview>>>["recentOrders"][number];


export const dynamic = 'force-dynamic';

function buildDaySeries(daysBack = 30): string[] {
  return Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

async function getAnalyticsOverview(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, currencyCode: true },
  });
  if (!shop) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalRevenue,
    totalAssignments,
    runningExperiments,
    recentOrders,
    rawRevenue,
    rawParticipants,
  ] = await Promise.all([
    prisma.orderAttribution.aggregate({
      where: { shopId: shop.id },
      _sum: { netRevenue: true, grossProfit: true, totalDiscounts: true },
      _count: true,
    }),
    prisma.experimentAssignment.count({ where: { shopId: shop.id } }),
    prisma.experiment.findMany({
      where: { shopId: shop.id, status: "RUNNING" },
      include: {
        variants: true,
        _count: { select: { assignments: true, orderAttributions: true } },
      },
      orderBy: { launchedAt: "desc" },
      take: 5,
    }),
    prisma.orderAttribution.findMany({
      where: { shopId: shop.id },
      orderBy: { attributedAt: "desc" },
      take: 10,
      select: {
        shopifyOrderName: true,
        netRevenue: true,
        grossProfit: true,
        currencyCode: true,
        financialStatus: true,
        attributedAt: true,
        experiment: { select: { name: true } },
        variant: { select: { name: true } },
      },
    }),
    // Time-series: 30 days of revenue + profit
    prisma.orderAttribution.findMany({
      where: { shopId: shop.id, attributedAt: { gte: thirtyDaysAgo } },
      select: { attributedAt: true, netRevenue: true, grossProfit: true },
      orderBy: { attributedAt: "asc" },
    }),
    // Time-series: 30 days of participant enrollments
    prisma.experimentAssignment.findMany({
      where: { shopId: shop.id, firstSeenAt: { gte: thirtyDaysAgo } },
      select: { firstSeenAt: true },
      orderBy: { firstSeenAt: "asc" },
    }),
  ]);

  // Build 30-day time series
  const days = buildDaySeries(30);

  type RawRevRec = { attributedAt: Date; netRevenue: number; grossProfit: number | null };
  type RawParRec = { firstSeenAt: Date };

  const revenueByDay: DailyPoint[] = days.map((day) => {
    const dayRecords = (rawRevenue as RawRevRec[]).filter(
      (r) => r.attributedAt.toISOString().slice(0, 10) === day
    );
    return {
      date: day,
      revenue: dayRecords.reduce((s, r) => s + r.netRevenue, 0),
      participants: 0,
    };
  });

  const participantsByDay: DailyPoint[] = days.map((day) => ({
    date: day,
    revenue: 0,
    participants: (rawParticipants as RawParRec[]).filter(
      (p) => p.firstSeenAt.toISOString().slice(0, 10) === day
    ).length,
  }));

  const profitByDay: DailyProfitPoint[] = days.map((day) => {
    const dayRecords = (rawRevenue as RawRevRec[]).filter(
      (r) => r.attributedAt.toISOString().slice(0, 10) === day
    );
    return {
      date: day,
      revenue: dayRecords.reduce((s, r) => s + r.netRevenue, 0),
      profit: dayRecords.reduce((s, r) => s + (r.grossProfit ?? 0), 0),
    };
  });

  return {
    currencyCode: shop.currencyCode,
    totalRevenue: totalRevenue._sum.netRevenue ?? 0,
    totalProfit: totalRevenue._sum.grossProfit ?? 0,
    totalOrders: totalRevenue._count,
    totalAssignments,
    runningExperiments,
    recentOrders,
    revenueByDay,
    participantsByDay,
    profitByDay,
  };
}

export default async function AnalyticsPage() {
  const shopDomain = await getSessionShop();
  const data = await getAnalyticsOverview(shopDomain);

  if (!data) {
    return (
      <div className="flex-1 overflow-auto bg-neutral-50">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <p className="text-sm text-neutral-400">Shop not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Analytics</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Platform-wide performance overview</p>
          </div>
          <Link
            href="/analytics/profit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Profit &amp; Loss report
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Attributed Revenue", value: formatCurrency(data.totalRevenue, data.currencyCode), icon: <TrendingUp className="w-4 h-4" />, iconColor: "#10b981", iconBg: "rgba(16,185,129,0.1)" },
            { label: "Gross Profit", value: formatCurrency(data.totalProfit, data.currencyCode), icon: <BarChart3 className="w-4 h-4" />, iconColor: "#6366f1", iconBg: "rgba(99,102,241,0.1)" },
            { label: "Attributed Orders", value: data.totalOrders.toLocaleString(), icon: <ShoppingCart className="w-4 h-4" />, iconColor: "#0ea5e9", iconBg: "rgba(14,165,233,0.1)" },
            { label: "Visitors Tracked", value: data.totalAssignments >= 1000 ? `${(data.totalAssignments / 1000).toFixed(1)}k` : data.totalAssignments.toLocaleString(), icon: <Users className="w-4 h-4" />, iconColor: "#f59e0b", iconBg: "rgba(245,158,11,0.1)" },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-neutral-200 shadow-card p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-neutral-500">{m.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: m.iconBg, color: m.iconColor }}>{m.icon}</div>
              </div>
              <p className="text-2xl font-bold text-neutral-900 tracking-tight">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-5">
          <RevenueChart data={data.revenueByDay} currency={data.currencyCode} />
          <ParticipantsChart data={data.participantsByDay} />
        </div>

        {/* Revenue vs Profit full-width */}
        <ProfitChart data={data.profitByDay} currency={data.currencyCode} />

        {/* Running experiments */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800">Running Experiments</span>
            <Link href="/experiments?status=RUNNING" className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-brand-600 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.runningExperiments.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">No running experiments</div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {(data.runningExperiments as RunningExperiment[]).map((exp) => {
                const typeTheme = getTestTypeTheme(exp.type);
                return (
                  <Link key={exp.id} href={`/experiments/${exp.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 transition-colors group">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeTheme.dotHex }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-brand-600 transition-colors">{exp.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {exp._count.assignments.toLocaleString()} visitors · {exp._count.orderAttributions} orders · {exp.variants.length} variants
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full border font-medium shrink-0"
                      style={{ background: `${typeTheme.hex}10`, color: typeTheme.hex, borderColor: `${typeTheme.hex}25` }}>
                      {typeTheme.shortLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent attributed orders */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100">
            <span className="text-sm font-semibold text-neutral-800">Recent Attributed Orders</span>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">No attributed orders yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Experiment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Variant</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {(data.recentOrders as RecentOrder[]).map((order, i) => (
                  <tr key={i} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-neutral-700">{order.shopifyOrderName}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500 max-w-[160px] truncate">{order.experiment?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{order.variant?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-neutral-900 tabular-nums">
                      {formatCurrency(order.netRevenue, order.currencyCode)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium tabular-nums">
                      <span className={order.grossProfit !== null && order.grossProfit >= 0 ? "text-success-600" : "text-danger-600"}>
                        {order.grossProfit !== null ? formatCurrency(order.grossProfit, order.currencyCode) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
