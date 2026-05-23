/**
 * CheckoutTestService — creates and manages CHECKOUT_TEST experiments.
 *
 * A Checkout Test A/B tests different checkout UI blocks (trust badges, upsells,
 * custom fields, etc.) rendered via Shopify checkout UI extensions.
 *
 * Guards:
 *  - Each non-control variant must reference at least one checkoutBlockId
 *  - All referenced checkoutBlockIds must belong to the shop
 *  - A checkout block that is already linked to a RUNNING experiment cannot be
 *    used in a new experiment (prevents the same block from being in two active tests)
 *  - Control variant must have no checkoutBlockIds
 *  - Traffic allocations must sum to 100
 *  - At least 2 variants required
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";

const experimentService = new ExperimentService();

export interface CheckoutVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  checkoutBlockIds: string[];
}

export interface CreateCheckoutTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  primaryMetric?: string;
  variants: CheckoutVariantConfig[];
}

export interface UpdateCheckoutTestInput {
  name?: string;
  description?: string;
  hypothesis?: string;
}

export class CheckoutTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "CHECKOUT_TEST" as const,
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
              checkoutBlockIds: true,
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
      where: { id, shopId, type: "CHECKOUT_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Checkout test not found");
    return exp;
  }

  async create(shopId: string, input: CreateCheckoutTestInput) {
    await this.validate(shopId, input);

    return experimentService.create(shopId, {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      type: "CHECKOUT_TEST",
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
        modifications: [],
        priceOverrides: [],
        checkoutBlockIds: v.checkoutBlockIds,
        offerIds: [],
        settings: {},
        redirectUrl: null,
      })),
    });
  }

  async update(shopId: string, id: string, input: UpdateCheckoutTestInput) {
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

    // Re-check block conflicts at activation time (another test may have started since creation)
    const allBlockIds = exp.variants.flatMap((v) => v.checkoutBlockIds);
    if (allBlockIds.length > 0) {
      await this.assertBlocksNotInUse(shopId, allBlockIds, id);
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

  private async validate(shopId: string, input: CreateCheckoutTestInput) {
    if (!input.name?.trim()) throw new Error("Name is required");

    if (input.variants.length < 2) {
      throw new Error("Checkout test requires at least 2 variants");
    }

    const controls = input.variants.filter((v) => v.isControl);
    if (controls.length !== 1) throw new Error("Exactly one control variant is required");

    const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(totalAlloc - 100) > 0.01) {
      throw new Error(`Variant allocations must sum to 100 (got ${totalAlloc.toFixed(1)})`);
    }

    const controlVariant = controls[0]!;
    if (controlVariant.checkoutBlockIds.length > 0) {
      throw new Error("Control variant must not reference checkout blocks — it shows the default checkout");
    }

    for (const v of input.variants.filter((v) => !v.isControl)) {
      if (v.checkoutBlockIds.length === 0) {
        throw new Error(`Variant "${v.name}": must reference at least one checkout block`);
      }
    }

    // Verify all referenced blocks exist and belong to the shop
    const allBlockIds = input.variants.flatMap((v) => v.checkoutBlockIds);
    if (allBlockIds.length > 0) {
      const found = await prisma.checkoutBlock.findMany({
        where: { id: { in: allBlockIds }, shopId },
        select: { id: true },
      });
      const foundIds = new Set(found.map((b) => b.id));
      const missing = allBlockIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new Error(`Checkout block(s) not found: ${missing.join(", ")}`);
      }

      await this.assertBlocksNotInUse(shopId, allBlockIds, null);
    }

    if (input.trafficAllocation < 1 || input.trafficAllocation > 100) {
      throw new Error("Traffic allocation must be between 1 and 100");
    }
  }

  private async assertBlocksNotInUse(shopId: string, blockIds: string[], excludeExperimentId: string | null) {
    // Find any RUNNING checkout test that uses any of these blocks
    const conflicts = await prisma.experimentVariant.findMany({
      where: {
        experiment: {
          shopId,
          type: "CHECKOUT_TEST",
          status: "RUNNING",
          ...(excludeExperimentId ? { NOT: { id: excludeExperimentId } } : {}),
        },
        checkoutBlockIds: { hasSome: blockIds },
      },
      select: {
        experiment: { select: { name: true } },
        checkoutBlockIds: true,
      },
    });

    if (conflicts.length > 0) {
      const conflictingIds = conflicts.flatMap((c) => c.checkoutBlockIds).filter((id) => blockIds.includes(id));
      const experimentName = conflicts[0]!.experiment.name;
      throw new Error(
        `Checkout block(s) ${[...new Set(conflictingIds)].join(", ")} are already used in the running test "${experimentName}"`
      );
    }
  }
}
