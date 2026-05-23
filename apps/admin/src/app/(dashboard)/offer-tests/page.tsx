import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Offer Tests — MarginLab" };

export default async function OfferTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "OFFER_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "OFFER_TEST" } }),
  ]);

  type ExperimentItem = (typeof items)[number];


  const initialItems = items.map((e: ExperimentItem) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    variantCount: e.variants.length,
    updatedAt: e.updatedAt.toISOString(),
    launchedAt: e.launchedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
      <ExperimentTypeList
        initialItems={initialItems}
        initialTotal={total}
        apiPath="/api/offer-tests"
        newPath="/offer-tests/new"
        newLabel="New Offer Test"
        detailBasePath="/offer-tests"
        accentHex="#059669"
        typeLabel="Offer Tests"
        typeDescription="A/B test free gifts, bundles, upsells, and promotional offers."
        typeEmptyTitle="No offer tests yet"
        typeEmptyBody="Test which offer drives more purchases — free gift, bundle, or discount."
      />
    </div>
  );
}

