/**
 * ShippingTestService — creates and manages SHIPPING_TEST experiments.
 *
 * Shipping tests vary:
 *  - Free shipping threshold (e.g., control: $75, variant: $50)
 *  - Shipping method hide / rename (via Delivery Customization Function)
 *  - Combination: threshold + method rename in one test
 *
 * Guards:
 *  - GUARD: threshold must be >= 0
 *  - GUARD: at least 2 variants required (inherited from ExperimentService)
 *  - GUARD: traffic allocation across variants must sum to 100
 *  - GUARD: Delivery Customization Function plan warning (not all Shopify plans)
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";

const experimentService = new ExperimentService();

export interface ShippingVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  freeShippingThreshold: number | null; // null = always free
  progressBarMessage: string;
  methodOperations?: Array<
    | { type: "hide"; titleContains: string }
    | { type: "rename"; titleFrom: string; titleTo: string }
  >;
}

export interface CreateShippingTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  variants: ShippingVariantConfig[];
  progressBarEnabled: boolean;
  progressBarMessageTemplate: string;
  useDeliveryCustomization: boolean;
}

export class ShippingTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "SHIPPING_TEST" as const,
      ...(opts.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: { variants: { select: { id: true, key: true, name: true, isControl: true, allocationPercent: true } } },
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total };
  }

  async create(shopId: string, input: CreateShippingTestInput) {
    this.validate(input);

    const shippingConfig = {
      progressBarEnabled: input.progressBarEnabled,
      progressBarMessageTemplate: input.progressBarMessageTemplate,
      useDeliveryCustomization: input.useDeliveryCustomization,
      variants: input.variants.reduce(
        (acc, v) => ({
          ...acc,
          [v.key]: {
            freeShippingThreshold: v.freeShippingThreshold,
            progressBarMessage: v.progressBarMessage,
            methodOperations: v.methodOperations ?? [],
          },
        }),
        {} as Record<string, unknown>
      ),
    };

    return experimentService.create(shopId, {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      type: "SHIPPING_TEST",
      primaryMetric: "conversion_rate",
      secondaryMetrics: ["revenue_per_visitor", "average_order_value"],
      trafficAllocation: input.trafficAllocation,
      assignmentStrategy: "visitor",
      targetingRules: [],
      goals: [],
      settings: {},
      shippingConfig,
      variants: input.variants.map((v) => ({
        key: v.key,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocationPercent,
        modifications: [],
        priceOverrides: [],
        checkoutBlockIds: [],
        offerIds: [],
        settings: {
          freeShippingThreshold: v.freeShippingThreshold,
          methodOperations: v.methodOperations ?? [],
        },
      })),
    });
  }

  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "SHIPPING_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Shipping test not found");
    return exp;
  }

  async update(shopId: string, id: string, input: { name?: string; description?: string; hypothesis?: string }) {
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

  // ---------------------------------------------------------------------------
  // Analytics: shipping-specific metrics per variant
  // ---------------------------------------------------------------------------

  async getAnalytics(shopId: string, experimentId: string) {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId, type: "SHIPPING_TEST" },
      include: { variants: true },
    });
    if (!experiment) throw new Error("Shipping test not found");

    const attributions = await prisma.orderAttribution.findMany({
      where: { shopId, experimentId },
      select: {
        variantId: true,
        netRevenue: true,
        estimatedShippingCost: true,
        grossProfit: true,
      },
    });

    const variantStats = experiment.variants.map((v: (typeof experiment.variants)[number]) => {
      const orders = attributions.filter((a: (typeof attributions)[number]) => a.variantId === v.id);
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((s: number, a: (typeof attributions)[number]) => s + Number(a.netRevenue ?? 0), 0);
      const totalShippingCost = orders.reduce((s: number, a: (typeof attributions)[number]) => s + Number(a.estimatedShippingCost ?? 0), 0);
      const avgShippingCost = totalOrders > 0 ? totalShippingCost / totalOrders : 0;
      const freeShippingRate =
        totalOrders > 0
          ? orders.filter((a: (typeof attributions)[number]) => Number(a.estimatedShippingCost ?? 0) === 0).length / totalOrders
          : 0;

      return {
        variantId: v.id,
        variantKey: v.key,
        variantName: v.name,
        isControl: v.isControl,
        totalOrders,
        totalRevenue,
        avgShippingCost,
        freeShippingRate,
      };
    });

    return { experiment, variantStats };
  }

  // ---------------------------------------------------------------------------
  // Private validation
  // ---------------------------------------------------------------------------

  private validate(input: CreateShippingTestInput) {
    if (input.variants.length < 2) {
      throw new Error("Shipping test requires at least 2 variants");
    }

    const controlVariants = input.variants.filter((v) => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error("Exactly one control variant is required");
    }

    const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(totalAlloc - 100) > 0.01) {
      throw new Error(`Variant allocations must sum to 100 (got ${totalAlloc})`);
    }

    for (const v of input.variants) {
      if (v.freeShippingThreshold !== null && v.freeShippingThreshold < 0) {
        throw new Error(`Variant "${v.key}": free shipping threshold must be >= 0`);
      }
    }
  }
}
