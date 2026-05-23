import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";
import { AbandonedCartClient, type AcrItem } from "@/components/personalizations/AbandonedCartClient";
import { Prisma } from "@prisma/client";


export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

export default async function AbandonedCartPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  let items: AcrItem[] = [];

  if (shop) {
    try {
      // Use raw SQL to avoid Prisma client enum validation — safe until
      // `prisma generate` is re-run after adding ABANDONED_CART to the schema.
      type AbandonedCartRow = {
        id: string;
        name: string;
        status: string;
        priority: number;
        modifications: unknown;
        targetingRules: unknown;
        offerIds: string[];
        startsAt: Date | null;
        endsAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      };
      const rows = (await prisma.$queryRaw(
        Prisma.sql`
          SELECT id, name, status, priority, modifications, "targetingRules", "offerIds",
                 "startsAt", "endsAt", "createdAt", "updatedAt"
          FROM "Personalization"
          WHERE "shopId" = ${shop.id}
            AND type = 'ABANDONED_CART'
            AND status != 'ARCHIVED'
          ORDER BY priority ASC, "updatedAt" DESC
          LIMIT ${PAGE_SIZE}
        `
      )) as AbandonedCartRow[];

      items = rows.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        modifications: (p.modifications as Record<string, unknown>[]) ?? [],
        targetingRules: (p.targetingRules as Record<string, unknown>[]) ?? [],
        offerIds: p.offerIds ?? [],
        startsAt: p.startsAt ? new Date(p.startsAt).toISOString() : null,
        endsAt: p.endsAt ? new Date(p.endsAt).toISOString() : null,
        createdAt: new Date(p.createdAt).toISOString(),
        updatedAt: new Date(p.updatedAt).toISOString(),
      }));
    } catch {
      // ABANDONED_CART enum not yet in DB — show empty state until migration runs
      items = [];
    }
  }

  return <AbandonedCartClient initialItems={items} />;
}
