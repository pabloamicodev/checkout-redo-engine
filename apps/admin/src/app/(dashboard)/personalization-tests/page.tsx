import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Personalization Tests — MarginLab" };

export default async function PersonalizationTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "PERSONALIZATION_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "PERSONALIZATION_TEST" } }),
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
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <ExperimentTypeList
          initialItems={initialItems}
          initialTotal={total}
          apiPath="/api/personalization-tests"
          newPath="/personalization-tests/new"
          newLabel="New Personalization"
          detailBasePath="/personalization-tests"
          accentHex="#c026d3"
          typeLabel="Personalization Tests"
          typeDescription="Target specific visitor segments with tailored content, offers, and UI changes."
          typeEmptyTitle="No personalization tests yet"
          typeEmptyBody="Serve different experiences to different segments — returning customers, mobile visitors, high-cart-value shoppers."
        />
      </div>
    </div>
  );
}

