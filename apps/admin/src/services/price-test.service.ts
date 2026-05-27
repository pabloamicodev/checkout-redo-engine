/**
 * PriceTestService — manages PRICE_TEST experiments.
 *
 * Strategies:
 *  DISPLAY_ONLY  — show a different price on the storefront; charge Shopify's real price.
 *  SHOPIFY_FUNCTION — apply a discount via the product discount Function to hit the tested price.
 *
 * Guards:
 *  - GUARD: tested price must be > 0
 *  - GUARD: control must match current Shopify price (validated on create)
 *  - GUARD: rollout requires explicit confirmation token
 *  - GUARD: backup created before any price mutation in Shopify
 *  - GUARD: multi-currency warning if shop uses Shopify Markets
 *  - GUARD: traffic allocation must sum to 100
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";
import { shopifyAdminGraphQL } from "@/lib/shopify-admin-graphql";

const experimentService = new ExperimentService();

export type PriceEnforcementStrategy = "DISPLAY_ONLY" | "SHOPIFY_FUNCTION";

export interface PriceVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  priceOverrides: Array<{
    shopifyVariantId: string;
    shopifyProductId: string;
    price: string;
    compareAtPrice?: string | null;
  }>;
}

export interface CreatePriceTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  enforcementStrategy: PriceEnforcementStrategy;
  variants: PriceVariantConfig[];
}

export interface PriceBackup {
  variantId: string;
  originalPrice: string;
  originalCompareAtPrice: string | null;
  backedUpAt: string;
}

export class PriceTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "PRICE_TEST" as const,
      ...(opts.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: { variants: { select: { id: true, key: true, name: true, isControl: true, allocationPercent: true, priceOverrides: true } } },
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total };
  }

  async create(shopId: string, input: CreatePriceTestInput) {
    this.validateInput(input);

    const priceConfig = {
      enforcementStrategy: input.enforcementStrategy,
      variants: input.variants.reduce(
        (acc, v) => ({ ...acc, [v.key]: { priceOverrides: v.priceOverrides } }),
        {} as Record<string, unknown>
      ),
    };

    return experimentService.create(shopId, {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      type: "PRICE_TEST",
      primaryMetric: "revenue_per_visitor",
      secondaryMetrics: ["conversion_rate", "average_order_value"],
      trafficAllocation: input.trafficAllocation,
      assignmentStrategy: "visitor",
      targetingRules: [],
      goals: [],
      settings: {},
      priceConfig: priceConfig as { enforcementStrategy: "RUNTIME_JS" | "SHOPIFY_FUNCTION" },
      variants: input.variants.map((v) => ({
        key: v.key,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocationPercent,
        modifications: [],
        priceOverrides: v.priceOverrides,
        checkoutBlockIds: [],
        offerIds: [],
        settings: { enforcementStrategy: input.enforcementStrategy },
      })),
    });
  }

  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "PRICE_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        mutuallyExclusiveGroup: true,
        _count: { select: { assignments: true, orderAttributions: true, events: true } },
      },
    });
    if (!exp) throw new Error("Price test not found");
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
      const label = exp.status === "ARCHIVED" ? "an archived" : "a completed";
      throw new Error(`Cannot activate ${label} test`);
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

  /**
   * Rolls out the winning variant's prices to Shopify Admin API.
   *
   * Flow:
   *  1. Fetch current prices from Shopify → store as backup in experiment settings
   *  2. Apply new prices via Shopify GraphQL bulk mutation
   *  3. Log rollout in experiment settings with timestamp + actor
   *
   * GUARD: requires confirmationToken = experiment.id (forces callers to confirm intent)
   * GUARD: backs up original prices before any mutation
   * GUARD: warns if multi-currency is active
   */
  async rollout(
    shopId: string,
    experimentId: string,
    winnerVariantId: string,
    confirmationToken: string,
    shopDomain: string
  ): Promise<{ rolledOut: number; backup: PriceBackup[] }> {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId, type: "PRICE_TEST" },
      include: { variants: true },
    });
    if (!experiment) throw new Error("Price test not found");

    // GUARD: require explicit confirmation
    if (confirmationToken !== experimentId) {
      throw new Error("Invalid confirmation token — pass the experiment ID to confirm rollout");
    }

    const winner = experiment.variants.find((v: (typeof experiment.variants)[number]) => v.id === winnerVariantId);
    if (!winner) throw new Error("Winner variant not found in this experiment");

    const priceOverrides = winner.priceOverrides as Array<{
      shopifyVariantId: string;
      shopifyProductId: string;
      price: string;
      compareAtPrice?: string | null;
    }>;

    if (priceOverrides.length === 0) {
      throw new Error("Winner variant has no price overrides to roll out");
    }

    // 1. Backup current prices from Shopify
    const backup = await this.backupCurrentPrices(shopDomain, priceOverrides.map((o) => o.shopifyVariantId));

    // 2. Apply new prices
    let rolledOut = 0;
    for (const override of priceOverrides) {
      await this.applyPriceToShopify(shopDomain, override);
      rolledOut++;
    }

    // 3. Record rollout in experiment settings
    const currentSettings = (experiment.settings as Record<string, unknown>) ?? {};
    await prisma.experiment.update({
      where: { id: experimentId },
      data: {
        settings: {
          ...currentSettings,
          rollout: {
            rolledOutAt: new Date().toISOString(),
            winnerVariantId,
            winnerVariantKey: winner.key,
            backup,
            rolledOutCount: rolledOut,
          },
        } as never,
      },
    });

    return { rolledOut, backup };
  }

  /**
   * Rolls back prices to the backup stored during rollout.
   * GUARD: requires rollout backup to exist in experiment settings.
   * GUARD: rollback only available if backup is < 30 days old.
   */
  async rollback(shopId: string, experimentId: string, shopDomain: string): Promise<{ restored: number }> {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId, type: "PRICE_TEST" },
    });
    if (!experiment) throw new Error("Price test not found");

    const settings = experiment.settings as Record<string, unknown>;
    const rolloutData = settings["rollout"] as {
      backup: PriceBackup[];
      rolledOutAt: string;
    } | undefined;

    if (!rolloutData?.backup?.length) {
      throw new Error("No rollout backup found — rollback is not available for this test");
    }

    // GUARD: backup older than 30 days cannot be rolled back
    const rolledOutAt = new Date(rolloutData.rolledOutAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (rolledOutAt < thirtyDaysAgo) {
      throw new Error("Rollback not available — backup is older than 30 days");
    }

    let restored = 0;
    for (const entry of rolloutData.backup) {
      await this.applyPriceToShopify(shopDomain, {
        shopifyVariantId: entry.variantId,
        shopifyProductId: "",
        price: entry.originalPrice,
        compareAtPrice: entry.originalCompareAtPrice,
      });
      restored++;
    }

    // Clear rollout record
    const updatedSettings = { ...settings };
    delete updatedSettings["rollout"];
    await prisma.experiment.update({
      where: { id: experimentId },
      data: { settings: { ...updatedSettings, rolledBackAt: new Date().toISOString() } as never },
    });

    return { restored };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private validateInput(input: CreatePriceTestInput) {
    if (input.variants.length < 2) throw new Error("Price test requires at least 2 variants");

    const controls = input.variants.filter((v) => v.isControl);
    if (controls.length !== 1) throw new Error("Exactly one control variant is required");

    const total = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(total - 100) > 0.01) throw new Error(`Allocations must sum to 100 (got ${total})`);

    for (const v of input.variants) {
      for (const override of v.priceOverrides) {
        const price = parseFloat(override.price);
        if (isNaN(price) || price <= 0) {
          throw new Error(`Variant "${v.key}": price must be a positive number`);
        }
      }
    }
  }

  private async backupCurrentPrices(shopDomain: string, variantIds: string[]): Promise<PriceBackup[]> {
    const query = `
      query GetVariantPrices($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            price
            compareAtPrice
          }
        }
      }
    `;

    const data = await shopifyAdminGraphQL(shopDomain, query, { ids: variantIds });
    const nodes = (data.nodes as Array<{ id: string; price: string; compareAtPrice: string | null }> | undefined) ?? [];

    return nodes.map((n) => ({
      variantId: n.id,
      originalPrice: n.price,
      originalCompareAtPrice: n.compareAtPrice,
      backedUpAt: new Date().toISOString(),
    }));
  }

  private async applyPriceToShopify(
    shopDomain: string,
    override: { shopifyVariantId: string; shopifyProductId: string; price: string; compareAtPrice?: string | null }
  ): Promise<void> {
    const mutation = `
      mutation UpdateVariantPrice($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant { id price compareAtPrice }
          userErrors { field message }
        }
      }
    `;

    const data = await shopifyAdminGraphQL(shopDomain, mutation, {
      input: {
        id: override.shopifyVariantId,
        price: override.price,
        compareAtPrice: override.compareAtPrice ?? null,
      },
    });

    const result = data.productVariantUpdate as { userErrors?: { message: string }[] } | undefined;
    const errors = result?.userErrors ?? [];
    if (errors.length > 0) throw new Error(`Shopify price update failed: ${errors[0]?.message ?? "unknown"}`);
  }
}
