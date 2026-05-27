/**
 * OfferTestService — creates and manages OFFER_TEST experiments.
 *
 * An Offer Test A/B tests different on-site offer presentations (banners,
 * popups, cart drawer promos, product page offers) against a no-offer control.
 *
 * Guards:
 *  - Control variant must have no modifications (empty array)
 *  - Non-control variants must have exactly one modification entry
 *  - Modification must include a valid offerType
 *  - triggerDelay must be >= 0
 *  - Traffic allocations must sum to 100
 *  - At least 2 variants required (1 control + 1 variant)
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";

const experimentService = new ExperimentService();

export type OfferPlacement = "BANNER" | "POPUP" | "CART_DRAWER" | "PRODUCT_PAGE";

export interface OfferModification {
  offerType: OfferPlacement;
  headline: string;
  body?: string;
  ctaText?: string;
  triggerDelay?: number;
}

export interface OfferVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  modification?: OfferModification;
}

export interface CreateOfferTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  primaryMetric?: string;
  variants: OfferVariantConfig[];
}

export interface UpdateOfferTestInput {
  name?: string;
  description?: string;
  hypothesis?: string;
}

const VALID_PLACEMENTS = new Set<string>(["BANNER", "POPUP", "CART_DRAWER", "PRODUCT_PAGE"]);

export class OfferTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "OFFER_TEST" as const,
      ...(opts.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: {
          variants: {
            select: {
              id: true,
              key: true,
              name: true,
              isControl: true,
              allocationPercent: true,
              modifications: true,
            },
            orderBy: { isControl: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total };
  }

  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "OFFER_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Offer test not found");
    return exp;
  }

  async create(shopId: string, input: CreateOfferTestInput) {
    this.validate(input);

    return experimentService.create(shopId, {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      type: "OFFER_TEST",
      primaryMetric: input.primaryMetric ?? "conversion_rate",
      secondaryMetrics: ["revenue_per_visitor", "average_order_value"],
      trafficAllocation: input.trafficAllocation,
      assignmentStrategy: "visitor",
      targetingRules: [],
      goals: [],
      settings: {},
      variants: input.variants.map((v) => ({
        key: v.key,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocationPercent,
        modifications: (v.isControl || !v.modification ? [] : [v.modification]) as never[],
        priceOverrides: [],
        checkoutBlockIds: [],
        offerIds: [],
        settings: {},
        redirectUrl: null,
      })),
    });
  }

  async update(shopId: string, id: string, input: UpdateOfferTestInput) {
    await this.get(shopId, id);
    return prisma.experiment.update({
      where: { id },
      data: {
        ...(input.name        ? { name: input.name.trim() }               : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.hypothesis  !== undefined ? { hypothesis: input.hypothesis }  : {}),
      },
    });
  }

  async activate(shopId: string, id: string) {
    const exp = await this.get(shopId, id);
    if (exp.status === "RUNNING") return exp;
    if (exp.status === "COMPLETED" || exp.status === "ARCHIVED") {
      throw new Error(`Cannot activate a ${exp.status.toLowerCase()} test`);
    }
    return experimentService.launch(shopId, id);
  }

  async pause(shopId: string, id: string) {
    const exp = await this.get(shopId, id);
    if (exp.status === "PAUSED") return exp;
    if (exp.status !== "RUNNING") {
      throw new Error(`Cannot pause a test with status "${exp.status}"`);
    }
    return experimentService.pause(shopId, id);
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  private validate(input: CreateOfferTestInput) {
    if (!input.name?.trim()) throw new Error("Name is required");

    if (input.variants.length < 2) {
      throw new Error("Offer test requires at least 2 variants (1 control + 1 variant)");
    }

    const controls = input.variants.filter((v) => v.isControl);
    if (controls.length !== 1) throw new Error("Exactly one control variant is required");

    const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(totalAlloc - 100) > 0.01) {
      throw new Error(`Variant allocations must sum to 100 (got ${totalAlloc.toFixed(1)})`);
    }

    for (const v of input.variants) {
      if (v.isControl) {
        if (v.modification) {
          throw new Error("Control variant must not have a modification — it shows no offer");
        }
        continue;
      }

      if (!v.modification) {
        throw new Error(`Variant "${v.name}": modification is required for non-control variants`);
      }

      if (!VALID_PLACEMENTS.has(v.modification.offerType)) {
        throw new Error(
          `Variant "${v.name}": invalid offerType "${v.modification.offerType}". Must be one of: ${[...VALID_PLACEMENTS].join(", ")}`
        );
      }

      if ((v.modification.triggerDelay ?? 0) < 0) {
        throw new Error(`Variant "${v.name}": triggerDelay must be >= 0`);
      }
    }

    if (input.trafficAllocation < 1 || input.trafficAllocation > 100) {
      throw new Error("Traffic allocation must be between 1 and 100");
    }
  }
}
