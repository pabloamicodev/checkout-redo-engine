/**
 * RuntimeConfigService builds the experiment config payload served to
 * the storefront runtime. This payload is cached in Redis and served
 * with stale-while-revalidate semantics.
 *
 * The payload intentionally contains ONLY the information the storefront
 * needs — no access tokens, no COGS, no order data.
 */

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/redis";

export interface RuntimeVariant {
  id: string;
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  modifications: unknown[];
  priceOverrides: unknown[];
  redirectUrl: string | null;
  checkoutBlockIds: string[];
  offerIds: string[];
}

export interface RuntimeExperiment {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  trafficAllocation: number;
  assignmentStrategy: string;
  targetingRules: unknown[];
  variants: RuntimeVariant[];
  settings: unknown;
  priceConfig: unknown | null;
  contentConfig: unknown | null;
  splitUrlConfig: unknown | null;
}

export interface RuntimeOffer {
  id: string;
  name: string;
  type: string;
  triggerRules: unknown[];
  discountRules: unknown;
  displaySettings: unknown;
}

export interface RuntimeCheckoutBlock {
  id: string;
  name: string;
  type: string;
  content: unknown;
  styles: unknown;
  targetingRules: unknown[];
  position: string;
  experimentId: string | null;
  variantId: string | null;
}

export interface RuntimePersonalization {
  id: string;
  type: string;
  name: string;
  priority: number;
  targetingRules: unknown[];
  modifications: unknown[];
  offerIds: string[];
  startsAt: string | null;
  endsAt: string | null;
}

export interface RuntimeKillSwitches {
  // Global — disables ALL MarginLab storefront behavior for this shop
  globalDisabled: boolean;
  // Granular feature disables
  contentModificationsDisabled: boolean;
  priceDisplayDisabled: boolean;
  offerWidgetsDisabled: boolean;
  splitUrlRedirectsDisabled: boolean;
  debugOverlayDisabled: boolean;
}

export interface RuntimeConfig {
  shopDomain: string;
  updatedAt: string;
  experiments: RuntimeExperiment[];
  offers: RuntimeOffer[];
  checkoutBlocks: RuntimeCheckoutBlock[];
  personalizations: RuntimePersonalization[];
  settings: {
    antiFlickerEnabled: boolean;
    antiFlickerTimeout: number;
    debugModeEnabled: boolean;
  };
  killSwitches: RuntimeKillSwitches;
}

export class RuntimeConfigService {
  async get(shopDomain: string): Promise<RuntimeConfig | null> {
    const cacheKey = `runtime:config:${shopDomain}`;

    const cached = await cacheGet<RuntimeConfig>(cacheKey);
    if (cached) return cached;

    const fresh = await this.build(shopDomain);
    if (fresh) {
      await cacheSet(cacheKey, fresh, CACHE_TTL.RUNTIME_CONFIG);
    }
    return fresh;
  }

  async build(shopDomain: string): Promise<RuntimeConfig | null> {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: {
        experiments: {
          where: {
            status: { in: ["RUNNING", "PREVIEW", "QA"] },
          },
          include: {
            variants: {
              orderBy: { isControl: "desc" },
            },
          },
        },
        offers: {
          where: { status: "ACTIVE" },
        },
        checkoutBlocks: {
          where: { status: "ACTIVE" },
        },
        personalizations: {
          where: { status: "ACTIVE" },
          orderBy: { priority: "asc" },
        },
      },
    });

    if (!shop) return null;

    const shopSettings = shop.settings as Record<string, unknown>;

    const config: RuntimeConfig = {
      shopDomain,
      updatedAt: new Date().toISOString(),
      experiments: shop.experiments.map((exp) => ({
        id: exp.id,
        slug: exp.slug,
        name: exp.name,
        type: exp.type,
        status: exp.status,
        trafficAllocation: exp.trafficAllocation,
        assignmentStrategy: exp.assignmentStrategy,
        targetingRules: exp.targetingRules as unknown[],
        variants: exp.variants.map((v) => ({
          id: v.id,
          key: v.key,
          name: v.name,
          isControl: v.isControl,
          allocationPercent: v.allocationPercent,
          modifications: v.modifications as unknown[],
          priceOverrides: v.priceOverrides as unknown[],
          redirectUrl: v.redirectUrl,
          checkoutBlockIds: v.checkoutBlockIds,
          offerIds: v.offerIds,
        })),
        settings: exp.settings,
        priceConfig: exp.priceConfig,
        contentConfig: exp.contentConfig,
        splitUrlConfig: exp.splitUrlConfig,
      })),
      offers: shop.offers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        type: offer.type,
        triggerRules: offer.triggerRules as unknown[],
        discountRules: offer.discountRules,
        displaySettings: offer.displaySettings,
      })),
      checkoutBlocks: shop.checkoutBlocks.map((block) => ({
        id: block.id,
        name: block.name,
        type: block.type,
        content: block.content,
        styles: block.styles,
        targetingRules: block.targetingRules as unknown[],
        position: block.position,
        experimentId: block.experimentId,
        variantId: block.variantId,
      })),
      personalizations: shop.personalizations.map((p) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        priority: p.priority,
        targetingRules: p.targetingRules as unknown[],
        modifications: p.modifications as unknown[],
        offerIds: p.offerIds,
        startsAt: p.startsAt?.toISOString() ?? null,
        endsAt: p.endsAt?.toISOString() ?? null,
      })),
      settings: {
        antiFlickerEnabled: (shopSettings.antiFlickerEnabled as boolean) ?? true,
        antiFlickerTimeout: (shopSettings.antiFlickerTimeout as number) ?? 300,
        debugModeEnabled: (shopSettings.debugModeEnabled as boolean) ?? false,
      },
      killSwitches: {
        globalDisabled: (shopSettings.ks_globalDisabled as boolean) ?? false,
        contentModificationsDisabled: (shopSettings.ks_contentModificationsDisabled as boolean) ?? false,
        priceDisplayDisabled: (shopSettings.ks_priceDisplayDisabled as boolean) ?? false,
        offerWidgetsDisabled: (shopSettings.ks_offerWidgetsDisabled as boolean) ?? false,
        splitUrlRedirectsDisabled: (shopSettings.ks_splitUrlRedirectsDisabled as boolean) ?? false,
        debugOverlayDisabled: (shopSettings.ks_debugOverlayDisabled as boolean) ?? true,
      },
    };

    return config;
  }

  async invalidate(shopDomain: string): Promise<void> {
    const { cacheDel } = await import("@/lib/redis");
    await cacheDel(`runtime:config:${shopDomain}`);
  }
}
