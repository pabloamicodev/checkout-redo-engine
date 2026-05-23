import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Discount Tests — MarginLab" };

export default async function DiscountTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "DISCOUNT_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "DISCOUNT_TEST" } }),
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
        apiPath="/api/discount-tests"
        newPath="/discount-tests/new"
        newLabel="New Discount Test"
        detailBasePath="/discount-tests"
        accentHex="#d97706"
        typeLabel="Discount Tests"
        typeDescription="A/B test discount codes, automatic discounts, and promotional stacking rules."
        typeEmptyTitle="No discount tests yet"
        typeEmptyBody="Find the discount amount and structure that maximizes revenue and profit."
      />
    </div>
  );
}
