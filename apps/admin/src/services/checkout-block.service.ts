/**
 * CheckoutBlockService — CRUD + lifecycle for CheckoutBlock entities.
 *
 * Status flow:
 *   DRAFT  ──activate──▶  ACTIVE  ──pause──▶  PAUSED
 *   PAUSED ──activate──▶  ACTIVE
 *   any    ──archive──▶   ARCHIVED
 *
 * Guards:
 *   - ACTIVE blocks: content + targetingRules updates are blocked (only name + styles)
 *   - ACTIVE blocks: cannot be deleted
 *   - activate: only DRAFT or PAUSED → ACTIVE
 *   - pause:    only ACTIVE → PAUSED
 */

import { prisma } from "@/lib/prisma";
import { CreateCheckoutBlockSchema } from "@/lib/zod-schemas";
import type { z } from "zod";

type CreateCheckoutBlockInput = z.infer<typeof CreateCheckoutBlockSchema>;
type UpdateCheckoutBlockInput = Partial<CreateCheckoutBlockInput>;

const ACTIVATABLE_STATUSES = new Set(["DRAFT", "PAUSED"]);

export interface CheckoutBlockAnalytics {
  blockId: string;
  impressions: number;
  completions: number;
  conversionRate: number;
}

export class CheckoutBlockService {
  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  async list(
    shopId: string,
    opts: { status?: string; type?: string; page?: number; limit?: number } = {}
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.type ? { type: opts.type as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.checkoutBlock.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
      }),
      prisma.checkoutBlock.count({ where }),
    ]);

    return { items, total };
  }

  // ---------------------------------------------------------------------------
  // get
  // ---------------------------------------------------------------------------

  async get(shopId: string, id: string) {
    const block = await prisma.checkoutBlock.findFirst({ where: { id, shopId } });
    if (!block) throw new Error(`CheckoutBlock not found: ${id}`);
    return block;
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  async create(shopId: string, input: CreateCheckoutBlockInput) {
    return prisma.checkoutBlock.create({
      data: {
        shopId,
        name: input.name,
        type: input.type as never,
        status: "DRAFT",
        content: input.content as never,
        styles: input.styles as never,
        targetingRules: input.targetingRules as never,
        experimentId: input.experimentId ?? null,
        variantId: input.variantId ?? null,
        position: input.position,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  async update(shopId: string, id: string, input: UpdateCheckoutBlockInput) {
    const existing = await this.get(shopId, id);

    // GUARD: ACTIVE blocks can only update name + styles
    if (existing.status === "ACTIVE") {
      const safeData: Record<string, unknown> = {};
      if (input.name !== undefined) safeData["name"] = input.name;
      if (input.styles !== undefined) safeData["styles"] = input.styles as never;

      return prisma.checkoutBlock.update({ where: { id }, data: safeData });
    }

    return prisma.checkoutBlock.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type as never } : {}),
        ...(input.content !== undefined ? { content: input.content as never } : {}),
        ...(input.styles !== undefined ? { styles: input.styles as never } : {}),
        ...(input.targetingRules !== undefined
          ? { targetingRules: input.targetingRules as never }
          : {}),
        ...(input.experimentId !== undefined
          ? { experimentId: input.experimentId ?? null }
          : {}),
        ...(input.variantId !== undefined
          ? { variantId: input.variantId ?? null }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  async delete(shopId: string, id: string): Promise<void> {
    const existing = await this.get(shopId, id);
    // GUARD: ACTIVE blocks cannot be deleted
    if (existing.status === "ACTIVE") {
      throw new Error("Cannot delete an ACTIVE checkout block — pause or archive it first");
    }
    await prisma.checkoutBlock.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // activate
  // ---------------------------------------------------------------------------

  async activate(shopId: string, id: string) {
    const existing = await this.get(shopId, id);
    // GUARD: only DRAFT or PAUSED can be activated
    if (!ACTIVATABLE_STATUSES.has(existing.status)) {
      throw new Error(`Cannot activate a checkout block in status: ${existing.status}`);
    }
    return prisma.checkoutBlock.update({ where: { id }, data: { status: "ACTIVE" } });
  }

  // ---------------------------------------------------------------------------
  // pause
  // ---------------------------------------------------------------------------

  async pause(shopId: string, id: string) {
    const existing = await this.get(shopId, id);
    // GUARD: only ACTIVE can be paused
    if (existing.status !== "ACTIVE") {
      throw new Error(`Cannot pause a checkout block in status: ${existing.status}`);
    }
    return prisma.checkoutBlock.update({ where: { id }, data: { status: "PAUSED" } });
  }

  // ---------------------------------------------------------------------------
  // archive
  // ---------------------------------------------------------------------------

  async archive(shopId: string, id: string) {
    await this.get(shopId, id); // existence + ownership check
    return prisma.checkoutBlock.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  // ---------------------------------------------------------------------------
  // getAnalytics
  // ---------------------------------------------------------------------------

  async getAnalytics(shopId: string, blockId: string): Promise<CheckoutBlockAnalytics> {
    // Impressions: events with name "checkout_block_shown" whose metadata contains this blockId
    const impressions = await prisma.event.count({
      where: {
        shopId,
        eventName: "checkout_block_shown",
        metadata: { path: ["blockId"], equals: blockId },
      },
    });

    // Completions: "checkout_completed" events that reference the same blockId via metadata
    const completions = await prisma.event.count({
      where: {
        shopId,
        eventName: "checkout_completed",
        metadata: { path: ["blockId"], equals: blockId },
      },
    });

    const conversionRate =
      impressions > 0 ? Math.round((completions / impressions) * 10000) / 100 : 0;

    return { blockId, impressions, completions, conversionRate };
  }
}
