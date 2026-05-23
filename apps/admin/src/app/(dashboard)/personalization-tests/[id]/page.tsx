import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "@/services/analytics.service";
import { ExperimentDetailShell } from "@/components/experiments/ExperimentDetailShell";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Personalization Test — MarginLab" };

const analyticsService = new AnalyticsService();

export default async function PersonalizationTestDetailPage({
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
    where: { id, shopId: shop.id, type: "PERSONALIZATION_TEST" },
    include: {
      variants: { orderBy: { isControl: "desc" } },
      mutuallyExclusiveGroup: true,
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
      tab={tab}
      breadcrumb={{ href: "/personalization-tests", label: "Personalization Tests" }}
    />
  );
}
