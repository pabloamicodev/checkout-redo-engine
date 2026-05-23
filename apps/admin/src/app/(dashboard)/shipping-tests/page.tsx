import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Shipping Tests — MarginLab" };

export default async function ShippingTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "SHIPPING_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "SHIPPING_TEST" } }),
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
        apiPath="/api/shipping-tests"
        newPath="/shipping-tests/new"
        newLabel="New Shipping Test"
        detailBasePath="/shipping-tests"
        accentHex="#0891b2"
        typeLabel="Shipping Tests"
        typeDescription="A/B test free shipping thresholds, method visibility, and progress bars."
        typeEmptyTitle="No shipping tests yet"
        typeEmptyBody="Test free shipping thresholds or rename methods to boost AOV."
      />
    </div>
  );
}

