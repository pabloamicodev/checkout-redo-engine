import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Content Tests — MarginLab" };

export default async function ContentTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain }, select: { id: true } });

  if (!shop) {
    return <div className="p-8 text-center"><p className="text-sm text-neutral-500">Shop not found.</p></div>;
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "CONTENT_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, status: true, updatedAt: true, launchedAt: true, variants: { select: { id: true } } },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "CONTENT_TEST" } }),
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
        apiPath="/api/content-tests"
        newPath="/content-tests/new"
        newLabel="New Content Test"
        detailBasePath="/content-tests"
        accentHex="#7c3aed"
        typeLabel="Content Tests"
        typeDescription="A/B test headlines, descriptions, images, and storefront copy."
        typeEmptyTitle="No content tests yet"
        typeEmptyBody="Start by changing a headline, button, or image — no code needed."
      />
    </div>
  );
}
