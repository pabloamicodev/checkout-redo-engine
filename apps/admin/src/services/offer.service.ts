/**
 * OfferService — CRUD for the Offer Library.
 *
 * Guards:
 *  - GUARD: status transitions — DRAFT/PAUSED → ACTIVE, ACTIVE → PAUSED, any → ARCHIVED
 *  - GUARD: can't delete an ACTIVE offer (must pause or archive first)
 *  - GUARD: percentage must be 0-100
 *  - GUARD: fixed amount must be > 0
 *  - GUARD: volume/BXY/tiered tiers must have at least one tier
 */

import { prisma } from "@/lib/prisma";
import { CreateOfferSchema } from "@/lib/zod-schemas";
import type { z } from "zod";

type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

export interface OfferListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  triggerRules: unknown;
  discountRules: unknown;
  displaySettings: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const ACTIVE_STATUSES = new Set(["DRAFT", "PAUSED"]);
const PAUSEABLE_STATUSES = new Set(["ACTIVE"]);

export class OfferService {
  async list(
    shopId: string,
    opts: { status?: string; type?: string; page?: number; limit?: number } = {}
  ): Promise<{ items: OfferListItem[]; total: number }> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.type ? { type: opts.type as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
      }),
      prisma.offer.count({ where }),
    ]);

    return { items, total };
  }

  async get(shopId: string, id: string) {
    const offer = await prisma.offer.findFirst({ where: { id, shopId } });
    if (!offer) throw new Error(`Offer not found: ${id}`);
    return offer;
  }

  async create(shopId: string, input: CreateOfferInput) {
    this.validateDiscountRules(input.type, input.discountRules);

    return prisma.offer.create({
      data: {
        shopId,
        name: input.name,
        type: input.type as never,
        status: "DRAFT",
        triggerRules: input.triggerRules as never,
        discountRules: input.discountRules as never,
        displaySettings: input.displaySettings as never,
        functionConfig: (input.functionConfig as never) ?? undefined,
      },
    });
  }

  async update(shopId: string, id: string, input: Partial<CreateOfferInput>) {
    const existing = await this.get(shopId, id);

    // GUARD: can't fully edit an ACTIVE offer — only name and displaySettings
    if (existing.status === "ACTIVE") {
      const safeFields = {
        ...(input.name ? { name: input.name } : {}),
        ...(input.displaySettings
          ? { displaySettings: input.displaySettings as never }
          : {}),
      };
      return prisma.offer.update({ where: { id }, data: safeFields });
    }

    if (input.type && input.discountRules) {
      this.validateDiscountRules(input.type, input.discountRules);
    }

    return prisma.offer.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type as never } : {}),
        ...(input.triggerRules !== undefined
          ? { triggerRules: input.triggerRules as never }
          : {}),
        ...(input.discountRules !== undefined
          ? { discountRules: input.discountRules as never }
          : {}),
        ...(input.displaySettings !== undefined
          ? { displaySettings: input.displaySettings as never }
          : {}),
        ...(input.functionConfig !== undefined
          ? { functionConfig: (input.functionConfig as never) ?? null }
          : {}),
      },
    });
  }

  // GUARD: only DRAFT/PAUSED offers can be deleted
  async delete(shopId: string, id: string): Promise<void> {
    const existing = await this.get(shopId, id);
    if (existing.status === "ACTIVE") {
      throw new Error("Cannot delete an ACTIVE offer — pause or archive it first");
    }
    await prisma.offer.delete({ where: { id } });
  }

  // GUARD: only DRAFT or PAUSED offers can be activated
  async activate(shopId: string, id: string) {
    const existing = await this.get(shopId, id);
    if (!ACTIVE_STATUSES.has(existing.status)) {
      throw new Error(`Cannot activate offer in status: ${existing.status}`);
    }
    return prisma.offer.update({ where: { id }, data: { status: "ACTIVE" } });
  }

  // GUARD: only ACTIVE offers can be paused
  async pause(shopId: string, id: string) {
    const existing = await this.get(shopId, id);
    if (!PAUSEABLE_STATUSES.has(existing.status)) {
      throw new Error(`Cannot pause offer in status: ${existing.status}`);
    }
    return prisma.offer.update({ where: { id }, data: { status: "PAUSED" } });
  }

  async archive(shopId: string, id: string) {
    await this.get(shopId, id); // existence check
    return prisma.offer.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  // ---------------------------------------------------------------------------
  // Private guards
  // ---------------------------------------------------------------------------

  private validateDiscountRules(type: string, rules: Record<string, unknown>) {
    switch (type) {
      case "PERCENTAGE_DISCOUNT":
      case "PRODUCT_DISCOUNT": {
        const pct = rules["percentage"] as number | undefined;
        if (pct === undefined || pct < 0 || pct > 100) {
          throw new Error("percentage must be between 0 and 100");
        }
        break;
      }
      case "FIXED_AMOUNT_DISCOUNT":
      case "ORDER_DISCOUNT": {
        const amt = rules["amount"] as number | undefined;
        if (!amt || amt <= 0) {
          throw new Error("amount must be a positive number");
        }
        break;
      }
      case "FREE_SHIPPING": {
        // threshold is optional (free for all if omitted)
        const threshold = rules["threshold"] as number | undefined;
        if (threshold !== undefined && threshold < 0) {
          throw new Error("threshold must be a non-negative number");
        }
        break;
      }
      case "VOLUME_DISCOUNT":
      case "QUANTITY_BREAK":
      case "TIERED_PROGRESS_BAR": {
        const tiers = rules["tiers"] as unknown[] | undefined;
        if (!tiers || tiers.length === 0) {
          throw new Error(`${type} requires at least one tier`);
        }
        break;
      }
      case "BUY_X_GET_Y": {
        const buyX = rules["buyQuantity"] as number | undefined;
        const getY = rules["getQuantity"] as number | undefined;
        if (!buyX || buyX < 1) throw new Error("buyQuantity must be at least 1");
        if (!getY || getY < 1) throw new Error("getQuantity must be at least 1");
        break;
      }
      case "FREE_GIFT": {
        const threshold = rules["threshold"] as number | undefined;
        if (!threshold || threshold <= 0) {
          throw new Error("FREE_GIFT requires a positive threshold");
        }
        break;
      }
      // CAMPAIGN_LINK_OFFER has no strict numeric validation
    }
  }
}
