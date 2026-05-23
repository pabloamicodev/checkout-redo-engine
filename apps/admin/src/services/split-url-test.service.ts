/**
 * SplitUrlTestService — creates and manages SPLIT_URL_TEST experiments.
 *
 * A Split URL test routes a percentage of visitors to an alternate URL
 * instead of applying DOM modifications to the same page.
 *
 * The storefront runtime already implements the redirect logic with:
 *  - Loop-protection via _ml_redirected query param
 *  - Query param preservation
 *  - Assignment-gated redirect (same visitor always goes to same URL)
 *
 * Guards:
 *  - Each variant must have a valid URL (starts with / or https://)
 *  - No two variants may share the same redirect URL
 *  - Control variant must NOT have a redirectUrl (it stays on original page)
 *  - Traffic allocations must sum to 100
 *  - At least 2 variants required (1 control + 1 variant)
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";

const experimentService = new ExperimentService();

// ── Input types ───────────────────────────────────────────────────────────────

export interface SplitUrlVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  /** Redirect URL for this variant. Must be null/empty for the control. */
  redirectUrl: string | null;
}

export interface CreateSplitUrlTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  /** The original URL being tested (used for display purposes) */
  baseUrl: string;
  variants: SplitUrlVariantConfig[];
}

export interface UpdateSplitUrlTestInput {
  name?: string;
  description?: string;
  hypothesis?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SplitUrlTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "SPLIT_URL_TEST" as const,
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
              redirectUrl: true,
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
      where: { id, shopId, type: "SPLIT_URL_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Split URL test not found");
    return exp;
  }

  async create(shopId: string, input: CreateSplitUrlTestInput) {
    this.validate(input);

    const splitUrlConfig = {
      baseUrl: input.baseUrl.trim(),
      variants: input.variants.reduce(
        (acc, v) => ({ ...acc, [v.key]: { redirectUrl: v.redirectUrl } }),
        {} as Record<string, unknown>
      ),
    };

    return experimentService.create(shopId, {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      type: "SPLIT_URL_TEST",
      primaryMetric: "conversion_rate",
      secondaryMetrics: ["revenue_per_visitor", "average_order_value"],
      trafficAllocation: input.trafficAllocation,
      assignmentStrategy: "visitor",
      targetingRules: [],
      goals: [],
      settings: {},
      splitUrlConfig,
      variants: input.variants.map((v) => ({
        key: v.key,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocationPercent,
        redirectUrl: v.redirectUrl,
        modifications: [],
        priceOverrides: [],
        checkoutBlockIds: [],
        offerIds: [],
        settings: {},
      })),
    });
  }

  async update(shopId: string, id: string, input: UpdateSplitUrlTestInput) {
    await this.get(shopId, id); // ownership check
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
    if (exp.status === "RUNNING") return exp; // idempotent
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

  async complete(shopId: string, id: string) {
    await this.get(shopId, id); // ownership check
    return experimentService.complete(shopId, id);
  }

  async duplicate(shopId: string, id: string) {
    await this.get(shopId, id); // ownership check
    return experimentService.duplicate(shopId, id);
  }

  async getAnalytics(shopId: string, id: string) {
    const exp = await this.get(shopId, id);

    const assignments = await prisma.experimentAssignment.groupBy({
      by: ["variantId"],
      where: { experimentId: id, shopId },
      _count: { visitorId: true },
    });

    const attributions = await prisma.orderAttribution.findMany({
      where: { shopId, experimentId: id },
      select: { variantId: true, netRevenue: true },
    });

    return exp.variants.map((v) => {
      const asgn = assignments.find((a) => a.variantId === v.id);
      const orders = attributions.filter((a) => a.variantId === v.id);
      const visitors = asgn?._count.visitorId ?? 0;
      const revenue = orders.reduce((s, a) => s + Number(a.netRevenue ?? 0), 0);
      return {
        variantId: v.id,
        variantKey: v.key,
        variantName: v.name,
        isControl: v.isControl,
        redirectUrl: v.redirectUrl,
        visitors,
        orders: orders.length,
        revenue,
        conversionRate: visitors > 0 ? orders.length / visitors : 0,
      };
    });
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  private validate(input: CreateSplitUrlTestInput) {
    if (!input.name?.trim()) throw new Error("Name is required");
    if (!input.baseUrl?.trim()) throw new Error("Base URL is required");

    if (input.variants.length < 2) {
      throw new Error("Split URL test requires at least 2 variants (control + 1 variant)");
    }

    const controls = input.variants.filter((v) => v.isControl);
    if (controls.length !== 1) {
      throw new Error("Exactly one control variant is required");
    }

    const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(totalAlloc - 100) > 0.01) {
      throw new Error(`Variant allocations must sum to 100 (got ${totalAlloc.toFixed(1)})`);
    }

    const redirectUrls: string[] = [];
    for (const v of input.variants) {
      if (v.isControl) {
        if (v.redirectUrl) {
          throw new Error("Control variant must not have a redirect URL — it stays on the original page");
        }
        continue;
      }

      if (!v.redirectUrl?.trim()) {
        throw new Error(`Variant "${v.name}": redirect URL is required`);
      }

      const url = v.redirectUrl.trim();
      if (!url.startsWith("/") && !url.startsWith("https://") && !url.startsWith("http://")) {
        throw new Error(`Variant "${v.name}": URL must start with /, http://, or https://`);
      }

      if (redirectUrls.includes(url)) {
        throw new Error(`Duplicate redirect URL "${url}" — each variant must have a unique URL`);
      }
      redirectUrls.push(url);
    }

    if (input.trafficAllocation < 1 || input.trafficAllocation > 100) {
      throw new Error("Traffic allocation must be between 1 and 100");
    }
  }
}
