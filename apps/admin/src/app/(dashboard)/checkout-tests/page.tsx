import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Checkout Tests — MarginLab" };

export default async function CheckoutTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "CHECKOUT_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "CHECKOUT_TEST" } }),
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
        apiPath="/api/checkout-tests"
        newPath="/checkout-tests/new"
        newLabel="New Checkout Test"
        detailBasePath="/checkout-tests"
        accentHex="#4f46e5"
        typeLabel="Checkout Tests"
        typeDescription="A/B test checkout block layouts, trust signals, and upsell placements."
        typeEmptyTitle="No checkout tests yet"
        typeEmptyBody="Add trust badges, urgency banners, or social proof blocks to your checkout."
      />
    </div>
  );
}
