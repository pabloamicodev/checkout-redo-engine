import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "@/services/analytics.service";
import { ExperimentDetailShell } from "@/components/experiments/ExperimentDetailShell";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Price Test — MarginLab" };

const analyticsService = new AnalyticsService();

export default async function PriceTestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "groups" } = await searchParams;
  const shopDomain = await getSessionShop();

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, currencyCode: true },
  });
  if (!shop) return notFound();

  const experiment = await prisma.experiment.findFirst({
    where: { id, shopId: shop.id, type: "PRICE_TEST" },
    select: {
      id: true, name: true, type: true, status: true, slug: true, hypothesis: true,
      primaryMetric: true, trafficAllocation: true, assignmentStrategy: true, launchedAt: true,
      contentConfig: true, splitUrlConfig: true, priceConfig: true, discountConfig: true,
      shippingConfig: true, targetingRules: true, settings: true,
      variants: {
        orderBy: { isControl: "desc" },
        select: { id: true, name: true, key: true, isControl: true, allocationPercent: true, redirectUrl: true, modifications: true, priceOverrides: true, discountConfig: true, settings: true, checkoutBlockIds: true, offerIds: true },
      },
      mutuallyExclusiveGroup: { select: { name: true } },
      _count: { select: { assignments: true, orderAttributions: true, events: true } },
    },
  });
  if (!experiment) return notFound();

  const analytics = await analyticsService.getExperimentAnalytics(shop.id, id).catch(() => null);

  return (
    <ExperimentDetailShell
      experiment={experiment}
      analytics={analytics}
      currencyCode={shop.currencyCode}
      shopDomain={shopDomain}
      tab={tab}
      breadcrumb={{ href: "/price-tests", label: "Price Tests" }}
    />
  );
}
