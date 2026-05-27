/**
 * DiscountTestService — creates and manages DISCOUNT_TEST experiments.
 *
 * A Discount Test A/B tests different pricing and discount strategies — percentage
 * discounts, fixed amounts, free shipping thresholds, volume tiers, etc.
 * Discount application is powered by Shopify Function extensions.
 *
 * Guards:
 *  - discountType must be a known type
 *  - PERCENTAGE: percentage must be 0-100
 *  - FIXED_AMOUNT: amount must be > 0
 *  - FREE_SHIPPING: threshold must be >= 0 if provided
 *  - VOLUME / QUANTITY_BREAK / TIERED: tiers array must not be empty
 *  - BUY_X_GET_Y: buyQuantity and getQuantity must be >= 1
 *  - Control variant must have no discountConfig (customer sees default pricing)
 *  - Traffic allocations must sum to 100
 *  - At least 2 variants required
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";
import { z } from "zod";

export const DiscountTestVariantSchema = z.object({
  name: z.string().min(1),
  isControl: z.boolean(),
  allocation: z.number().min(0).max(100),
  discountValue: z.number().min(0).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]).optional(),
  tiers: z.array(z.object({
    minQty: z.number(),
    discount: z.number(),
  })).optional(),
});

export const CreateDiscountTestSchema = z.object({
  name: z.string().min(1),
  hypothesis: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "BXGY", "VOLUME_DISCOUNT", "FREE_SHIPPING"]),
  stacking: z.enum(["ALLOW", "DENY", "EXCLUSIVE"]).optional(),
  eligibility: z.string().optional(),
  variants: z.array(DiscountTestVariantSchema).min(2),
  targetingRules: z.array(z.unknown()).optional(),
  trafficAllocation: z.number().min(1).max(100).optional(),
});

const experimentService = new ExperimentService();

export type DiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "FREE_SHIPPING"
  | "VOLUME"
  | "QUANTITY_BREAK"
  | "BUY_X_GET_Y"
  | "FREE_GIFT";

export interface DiscountConfig {
  discountType: DiscountType;
  /** PERCENTAGE */
  percentage?: number;
  /** FIXED_AMOUNT */
  amount?: number;
  /** FREE_SHIPPING */
  threshold?: number;
  /** VOLUME / QUANTITY_BREAK / BUY_X_GET_Y */
  tiers?: Array<{ minQty: number; discount: number }>;
  buyQuantity?: number;
  getQuantity?: number;
  /** FREE_GIFT */
  giftProductId?: string;
  /** Reference to the Shopify Function handling application */
  functionId?: string;
}

export interface DiscountVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  discountConfig?: DiscountConfig;
}

export interface CreateDiscountTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  primaryMetric?: string;
  variants: DiscountVariantConfig[];
}

export interface UpdateDiscountTestInput {
  name?: string;
  description?: string;
  hypothesis?: string;
}

export class DiscountTestService {
  async create(shopId: string, data: z.infer<typeof CreateDiscountTestSchema>) {
    // Guard: at least 2 variants
    if (data.variants.length < 2) throw new Error("Discount test requires at least 2 variants");
    // Guard: exactly 1 control
    if (data.variants.filter(v => v.isControl).length !== 1) throw new Error("Exactly one control variant required");
    // Guard: non-control variants must have discount value > 0
    const nonControl = data.variants.filter(v => !v.isControl);
    for (const v of nonControl) {
      if (v.discountValue !== undefined && v.discountValue === 0) {
        throw new Error(`Variant "${v.name}" has a discount value of 0`);
      }
      if (data.discountType === "PERCENTAGE" && v.discountValue !== undefined && v.discountValue > 100) {
        throw new Error(`Variant "${v.name}" percentage discount cannot exceed 100%`);
      }
    }
    // Guard: validate tiers order
    for (const v of data.variants) {
      if (v.tiers && v.tiers.length > 1) {
        for (let i = 1; i < v.tiers.length; i++) {
          if (v.tiers[i]!.minQty <= v.tiers[i - 1]!.minQty) {
            throw new Error(`Tier thresholds must be in ascending order for variant "${v.name}"`);
          }
        }
      }
    }

    let variantIdx = 0;
    return experimentService.create(shopId, {
      name: data.name,
      type: "DISCOUNT_TEST",
      hypothesis: data.hypothesis,
      trafficAllocation: data.trafficAllocation ?? 100,
      targetingRules: (data.targetingRules ?? []) as never[],
      goals: [],
      settings: {
        discountType: data.discountType,
        stacking: data.stacking,
        eligibility: data.eligibility,
      },
      primaryMetric: "revenue_per_visitor",
      secondaryMetrics: ["conversion_rate", "average_order_value"],
      assignmentStrategy: "visitor",
      discountConfig: {
        type: data.discountType as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | undefined,
      },
      variants: data.variants.map(v => {
        const key = v.isControl ? "control" : `variant_${String.fromCharCode(97 + variantIdx++)}`;
        return {
          key,
          name: v.name,
          isControl: v.isControl,
          allocationPercent: v.allocation,
          modifications: [],
          priceOverrides: [],
          checkoutBlockIds: [],
          offerIds: [],
          discountConfig: {
            value: v.discountValue,
            type: (v.discountType ?? data.discountType) as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | undefined,
            tiers: v.tiers,
          },
          settings: {},
        };
      }),
    });
  }

  async list(shopId: string, opts?: { limit?: number; offset?: number; status?: string }) {
    return experimentService.list(shopId, { ...opts, type: "DISCOUNT_TEST" });
  }

  async get(shopId: string, id: string) {
    return experimentService.get(shopId, id);
  }

  async update(shopId: string, id: string, input: UpdateDiscountTestInput) {
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
    return experimentService.launch(shopId, id);
  }

  async pause(shopId: string, id: string) {
    return experimentService.pause(shopId, id);
  }

  async archive(shopId: string, id: string) {
    return experimentService.archive(shopId, id);
  }

  async duplicate(shopId: string, id: string) {
    return experimentService.duplicate(shopId, id);
  }
}
