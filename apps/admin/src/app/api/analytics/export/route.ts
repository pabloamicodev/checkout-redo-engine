import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "@/services/analytics.service";
import { withShopAuth } from "@/lib/api-middleware";

const analyticsService = new AnalyticsService();

// CSV helpers
function escapeCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(",");
}

/**
 * GET /api/analytics/export
 *
 * Query params:
 *   type=pl           — P&L report across all experiments (default)
 *   type=experiment   — single experiment variant breakdown
 *   experimentId=...  — required when type=experiment
 *   startDate=...     — ISO date
 *   endDate=...       — ISO date
 *   format=csv        — only CSV supported for now
 */
export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, currencyCode: true },
    });
    if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    return exportCsv(shop, request);
  });
}

async function exportCsv(
  shop: { id: string; currencyCode: string },
  request: NextRequest
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "pl";
  const experimentId = searchParams.get("experimentId") ?? undefined;
  const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
  const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

  if (startDate && isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }
  if (endDate && isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
  }

  const lines: string[] = [];
  const filename =
    type === "experiment" && experimentId
      ? `experiment-${experimentId}-analytics.csv`
      : "marginlab-pl-report.csv";

  if (type === "experiment" && experimentId) {
    // ── Single experiment variant breakdown ──────────────────────────────────
    const analytics = await analyticsService.getExperimentAnalytics(
      shop.id,
      experimentId,
      startDate && endDate ? { start: startDate, end: endDate } : undefined
    );

    if (!analytics) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    lines.push(csvRow(["MarginLab Analytics Export"]));
    lines.push(csvRow(["Experiment", analytics.experimentName]));
    lines.push(csvRow(["Date range", analytics.dateRange.start.toISOString().split("T")[0], analytics.dateRange.end.toISOString().split("T")[0]]));
    lines.push(csvRow(["Currency", shop.currencyCode]));
    lines.push("");
    lines.push(csvRow([
      "Variant", "Is Control", "Visitors", "Sessions", "Add to Carts", "Checkouts",
      "Orders", "Conversion Rate", "Revenue", "Net Revenue", "AOV",
      "Revenue per Visitor", "Gross Profit", "Profit per Visitor",
      "Lift vs Control", "P-Value", "Is Significant",
    ]));

    for (const v of analytics.variants) {
      lines.push(csvRow([
        v.variantName,
        v.isControl ? "Yes" : "No",
        v.visitors,
        v.sessions,
        v.addToCarts,
        v.checkoutsStarted,
        v.orders,
        (v.conversionRate * 100).toFixed(2) + "%",
        v.revenue.toFixed(2),
        v.netRevenue.toFixed(2),
        v.aov.toFixed(2),
        v.revenuePerVisitor.toFixed(2),
        v.grossProfit.toFixed(2),
        v.profitPerVisitor.toFixed(2),
        v.conversionRateTest ? ((v.conversionRateTest.relativeLift ?? 0) * 100).toFixed(2) + "%" : "N/A",
        v.conversionRateTest ? v.conversionRateTest.pValue.toFixed(4) : "N/A",
        v.conversionRateTest ? (v.conversionRateTest.isSignificant ? "Yes" : "No") : "N/A",
      ]));
    }

    lines.push("");
    lines.push(csvRow(["Summary"]));
    lines.push(csvRow(["Total visitors", analytics.summary.totalVisitors]));
    lines.push(csvRow(["Total orders", analytics.summary.totalOrders]));
    lines.push(csvRow(["Total revenue", analytics.summary.totalRevenue.toFixed(2)]));
    lines.push(csvRow(["Days running", analytics.summary.daysRunning]));
    lines.push(csvRow(["Winner found", analytics.summary.hasWinner ? "Yes" : "No"]));
  } else {
    // ── P&L report across all experiments ───────────────────────────────────
    const experiments = await prisma.experiment.findMany({
      where: {
        shopId: shop.id,
        status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
        launchedAt: { not: null },
      },
      orderBy: { launchedAt: "desc" },
      take: 50,
      select: { id: true, name: true, type: true, status: true, launchedAt: true },
    });

    lines.push(csvRow(["MarginLab P&L Report"]));
    lines.push(csvRow(["Generated", new Date().toISOString()]));
    lines.push(csvRow(["Currency", shop.currencyCode]));
    lines.push("");
    lines.push(csvRow([
      "Experiment", "Type", "Status", "Launched At",
      "Variant", "Is Control", "Visitors", "Orders", "Conversion Rate",
      "Revenue", "Net Revenue", "Gross Profit", "Contribution Margin %",
      "Lift", "P-Value", "Significant",
    ]));

    // Batch-fetch all experiment analytics in parallel to avoid N+1 sequential queries
    const analyticsResults = await Promise.all(
      experiments.map((exp: { id: string }) => analyticsService.getExperimentAnalytics(shop.id, exp.id))
    );

    for (let i = 0; i < experiments.length; i++) {
      const exp = experiments[i]!;
      const analytics = analyticsResults[i];
      if (!analytics) continue;

      for (const v of analytics.variants) {
        lines.push(csvRow([
          exp.name,
          exp.type,
          exp.status,
          exp.launchedAt?.toISOString().split("T")[0] ?? "",
          v.variantName,
          v.isControl ? "Yes" : "No",
          v.visitors,
          v.orders,
          (v.conversionRate * 100).toFixed(2) + "%",
          v.revenue.toFixed(2),
          v.netRevenue.toFixed(2),
          v.grossProfit.toFixed(2),
          v.profitPerVisitor > 0 && v.revenuePerVisitor > 0
            ? ((v.grossProfit / v.revenue) * 100).toFixed(1) + "%"
            : "N/A",
          v.conversionRateTest ? ((v.conversionRateTest.relativeLift ?? 0) * 100).toFixed(2) + "%" : "N/A",
          v.conversionRateTest ? v.conversionRateTest.pValue.toFixed(4) : "N/A",
          v.conversionRateTest ? (v.conversionRateTest.isSignificant ? "Yes" : "No") : "N/A",
        ]));
      }
    }
  }

  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
