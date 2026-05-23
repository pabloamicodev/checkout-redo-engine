import { PersonalizationsClient } from "@/components/personalizations/PersonalizationsClient";
import { OfferPersonalizationService } from "@/services/offer-personalization.service";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
const service = new OfferPersonalizationService();
const PAGE_SIZE = 50;

export default async function PersonalizationsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  const { items, total } = shop
    ? await service.list(shop.id, { page: 1, limit: PAGE_SIZE })
    : { items: [], total: 0 };
  type PersonalizationItem = (typeof items)[number];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
      <PersonalizationsClient
        initialItems={items.map((p: PersonalizationItem) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          offerIds: p.offerIds,
          startsAt: p.startsAt ? p.startsAt.toISOString() : null,
          endsAt: p.endsAt ? p.endsAt.toISOString() : null,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        initialTotal={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
