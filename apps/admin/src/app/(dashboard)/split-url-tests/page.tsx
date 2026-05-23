import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Split URL Tests — MarginLab" };

export default async function SplitUrlTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "SPLIT_URL_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "SPLIT_URL_TEST" } }),
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
        apiPath="/api/split-url-tests"
        newPath="/split-url-tests/new"
        newLabel="New Split URL Test"
        detailBasePath="/split-url-tests"
        accentHex="#0284c7"
        typeLabel="Split URL Tests"
        typeDescription="Route a percentage of visitors to an alternate URL and measure conversion impact."
        typeEmptyTitle="No split URL tests yet"
        typeEmptyBody="Route visitors to a different landing page and measure the impact."
      />
    </div>
  );
}
