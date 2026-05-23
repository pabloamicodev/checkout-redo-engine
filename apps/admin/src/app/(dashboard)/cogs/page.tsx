import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { CogsService } from "@/services/cogs.service";
import { CogsClient } from "@/components/cogs/CogsClient";
import { CogsSettingsForm } from "@/components/cogs/CogsSettingsForm";
import { getSessionShop } from "@/lib/session-shop";

const cogsService = new CogsService();

async function getData(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, currencyCode: true, settings: true },
  });
  if (!shop) return null;

  const [{ items, total }, coverage] = await Promise.all([
    cogsService.list(shop.id, { page: 1, limit: 50 }),
    cogsService.getCoverage(shop.id),
  ]);

  const settings = (shop.settings ?? {}) as Record<string, unknown>;

  return {
    currencyCode: shop.currencyCode,
    estimatedShippingCost: (settings["estimatedShippingCost"] as number) ?? 0,
    transactionFeePercent: (settings["transactionFeePercent"] as number) ?? 2.9,
    items,
    total,
    coverage,
  };
}

export default async function CogsPage() {
    const shopDomain = await getSessionShop();
  const data = await getData(shopDomain);

  if (!data) {
    return (
      <div className="flex-1 overflow-auto bg-neutral-50">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Card className="text-center py-12">
            <p className="text-neutral-500">Shop not found</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">COGS & Profit</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Configure cost of goods sold for accurate profit analytics</p>
        </div>

        <div className="space-y-6">
        {/* Profit formula card */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Calculation Settings</CardTitle>
          </CardHeader>
          <CogsSettingsForm
            initialShippingCost={data.estimatedShippingCost}
            initialTransactionFee={data.transactionFeePercent}
          />
        </Card>

        {/* Interactive COGS manager */}
        <CogsClient
          initialItems={data.items}
          initialTotal={data.total}
          initialCoverage={data.coverage}
          currencyCode={data.currencyCode}
        />
        </div>
      </div>
    </div>
  );
}
