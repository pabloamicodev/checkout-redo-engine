import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Price Tests — MarginLab" };

export default async function PriceTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "PRICE_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "PRICE_TEST" } }),
  ]);

  const initialItems = items.map((e) => ({
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
        apiPath="/api/price-tests"
        newPath="/price-tests/new"
        newLabel="New Price Test"
        detailBasePath="/price-tests"
        accentHex="#e11d48"
        typeLabel="Price Tests"
        typeDescription="A/B test product prices with display-only or Shopify Function enforcement."
        typeEmptyTitle="No price tests yet"
        typeEmptyBody="Measure price elasticity and find the price that maximizes profit per visitor."
      />
    </div>
  );
}
