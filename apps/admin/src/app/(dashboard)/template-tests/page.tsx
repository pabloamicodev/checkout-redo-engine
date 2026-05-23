import { TemplateTestService } from "@/services/template-test.service";
import { ExperimentTypeList } from "@/components/experiments/ExperimentTypeList";
import { getSessionShop } from "@/lib/session-shop";
import { prisma } from "@/lib/prisma";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Template Tests — MarginLab" };

const service = new TemplateTestService();

export default async function TemplateTestsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });

  const { items, total } = shop
    ? await service.list(shop.id, { limit: 50 })
    : { items: [], total: 0 };

  const rows = items.map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    variantCount: e.variants?.length ?? 0,
    updatedAt: e.updatedAt.toISOString(),
    launchedAt: e.launchedAt ? e.launchedAt.toISOString() : null,
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
      <ExperimentTypeList
        initialItems={rows}
        initialTotal={total}
        apiPath="/api/template-tests"
        newPath="/template-tests/new"
        newLabel="New Template Test"
        detailBasePath="/template-tests"
        accentHex="#64748b"
        typeLabel="Template Tests"
        typeDescription="A/B test different page templates to find the layout that converts best."
        typeEmptyTitle="No template tests yet"
        typeEmptyBody="Test different page templates to find the layout that converts best."
      />
    </div>
  );
}
