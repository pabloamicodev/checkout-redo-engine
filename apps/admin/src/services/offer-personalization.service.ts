/**
 * OfferPersonalizationService — manages Personalization records of type OFFER.
 *
 * An offer personalization always shows a specific set of offers to visitors
 * who match its targeting rules, without an A/B experiment split.
 *
 * Priority: lower number = higher priority (1 beats 2).
 * Scheduling: startsAt / endsAt UTC datetimes control active window.
 */

import { prisma } from "@/lib/prisma";

// Use inferred return type instead of importing the model directly from @prisma/client
type Personalization = Awaited<ReturnType<typeof prisma.personalization.findFirst>> & {};

export interface OfferPersonalizationInput {
  name: string;
  offerIds: string[];
  targetingRules?: unknown[];
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

const ACTIVATABLE = new Set(["DRAFT", "PAUSED", "SCHEDULED"]);
const PAUSEABLE = new Set(["ACTIVE", "SCHEDULED"]);

export class OfferPersonalizationService {
  async list(
    shopId: string,
    opts: { status?: string; page?: number; limit?: number } = {}
  ): Promise<{ items: Personalization[]; total: number }> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "OFFER" as const,
      ...(opts.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.personalization.findMany({
        where,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        skip: page * limit,
        take: limit,
      }),
      prisma.personalization.count({ where }),
    ]);

    return { items, total };
  }

  async get(shopId: string, id: string): Promise<Personalization> {
    const p = await prisma.personalization.findFirst({
      where: { id, shopId, type: "OFFER" },
    });
    if (!p) throw new Error(`Personalization not found: ${id}`);
    return p;
  }

  async create(shopId: string, input: OfferPersonalizationInput): Promise<Personalization> {
    // Validate all referenced offers belong to this shop
    await this.validateOfferIds(shopId, input.offerIds);

    const status = this.deriveInitialStatus(input.startsAt);

    return prisma.personalization.create({
      data: {
        shopId,
        name: input.name,
        type: "OFFER",
        status: status as never,
        offerIds: input.offerIds,
        targetingRules: (input.targetingRules ?? []) as never,
        modifications: [],
        priority: input.priority ?? 100,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });
  }

  async update(
    shopId: string,
    id: string,
    input: Partial<OfferPersonalizationInput>
  ): Promise<Personalization> {
    await this.get(shopId, id);

    if (input.offerIds) {
      await this.validateOfferIds(shopId, input.offerIds);
    }

    return prisma.personalization.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.offerIds !== undefined ? { offerIds: input.offerIds } : {}),
        ...(input.targetingRules !== undefined
          ? { targetingRules: input.targetingRules as never }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
          : {}),
        ...(input.endsAt !== undefined
          ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
          : {}),
      },
    });
  }

  async delete(shopId: string, id: string): Promise<void> {
    const existing = await this.get(shopId, id);
    if (existing.status === "ACTIVE") {
      throw new Error("Cannot delete an ACTIVE personalization — pause it first");
    }
    await prisma.personalization.delete({ where: { id } });
  }

  async activate(shopId: string, id: string): Promise<Personalization> {
    const existing = await this.get(shopId, id);
    if (!ACTIVATABLE.has(existing.status)) {
      throw new Error(`Cannot activate personalization in status: ${existing.status}`);
    }
    return prisma.personalization.update({
      where: { id },
      data: { status: "ACTIVE" as never },
    });
  }

  async pause(shopId: string, id: string): Promise<Personalization> {
    const existing = await this.get(shopId, id);
    if (!PAUSEABLE.has(existing.status)) {
      throw new Error(`Cannot pause personalization in status: ${existing.status}`);
    }
    return prisma.personalization.update({
      where: { id },
      data: { status: "PAUSED" as never },
    });
  }

  async archive(shopId: string, id: string): Promise<Personalization> {
    await this.get(shopId, id);
    return prisma.personalization.update({
      where: { id },
      data: { status: "ARCHIVED" as never },
    });
  }

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  async getOfferAnalytics(
    shopId: string,
    offerId: string
  ): Promise<{
    views: number;
    claims: number;
    uniqueViewers: number;
    conversionRate: number;
    attributedRevenue: number;
  }> {
    const [viewEvents, claimEvents, revenueAgg] = await Promise.all([
      prisma.event.findMany({
        where: {
          shopId,
          eventName: "offer_viewed",
          metadata: { path: ["offerId"], equals: offerId },
        },
        select: { visitorId: true },
      }),
      prisma.event.count({
        where: {
          shopId,
          eventName: "offer_claimed",
          metadata: { path: ["offerId"], equals: offerId },
        },
      }),
      // Revenue from personalizations that include this offer
      prisma.orderAttribution.aggregate({
        where: {
          shopId,
          personalization: {
            offerIds: { has: offerId },
          },
        },
        _sum: { netRevenue: true },
      }),
    ]);

    const views = viewEvents.length;
    const uniqueViewers = new Set(viewEvents.map((e: (typeof viewEvents)[number]) => e.visitorId)).size;
    const claims = claimEvents;
    const conversionRate = uniqueViewers > 0 ? claims / uniqueViewers : 0;
    const attributedRevenue = Number(revenueAgg._sum.netRevenue ?? 0);

    return { views, claims, uniqueViewers, conversionRate, attributedRevenue };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async validateOfferIds(shopId: string, offerIds: string[]): Promise<void> {
    if (offerIds.length === 0) return;
    const found = await prisma.offer.count({
      where: { id: { in: offerIds }, shopId },
    });
    if (found !== offerIds.length) {
      throw new Error("One or more offer IDs are invalid or don't belong to this shop");
    }
  }

  // If startsAt is in the future, start as SCHEDULED; otherwise DRAFT
  private deriveInitialStatus(startsAt?: string | null): string {
    if (startsAt && new Date(startsAt) > new Date()) {
      return "SCHEDULED";
    }
    return "DRAFT";
  }
}
