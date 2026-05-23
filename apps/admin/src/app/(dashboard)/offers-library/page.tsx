import { OffersClient } from "@/components/offers/OffersClient";
import { OfferService } from "@/services/offer.service";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
const offerService = new OfferService();
const PAGE_SIZE = 50;

export default async function OffersLibraryPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  const { items, total } = shop
    ? await offerService.list(shop.id, { page: 1, limit: PAGE_SIZE })
    : { items: [], total: 0 };
  type OfferItem = (typeof items)[number];

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Offers Library</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Reusable discount and promotion rules for experiments and personalizations</p>
        </div>
        <OffersClient
          initialItems={items.map((o: OfferItem) => ({
            ...o,
            createdAt: o.createdAt.toISOString(),
            updatedAt: o.updatedAt.toISOString(),
          }))}
          initialTotal={total}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}
