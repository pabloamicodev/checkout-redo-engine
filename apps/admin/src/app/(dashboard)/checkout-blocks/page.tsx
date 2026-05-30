import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CheckoutBlockService } from "@/services/checkout-block.service";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";
import { getSessionShop } from "@/lib/session-shop";
import { CheckoutBlocksTable } from "@/components/checkout-blocks/CheckoutBlocksTable";

export const dynamic = 'force-dynamic';
const service = new CheckoutBlockService();

export default async function CheckoutBlocksPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  const { items } = shop
    ? await service.list(shop.id, { limit: 100 })
    : { items: [] };

  const rows = items.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    status: b.status,
    position: b.position,
    updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : String(b.updatedAt),
    experimentId: b.experimentId ?? null,
  }));

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className=" mx-auto px-8 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Checkout Blocks</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Content blocks rendered inside the Shopify checkout extension</p>
          </div>
          <Link href="/checkout-blocks/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Block
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-neutral-800 mb-1">No checkout blocks yet</p>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-4 leading-relaxed">Add custom blocks — product upsells, progress bars, or custom content.</p>
              <Link href="/checkout-blocks/new">
                <Button size="sm">Create Checkout Block</Button>
              </Link>
            </div>
          ) : (
            <CheckoutBlocksTable initialItems={rows} />
          )}
        </div>
      </div>
    </div>
  );
}
