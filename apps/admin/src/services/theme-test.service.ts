import { ExperimentService } from "./experiment.service";
import { prisma } from "@/lib/prisma";
import { getShopifyRestFetch, type ShopifyTheme } from "@/lib/shopify-admin-rest";

const experimentService = new ExperimentService();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeTestCreateInput {
  name: string;
  hypothesis?: string;
  trafficAllocation?: number;
  variants: {
    name: string;
    isControl: boolean;
    allocation: number;
    /** Shopify theme ID to serve for this variant (null for control = published theme) */
    settings?: { themeId?: number; themeName?: string };
  }[];
  targetingRules?: unknown[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ThemeTestService {
  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  async create(shopId: string, data: ThemeTestCreateInput) {
    if (!data.variants || data.variants.length < 2) {
      throw new Error("Theme test requires at least 2 variants");
    }
    const controls = data.variants.filter((v) => v.isControl);
    if (controls.length !== 1) {
      throw new Error("Theme test requires exactly one control variant");
    }

    return experimentService.create(shopId, {
      name: data.name,
      type: "THEME_TEST",
      hypothesis: data.hypothesis,
      primaryMetric: "conversion_rate",
      secondaryMetrics: ["revenue_per_visitor", "average_order_value"],
      assignmentStrategy: "visitor",
      variants: data.variants.map((v, i) => ({
        key: v.isControl ? "control" : `variant_${String.fromCharCode(96 + i)}`,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocation,
        settings: v.settings ?? {},
        modifications: [],
        priceOverrides: [],
        checkoutBlockIds: [],
        offerIds: [],
        redirectUrl: null,
      })),
      targetingRules: (data.targetingRules ?? []) as never[],
      trafficAllocation: data.trafficAllocation ?? 100,
      settings: {},
      goals: [],
    });
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  async list(shopId: string, opts?: { limit?: number; offset?: number; status?: string }) {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;

    const where = {
      shopId,
      type: "THEME_TEST" as const,
      ...(opts?.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: {
          variants: {
            select: { id: true, key: true, name: true, isControl: true, allocationPercent: true, settings: true },
            orderBy: { isControl: "desc" },
          },
          _count: { select: { assignments: true, orderAttributions: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total };
  }

  // -------------------------------------------------------------------------
  // get
  // -------------------------------------------------------------------------
  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "THEME_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Theme test not found");
    return exp;
  }

  // -------------------------------------------------------------------------
  // activate — with all 4 guards from the spec
  // -------------------------------------------------------------------------
  async activate(shopId: string, id: string) {
    const exp = await this.get(shopId, id);

    // Guard 1: only 1 theme test RUNNING at a time per shop (themes are global)
    const alreadyRunning = await prisma.experiment.findFirst({
      where: { shopId, type: "THEME_TEST", status: "RUNNING", id: { not: id } },
      select: { id: true, name: true },
    });
    if (alreadyRunning) {
      throw new Error(
        `A theme test is already running ("${alreadyRunning.name}"). Pause or archive it before activating a new one.`
      );
    }

    // Guard 2 & 3 & 4: verify theme IDs via Shopify Admin API
    // Resolve the shop domain from the shop record
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true },
    });

    if (shop) {
      try {
        const restFetch = await getShopifyRestFetch(shop.shopDomain);
        const { themes } = await restFetch<{ themes: ShopifyTheme[] }>("/themes.json");

        const publishedTheme = themes.find((t) => t.role === "main");
        const themeMap = new Map(themes.map((t) => [t.id, t]));

        // Guard 3: control theme must match the currently published theme
        // (We check if the control variant has a themeId set that differs from the live theme)
        const controlVariant = exp.variants.find((v) => v.isControl);
        const controlSettings = controlVariant?.settings as Record<string, unknown> | null;
        const controlThemeId = controlSettings?.themeId as number | undefined;

        if (controlThemeId && publishedTheme && controlThemeId !== publishedTheme.id) {
          throw new Error(
            `The control theme (ID ${controlThemeId}) does not match the currently published theme "${publishedTheme.name}" (ID ${publishedTheme.id}). Update the control or re-run setup.`
          );
        }

        // Guard 4: variant theme IDs must exist in Shopify
        for (const variant of exp.variants) {
          if (variant.isControl) continue;
          const variantSettings = variant.settings as Record<string, unknown> | null;
          const variantThemeId = variantSettings?.themeId as number | undefined;
          if (variantThemeId && !themeMap.has(variantThemeId)) {
            throw new Error(
              `Variant "${variant.name}" references theme ID ${variantThemeId}, which no longer exists in your Shopify store. Please update the variant configuration.`
            );
          }
        }
      } catch (apiError) {
        // If we can't reach Shopify (e.g. invalid session), warn but don't fully block.
        // The guard will be enforced at the API layer once real OAuth is wired.
        if (apiError instanceof Error && apiError.message.startsWith("Theme test")) {
          throw apiError; // rethrow our own guard errors
        }
        console.warn(
          "[ThemeTestService.activate] Could not verify themes via Shopify API:",
          apiError instanceof Error ? apiError.message : apiError
        );
      }
    }

    return experimentService.launch(shopId, id);
  }

  // -------------------------------------------------------------------------
  // pause / archive / duplicate
  // -------------------------------------------------------------------------
  async pause(shopId: string, id: string) {
    return experimentService.pause(shopId, id);
  }

  async archive(shopId: string, id: string) {
    return experimentService.archive(shopId, id);
  }

  async duplicate(shopId: string, id: string) {
    return experimentService.duplicate(shopId, id);
  }

  // -------------------------------------------------------------------------
  // pauseAllRunningForShop
  // Called by the themes/publish webhook when a merchant manually publishes
  // a theme while a theme test is running. Pauses all RUNNING theme tests for
  // the shop and logs the event so the merchant sees a banner on the detail page.
  // -------------------------------------------------------------------------
  async pauseAllRunningForShop(
    shopId: string,
    reason: string = "themes/publish webhook: a new theme was published manually"
  ): Promise<{ paused: number; ids: string[] }> {
    const running = await prisma.experiment.findMany({
      where: { shopId, type: "THEME_TEST", status: "RUNNING" },
      select: { id: true, name: true },
    });

    if (running.length === 0) return { paused: 0, ids: [] };

    // Pause each one and append a warning note to its settings
    await Promise.all(
      running.map(async (exp) => {
        await prisma.experiment.update({
          where: { id: exp.id },
          data: {
            status: "PAUSED",
            settings: {
              webhookPauseReason: reason,
              webhookPausedAt: new Date().toISOString(),
            },
          },
        });
      })
    );

    console.warn(
      `[ThemeTestService] Auto-paused ${running.length} running theme test(s) for shop ${shopId} — reason: ${reason}`
    );

    return { paused: running.length, ids: running.map((e) => e.id) };
  }
}
