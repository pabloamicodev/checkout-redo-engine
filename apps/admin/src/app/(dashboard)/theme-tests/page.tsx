import { prisma } from "@/lib/prisma";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Theme Tests — MarginLab" };

export default async function ThemeTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });

  if (!shop) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-neutral-500">Shop not found.</p>
      </div>
    );
  }

  const [items, total] = await Promise.all([
    prisma.experiment.findMany({
      where: { shopId: shop.id, type: "THEME_TEST" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, status: true, updatedAt: true, launchedAt: true,
        variants: { select: { id: true } },
      },
    }),
    prisma.experiment.count({ where: { shopId: shop.id, type: "THEME_TEST" } }),
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
        apiPath="/api/theme-tests"
        newPath="/theme-tests/new"
        newLabel="New Theme Test"
        detailBasePath="/theme-tests"
        accentHex="#71717a"
        typeLabel="Theme Tests"
        typeDescription="A/B test complete Shopify themes — fonts, colors, spacing, and global design changes."
        typeEmptyTitle="No theme tests yet"
        typeEmptyBody="Test which theme design drives more conversions."
      />
    </div>
  );
}
