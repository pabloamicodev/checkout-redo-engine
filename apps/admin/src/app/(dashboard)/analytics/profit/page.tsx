import Link from "next/link";
import { Card, CardHeader, CardTitle, MetricCard } from "@/components/ui/Card";
import { getStatusTheme } from "@/lib/design/statusTheme";
import { prisma } from "@/lib/prisma";
import { AnalyticsService, type ExperimentAnalytics, type VariantMetrics } from "@/services/analytics.service";
import { CogsService } from "@/services/cogs.service";
import { formatCurrency, formatPercent, formatRelativeLift } from "@/lib/utils";
import { TrendingUp, DollarSign, BarChart3, AlertTriangle, ExternalLink, Download } from "lucide-react";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
const analyticsService = new AnalyticsService();
const cogsService = new CogsService();

type ExperimentMetricItem = {
  experiment: { id: string; name: string; type: string; status: string; launchedAt: Date | null };
  analytics: ExperimentAnalytics | null;
};

async function getData(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, currencyCode: true },
  });
  if (!shop) return null;

  const experiments = await prisma.experiment.findMany({
    where: {
      shopId: shop.id,
      status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
      launchedAt: { not: null },
    },
    select: { id: true, name: true, type: true, status: true, launchedAt: true },
    orderBy: { launchedAt: "desc" },
    take: 20,
  });

  const [shopSummary, coverage] = await Promise.all([
    prisma.orderAttribution.aggregate({
      where: { shopId: shop.id },
      _sum: {
        netRevenue: true,
        cogs: true,
        grossProfit: true,
        totalDiscounts: true,
        estimatedShippingCost: true,
        transactionFee: true,
      },
      _count: true,
    }),
    cogsService.getCoverage(shop.id),
  ]);

  type ExperimentRow = (typeof experiments)[number];

  // Fetch analytics per experiment in parallel (max 10 at a time)
  const experimentMetrics: ExperimentMetricItem[] = await Promise.all(
    experiments.map(async (exp: ExperimentRow) => {
      const analytics = await analyticsService.getExperimentAnalytics(shop.id, exp.id);
      return { experiment: exp, analytics };
    })
  );

  return {
    currencyCode: shop.currencyCode,
    shopSummary,
    coverage,
    experimentMetrics,
  };
}

export default async function ProfitAnalyticsPage() {
    const shopDomain = await getSessionShop();
  const data = await getData(shopDomain);

  if (!data) {
    return (
      <div className="flex-1 overflow-auto bg-neutral-50">
        <div className=" mx-auto px-8 py-8">
          <Card className="text-center py-12">
            <p className="text-neutral-500">Shop not found</p>
          </Card>
        </div>
      </div>
    );
  }

  const { currencyCode, shopSummary, coverage, experimentMetrics } = data;

  const totalRevenue = shopSummary._sum.netRevenue ?? 0;
  const totalCogs = shopSummary._sum.cogs ?? 0;
  const totalGrossProfit = shopSummary._sum.grossProfit ?? 0;
  const totalOrders = shopSummary._count;
  const overallMargin = totalRevenue > 0 ? totalGrossProfit / totalRevenue : 0;

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className=" mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Profit Analytics</h1>
          <p className="text-sm text-neutral-400 mt-0.5">P&L breakdown by experiment and variant</p>
        </div>

        <div className="space-y-6">
        {/* Export button */}
        <div className="flex justify-end">
          <a
            href="/api/analytics/export?type=pl"
            download="marginlab-pl-report.csv"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
        </div>

        {/* COGS coverage warning */}
        {coverage.belowWarningThreshold && (
          <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning-800">
                Low COGS coverage ({coverage.coveragePct}%)
              </p>
              <p className="text-xs text-warning-700 mt-0.5">
                {coverage.ordersLast30Days - coverage.ordersWithCogs} of{" "}
                {coverage.ordersLast30Days} attributed orders in the last 30 days are
                missing COGS data — gross profit figures may be understated.{" "}
                <Link href="/cogs" className="font-medium underline">
                  Configure COGS →
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Shop-wide P&L summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Attributed Revenue"
            value={formatCurrency(totalRevenue, currencyCode)}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <MetricCard
            label="Total COGS"
            value={formatCurrency(totalCogs, currencyCode)}
            icon={<DollarSign className="w-4 h-4" />}
          />
          <MetricCard
            label="Gross Profit"
            value={formatCurrency(totalGrossProfit, currencyCode)}
            icon={<BarChart3 className="w-4 h-4" />}
          />
          <MetricCard
            label="Avg Margin"
            value={formatPercent(overallMargin)}
            changeLabel={`${totalOrders} attributed orders`}
            icon={<BarChart3 className="w-4 h-4" />}
          />
        </div>

        {/* Profit formula reference */}
        <div className="text-xs text-neutral-500 bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-100">
          <strong className="text-neutral-700">Formula: </strong>
          Net Revenue − COGS − Estimated Shipping − Transaction Fees = Gross Profit
        </div>

        {/* Per-experiment P&L tables */}
        {experimentMetrics.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-sm text-neutral-500">No launched experiments yet</p>
          </Card>
        ) : (
          experimentMetrics.map(({ experiment, analytics }: ExperimentMetricItem) => {
            if (!analytics || analytics.variants.length === 0) return null;

            const control = analytics.variants.find((v: VariantMetrics) => v.isControl);
            const variants = analytics.variants;

            return (
              <Card key={experiment.id} padding="none">
                <CardHeader className="px-5 pt-5 pb-4 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle>{experiment.name}</CardTitle>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {experiment.type.replace(/_/g, " ").toLowerCase()} ·{" "}
                          {analytics.summary.daysRunning} days ·{" "}
                          {analytics.summary.totalVisitors.toLocaleString()} visitors
                        </p>
                      </div>
                      {(() => { const st = getStatusTheme(experiment.status); return (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border" style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.hex }} />
                          {experiment.status.charAt(0) + experiment.status.slice(1).toLowerCase()}
                        </span>
                      ); })()}
                    </div>
                    <Link
                      href={`/experiments/${experiment.id}/analytics`}
                      className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      Full analytics
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Variant</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Visitors</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Orders</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Revenue</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">COGS</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Gross Profit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">PPV</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">vs Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {variants.map((v: VariantMetrics) => {
                        const margin =
                          v.netRevenue > 0 ? v.grossProfit / v.netRevenue : 0;
                        const ppvLift =
                          !v.isControl && control && control.profitPerVisitor > 0
                            ? (v.profitPerVisitor - control.profitPerVisitor) /
                              control.profitPerVisitor
                            : null;
                        const isPositiveLift = ppvLift !== null && ppvLift > 0;

                        return (
                          <tr key={v.variantId} className="hover:bg-neutral-50">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-neutral-900">
                                  {v.variantName}
                                </span>
                                {v.isControl && (
                                  <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                                    control
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-neutral-600 tabular-nums">
                              {v.visitors.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-neutral-600 tabular-nums">
                              {v.orders}
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-medium text-neutral-900 tabular-nums">
                              {formatCurrency(v.netRevenue, currencyCode)}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-neutral-600 tabular-nums">
                              {v.cogs > 0 ? formatCurrency(v.cogs, currencyCode) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs tabular-nums">
                              <div>
                                <span
                                  className={
                                    v.grossProfit >= 0 ? "text-success-700 font-medium" : "text-danger-700 font-medium"
                                  }
                                >
                                  {formatCurrency(v.grossProfit, currencyCode)}
                                </span>
                                {v.netRevenue > 0 && (
                                  <span className="text-neutral-400 block text-xs">
                                    {formatPercent(margin)} margin
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-medium text-neutral-900 tabular-nums">
                              {formatCurrency(v.profitPerVisitor, currencyCode)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {v.isControl ? (
                                <span className="text-xs text-neutral-400">baseline</span>
                              ) : ppvLift !== null ? (
                                <span
                                  className={`text-xs font-medium ${
                                    isPositiveLift ? "text-success-600" : "text-danger-600"
                                  }`}
                                >
                                  {formatRelativeLift(ppvLift)}
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* P&L totals row */}
                    <tfoot>
                      <tr className="border-t border-neutral-200 bg-neutral-50">
                        <td className="px-5 py-3 text-xs font-semibold text-neutral-600">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 tabular-nums">
                          {analytics.summary.totalVisitors.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 tabular-nums">
                          {analytics.summary.totalOrders}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 tabular-nums">
                          {formatCurrency(analytics.summary.totalRevenue, currencyCode)}
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
