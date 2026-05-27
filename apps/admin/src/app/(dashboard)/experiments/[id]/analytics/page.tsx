import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "@/services/analytics.service";
import { ExperimentAnalyticsDashboard } from "@/components/charts/ExperimentAnalyticsDashboard";
import { getSessionShop } from "@/lib/session-shop";

const analyticsService = new AnalyticsService();

async function getData(shopDomain: string, experimentId: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, currencyCode: true },
  });
  if (!shop) return null;

  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, shopId: shop.id },
    select: { id: true, name: true, type: true },
  });
  if (!experiment) return null;

  const [analytics, timeSeries] = await Promise.all([
    analyticsService.getExperimentAnalytics(shop.id, experimentId),
    analyticsService.getTimeSeriesData(shop.id, experimentId, "conversionRate"),
  ]);

  if (!analytics) return null;

  return {
    experiment,
    analytics,
    timeSeries: timeSeries ?? [],
    currencyCode: shop.currencyCode,
  };
}

export default async function ExperimentAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shopDomain = await getSessionShop();
  const data = await getData(shopDomain, id);

  if (!data) return notFound();

  const { experiment, analytics, timeSeries, currencyCode } = data;

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <div>
          <Link
            href={`/experiments/${id}`}
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to experiment
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-neutral-400 mt-0.5">{experiment.name}</p>
        </div>

        <ExperimentAnalyticsDashboard
          experimentId={id}
          initialAnalytics={analytics}
          initialTimeSeries={timeSeries as Record<string, number | string>[]}
          currencyCode={currencyCode}
        />
      </div>
    </div>
  );
}
