import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";
import { PostPurchaseClient } from "@/components/personalizations/PostPurchaseClient";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Post-Purchase Personalizations — MarginLab" };

const PAGE_SIZE = 50;

export default async function PostPurchasePersonalizationsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  type Row = {
    id: string;
    name: string;
    status: string;
    priority: number;
    offerIds: string[];
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  let items: Row[] = [];

  if (shop) {
    try {
      items = (await prisma.$queryRaw`
          SELECT id, name, status, priority, "offerIds",
                 "startsAt", "endsAt", "createdAt", "updatedAt"
          FROM "Personalization"
          WHERE "shopId" = ${shop.id}
            AND type = 'POST_PURCHASE'
            AND status != 'ARCHIVED'
          ORDER BY priority ASC, "updatedAt" DESC
          LIMIT ${PAGE_SIZE}
        `) as Row[];
    } catch {
      // POST_PURCHASE enum not yet in DB — show empty state until migration runs
      items = [];
    }
  }

  return (
    <PostPurchaseClient
      initialItems={items.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        offerIds: p.offerIds ?? [],
        startsAt: p.startsAt ? new Date(p.startsAt).toISOString() : null,
        endsAt: p.endsAt ? new Date(p.endsAt).toISOString() : null,
        updatedAt: new Date(p.updatedAt).toISOString(),
      }))}
    />
  );
}
