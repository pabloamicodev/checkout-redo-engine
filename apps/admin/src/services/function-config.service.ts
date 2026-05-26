/**
 * FunctionConfigService — manages Shopify Discount node metafields
 * that drive the MarginLab Shopify Function extensions.
 *
 * Each Function reads its config from a JSON metafield on the
 * corresponding automatic discount node. This service keeps those
 * metafields in sync when offers or experiments change.
 *
 * Metafield namespace: "$app:marginlab"
 * Keys:
 *   - order-discount-config          (marginlab-order-discount function)
 *   - product-discount-config        (marginlab-product-discount function)
 *   - shipping-customization-config  (marginlab-delivery-customization function)
 */

import { prisma } from "@/lib/prisma";
import { shopifyAdminGraphQL as shopifyGraphQL } from "@/lib/shopify-admin-graphql";

// ---------------------------------------------------------------------------
// GQL mutations / queries
// ---------------------------------------------------------------------------

const DELIVERY_CUSTOMIZATION_CREATE_MUTATION = /* gql */ `
  mutation deliveryCustomizationCreate($deliveryCustomization: DeliveryCustomizationInput!) {
    deliveryCustomizationCreate(deliveryCustomization: $deliveryCustomization) {
      deliveryCustomization {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELIVERY_CUSTOMIZATION_QUERY = /* gql */ `
  query getDeliveryCustomization($id: ID!, $metafieldKey: String!) {
    deliveryCustomization(id: $id) {
      id
      metafield(namespace: "$app:marginlab", key: $metafieldKey) {
        id
        value
      }
    }
  }
`;

const DISCOUNT_AUTOMATIC_CREATE_MUTATION = /* gql */ `
  mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const METAFIELD_SET_MUTATION = /* gql */ `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        namespace
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DISCOUNT_QUERY = /* gql */ `
  query getDiscount($id: ID!, $metafieldKey: String!) {
    discountNode(id: $id) {
      id
      metafield(namespace: "$app:marginlab", key: $metafieldKey) {
        id
        value
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunctionDiscountNode {
  discountId: string;
  functionHandle: string;
  metafieldKey: string;
}

export interface VariantDiscountRule {
  experiment_id: string;
  variant_key: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minimum_cart_value?: number;
  message?: string;
}

export interface OfferRule {
  offer_id: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE";
  value: number;
  minimum_cart_value?: number;
  requires_activation: boolean;
  message?: string;
}

export interface OrderDiscountConfig {
  variant_discounts: VariantDiscountRule[];
  offer_rules: OfferRule[];
}

export interface ShippingDiscountConfig {
  variant_discounts: Array<VariantDiscountRule & { discount_type: "FREE" | "PERCENTAGE" | "FIXED_AMOUNT" }>;
  offer_rules: Array<OfferRule & { discount_type: "FREE" | "PERCENTAGE" | "FIXED_AMOUNT" }>;
}

export type ShippingMethodOperation =
  | { type: "hide"; title_contains: string }
  | { type: "rename"; title_from: string; title_to: string };

export interface ShippingRule {
  experiment_id: string;
  variant_key: string;
  operations: ShippingMethodOperation[];
}

export interface ShippingCustomizationConfig {
  shipping_rules: ShippingRule[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FunctionConfigService {
  /**
   * Ensures the automatic discount node for the given function exists.
   * Returns the discount GID. Creates it if missing.
   */
  async ensureDiscount(
    shopDomain: string,
    functionHandle: string,
    title: string
  ): Promise<string> {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { settings: true },
    });

    // Check if we already stored the discount GID for this function
    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    const stored = (settings["functionDiscountIds"] as Record<string, string>) ?? {};
    if (stored[functionHandle]) {
      return stored[functionHandle];
    }

    // Create an automatic app discount
    const data = await shopifyGraphQL(shopDomain, DISCOUNT_AUTOMATIC_CREATE_MUTATION, {
      automaticAppDiscount: {
        title,
        functionId: functionHandle,
        startsAt: new Date().toISOString(),
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: true,
          shippingDiscounts: true,
        },
      },
    });

    const result = data.discountAutomaticAppCreate as {
      automaticAppDiscount?: { discountId: string };
      userErrors?: { message: string }[];
    };

    const userErrors = result.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new Error(`Failed to create discount: ${userErrors[0]?.message ?? "unknown"}`);
    }

    const discountId = result.automaticAppDiscount!.discountId;

    // Persist the discount GID inside shop.settings
    await prisma.shop.update({
      where: { shopDomain },
      data: {
        settings: {
          ...settings,
          functionDiscountIds: { ...stored, [functionHandle]: discountId },
        } as never,
      },
    });

    return discountId;
  }

  /**
   * Writes a JSON config to the metafield of a discount node.
   * This is what the Shopify Function reads at runtime.
   */
  async setDiscountConfig(
    shopDomain: string,
    discountGid: string,
    metafieldKey: string,
    config: OrderDiscountConfig | ShippingDiscountConfig
  ): Promise<void> {
    const data = await shopifyGraphQL(shopDomain, METAFIELD_SET_MUTATION, {
      metafields: [
        {
          ownerId: discountGid,
          namespace: "$app:marginlab",
          key: metafieldKey,
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    });

    const result = data.metafieldsSet as { userErrors?: { message: string }[] };
    const userErrors = result.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new Error(`Failed to set metafield: ${userErrors[0]?.message ?? "unknown"}`);
    }
  }

  /**
   * Reads the current config from a discount node's metafield.
   */
  async getDiscountConfig<T extends OrderDiscountConfig | ShippingDiscountConfig>(
    shopDomain: string,
    discountGid: string,
    metafieldKey: string,
    defaultValue: T
  ): Promise<T> {
    const data = await shopifyGraphQL(shopDomain, DISCOUNT_QUERY, { id: discountGid, metafieldKey });
    const node = data.discountNode as {
      metafield?: { value: string };
    } | null;

    if (!node?.metafield?.value) return defaultValue;

    try {
      return JSON.parse(node.metafield.value) as T;
    } catch {
      return defaultValue;
    }
  }

  // ---------------------------------------------------------------------------
  // High-level helpers for offer registration
  // ---------------------------------------------------------------------------

  /**
   * Registers an offer's discount rules into the appropriate Shopify Function config.
   * Call this when an offer is activated.
   */
  async registerOffer(
    shopDomain: string,
    offer: {
      id: string;
      type: string;
      discountRules: Record<string, unknown>;
      triggerRules: unknown[];
    }
  ): Promise<void> {
    const { functionHandle, metafieldKey, buildRule } = this.resolveOfferMapping(offer.type);
    if (!functionHandle) return; // Campaign link offers don't use Functions

    const discountGid = await this.ensureDiscount(
      shopDomain,
      functionHandle,
      `MarginLab – ${offer.type.replace(/_/g, " ")}`
    );

    const defaultConfig: OrderDiscountConfig = { variant_discounts: [], offer_rules: [] };
    const current = await this.getDiscountConfig(shopDomain, discountGid, metafieldKey, defaultConfig);

    const rule = buildRule(offer);

    // Replace existing rule for this offer or append
    const existingIndex = current.offer_rules.findIndex((r) => r.offer_id === offer.id);
    if (existingIndex >= 0) {
      current.offer_rules[existingIndex] = rule;
    } else {
      current.offer_rules.push(rule);
    }

    await this.setDiscountConfig(shopDomain, discountGid, metafieldKey, current);
  }

  /**
   * Removes an offer's rules from the Function config.
   * Call this when an offer is paused or archived.
   */
  async deregisterOffer(shopDomain: string, offerId: string, offerType: string): Promise<void> {
    const { functionHandle, metafieldKey } = this.resolveOfferMapping(offerType);
    if (!functionHandle) return;

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { settings: true },
    });

    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    const stored = (settings["functionDiscountIds"] as Record<string, string>) ?? {};
    const discountGid = stored[functionHandle];
    if (!discountGid) return; // Nothing to remove

    const defaultConfig: OrderDiscountConfig = { variant_discounts: [], offer_rules: [] };
    const current = await this.getDiscountConfig(shopDomain, discountGid, metafieldKey, defaultConfig);

    current.offer_rules = current.offer_rules.filter((r) => r.offer_id !== offerId);

    await this.setDiscountConfig(shopDomain, discountGid, metafieldKey, current);
  }

  // ---------------------------------------------------------------------------
  // Discount experiment registration
  // ---------------------------------------------------------------------------

  /**
   * Registers all variant discount rules for a DISCOUNT_TEST experiment into the
   * `marginlab-order-discount` Function metafield. Call this when the experiment
   * is launched (status → RUNNING).
   */
  async registerDiscountExperiment(
    shopDomain: string,
    experiment: {
      id: string;
      variants: Array<{
        key: string;
        isControl: boolean;
        discountConfig?: Record<string, unknown> | null;
      }>;
    }
  ): Promise<void> {
    const functionHandle = "marginlab-order-discount";
    const metafieldKey = "order-discount-config";

    const discountGid = await this.ensureDiscount(
      shopDomain,
      functionHandle,
      "MarginLab – Discount Tests"
    );

    const defaultConfig: OrderDiscountConfig = { variant_discounts: [], offer_rules: [] };
    const current = await this.getDiscountConfig(shopDomain, discountGid, metafieldKey, defaultConfig);

    // Remove stale rules for this experiment, then re-add
    current.variant_discounts = current.variant_discounts.filter(
      (r) => r.experiment_id !== experiment.id
    );

    for (const variant of experiment.variants) {
      if (variant.isControl) continue; // control = no discount

      const cfg = variant.discountConfig;
      if (!cfg || !cfg["value"]) continue;

      const discountType =
        (cfg["type"] as string | undefined) === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE";

      current.variant_discounts.push({
        experiment_id: experiment.id,
        variant_key: variant.key,
        discount_type: discountType,
        value: cfg["value"] as number,
        message: cfg["message"] as string | undefined,
      });
    }

    await this.setDiscountConfig(shopDomain, discountGid, metafieldKey, current);
  }

  /**
   * Removes all variant discount rules for a DISCOUNT_TEST experiment.
   * Call this when the experiment is paused, completed, or archived.
   */
  async deregisterDiscountExperiment(shopDomain: string, experimentId: string): Promise<void> {
    const functionHandle = "marginlab-order-discount";
    const metafieldKey = "order-discount-config";

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { settings: true },
    });

    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    const stored = (settings["functionDiscountIds"] as Record<string, string>) ?? {};
    const discountGid = stored[functionHandle];
    if (!discountGid) return;

    const defaultConfig: OrderDiscountConfig = { variant_discounts: [], offer_rules: [] };
    const current = await this.getDiscountConfig(shopDomain, discountGid, metafieldKey, defaultConfig);

    current.variant_discounts = current.variant_discounts.filter(
      (r) => r.experiment_id !== experimentId
    );

    await this.setDiscountConfig(shopDomain, discountGid, metafieldKey, current);
  }

  // ---------------------------------------------------------------------------
  // Price experiment registration (SHOPIFY_FUNCTION enforcement strategy)
  // ---------------------------------------------------------------------------

  /**
   * Writes variant discount rules for a PRICE_TEST (SHOPIFY_FUNCTION strategy) into the
   * marginlab-order-discount Function metafield. The discount per variant is computed as
   * (control_price - test_price), expressed as a FIXED_AMOUNT per Shopify variant GID.
   * Call this when the experiment is launched (status → RUNNING).
   */
  async registerPriceExperiment(
    shopDomain: string,
    experiment: {
      id: string;
      variants: Array<{
        key: string;
        isControl: boolean;
        priceOverrides: Array<{
          shopifyVariantId: string;
          price: string;
          compareAtPrice?: string | null;
        }>;
      }>;
    }
  ): Promise<void> {
    const functionHandle = "marginlab-order-discount";
    const metafieldKey = "order-discount-config";

    const discountGid = await this.ensureDiscount(
      shopDomain,
      functionHandle,
      "MarginLab – Price Tests"
    );

    const defaultConfig: OrderDiscountConfig = { variant_discounts: [], offer_rules: [] };
    const current = await this.getDiscountConfig(shopDomain, discountGid, metafieldKey, defaultConfig);

    // Remove stale rules for this experiment, then rebuild
    current.variant_discounts = current.variant_discounts.filter(
      (r) => r.experiment_id !== experiment.id
    );

    // Build a map of control prices keyed by Shopify variant GID
    const control = experiment.variants.find((v) => v.isControl);
    if (!control) return;

    const controlPrices: Record<string, number> = {};
    for (const o of control.priceOverrides) {
      const parsed = parseFloat(o.price);
      if (!isNaN(parsed)) controlPrices[o.shopifyVariantId] = parsed;
    }

    // One rule per non-control variant: discount = control_price - test_price
    for (const variant of experiment.variants) {
      if (variant.isControl) continue;

      for (const override of variant.priceOverrides) {
        const controlPrice = controlPrices[override.shopifyVariantId];
        if (controlPrice === undefined) continue;

        const testPrice = parseFloat(override.price);
        if (isNaN(testPrice)) continue;

        const discountAmount = Math.round((controlPrice - testPrice) * 100) / 100;
        if (discountAmount <= 0) continue; // test price >= control, no discount needed

        current.variant_discounts.push({
          experiment_id: experiment.id,
          variant_key: variant.key,
          discount_type: "FIXED_AMOUNT",
          value: discountAmount,
          message: `Price Test – ${variant.key}`,
        });
      }
    }

    await this.setDiscountConfig(shopDomain, discountGid, metafieldKey, current);
  }

  /**
   * Removes all variant discount rules for a PRICE_TEST experiment.
   * Call this when the experiment is paused, completed, or archived.
   */
  async deregisterPriceExperiment(shopDomain: string, experimentId: string): Promise<void> {
    const functionHandle = "marginlab-order-discount";
    const metafieldKey = "order-discount-config";

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { settings: true },
    });

    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    const stored = (settings["functionDiscountIds"] as Record<string, string>) ?? {};
    const discountGid = stored[functionHandle];
    if (!discountGid) return;

    const defaultConfig: OrderDiscountConfig = { variant_discounts: [], offer_rules: [] };
    const current = await this.getDiscountConfig(shopDomain, discountGid, metafieldKey, defaultConfig);

    current.variant_discounts = current.variant_discounts.filter(
      (r) => r.experiment_id !== experimentId
    );

    await this.setDiscountConfig(shopDomain, discountGid, metafieldKey, current);
  }

  // ---------------------------------------------------------------------------
  // Shipping experiment registration (DELIVERY_CUSTOMIZATION enforcement)
  // ---------------------------------------------------------------------------

  /**
   * Ensures the DeliveryCustomization node for the marginlab-delivery-customization
   * function exists in Shopify. Returns its GID. Creates it if missing.
   * The GID is persisted in shop.settings.functionDeliveryCustomizationIds.
   */
  private async ensureDeliveryCustomization(
    shopDomain: string,
    functionHandle: string,
    title: string
  ): Promise<string> {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { settings: true },
    });

    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    const stored = (settings["functionDeliveryCustomizationIds"] as Record<string, string>) ?? {};
    if (stored[functionHandle]) return stored[functionHandle];

    const data = await shopifyGraphQL(shopDomain, DELIVERY_CUSTOMIZATION_CREATE_MUTATION, {
      deliveryCustomization: {
        functionId: functionHandle,
        title,
        enabled: true,
      },
    });

    const result = data.deliveryCustomizationCreate as {
      deliveryCustomization?: { id: string };
      userErrors?: { message: string }[];
    };

    const userErrors = result.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new Error(`Failed to create delivery customization: ${userErrors[0]?.message ?? "unknown"}`);
    }

    const customizationId = result.deliveryCustomization!.id;

    await prisma.shop.update({
      where: { shopDomain },
      data: {
        settings: {
          ...settings,
          functionDeliveryCustomizationIds: { ...stored, [functionHandle]: customizationId },
        } as never,
      },
    });

    return customizationId;
  }

  private async getShippingConfig(
    shopDomain: string,
    customizationId: string,
    defaultValue: ShippingCustomizationConfig
  ): Promise<ShippingCustomizationConfig> {
    const data = await shopifyGraphQL(shopDomain, DELIVERY_CUSTOMIZATION_QUERY, {
      id: customizationId,
      metafieldKey: "shipping-customization-config",
    });
    const node = data.deliveryCustomization as {
      metafield?: { value: string };
    } | null;

    if (!node?.metafield?.value) return defaultValue;

    try {
      return JSON.parse(node.metafield.value) as ShippingCustomizationConfig;
    } catch {
      return defaultValue;
    }
  }

  private async setShippingConfig(
    shopDomain: string,
    customizationId: string,
    config: ShippingCustomizationConfig
  ): Promise<void> {
    const data = await shopifyGraphQL(shopDomain, METAFIELD_SET_MUTATION, {
      metafields: [
        {
          ownerId: customizationId,
          namespace: "$app:marginlab",
          key: "shipping-customization-config",
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    });

    const result = data.metafieldsSet as { userErrors?: { message: string }[] };
    const userErrors = result.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new Error(`Failed to set shipping metafield: ${userErrors[0]?.message ?? "unknown"}`);
    }
  }

  /**
   * Registers shipping method operations for each non-control variant of a
   * SHIPPING_TEST experiment into the marginlab-delivery-customization Function.
   * Variant operations are taken from shippingConfig.variants[key].methodOperations.
   * Call this when the experiment is launched (status → RUNNING).
   */
  async registerShippingExperiment(
    shopDomain: string,
    experiment: {
      id: string;
      shippingConfig: Record<string, unknown>;
      variants: Array<{ key: string; isControl: boolean }>;
    }
  ): Promise<void> {
    const functionHandle = "marginlab-delivery-customization";

    const customizationId = await this.ensureDeliveryCustomization(
      shopDomain,
      functionHandle,
      "MarginLab – Shipping Tests"
    );

    const defaultConfig: ShippingCustomizationConfig = { shipping_rules: [] };
    const current = await this.getShippingConfig(shopDomain, customizationId, defaultConfig);

    // Remove stale rules for this experiment, then rebuild
    current.shipping_rules = current.shipping_rules.filter(
      (r) => r.experiment_id !== experiment.id
    );

    const variantsConfig = (experiment.shippingConfig["variants"] as Record<string, unknown>) ?? {};

    for (const variant of experiment.variants) {
      if (variant.isControl) continue;

      const vCfg = variantsConfig[variant.key] as Record<string, unknown> | undefined;
      if (!vCfg) continue;

      const rawOps = (vCfg["methodOperations"] as Array<Record<string, unknown>>) ?? [];
      if (!rawOps.length) continue;

      const operations: ShippingMethodOperation[] = [];
      for (const op of rawOps) {
        if (op["type"] === "hide" && op["titleContains"]) {
          operations.push({ type: "hide", title_contains: op["titleContains"] as string });
        } else if (op["type"] === "rename" && op["titleFrom"] && op["titleTo"]) {
          operations.push({
            type: "rename",
            title_from: op["titleFrom"] as string,
            title_to: op["titleTo"] as string,
          });
        }
      }

      if (!operations.length) continue;

      current.shipping_rules.push({
        experiment_id: experiment.id,
        variant_key: variant.key,
        operations,
      });
    }

    await this.setShippingConfig(shopDomain, customizationId, current);
  }

  /**
   * Removes all shipping rules for a SHIPPING_TEST experiment.
   * Call this when the experiment is paused, completed, or archived.
   */
  async deregisterShippingExperiment(shopDomain: string, experimentId: string): Promise<void> {
    const functionHandle = "marginlab-delivery-customization";

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { settings: true },
    });

    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    const stored = (settings["functionDeliveryCustomizationIds"] as Record<string, string>) ?? {};
    const customizationId = stored[functionHandle];
    if (!customizationId) return;

    const defaultConfig: ShippingCustomizationConfig = { shipping_rules: [] };
    const current = await this.getShippingConfig(shopDomain, customizationId, defaultConfig);

    current.shipping_rules = current.shipping_rules.filter(
      (r) => r.experiment_id !== experimentId
    );

    await this.setShippingConfig(shopDomain, customizationId, current);
  }

  // ---------------------------------------------------------------------------
  // Internal mapping: offer type → Shopify Function
  // ---------------------------------------------------------------------------

  private resolveOfferMapping(offerType: string): {
    functionHandle: string;
    metafieldKey: string;
    buildRule: (offer: {
      id: string;
      discountRules: Record<string, unknown>;
      triggerRules: unknown[];
    }) => OfferRule;
  } {
    const minCartValue = (triggerRules: unknown[]): number | undefined => {
      const rule = (triggerRules as Array<Record<string, unknown>>).find(
        (r) => r["type"] === "min_cart_value"
      );
      return rule ? (rule["minValue"] as number) : undefined;
    };

    switch (offerType) {
      case "ORDER_DISCOUNT":
        return {
          functionHandle: "marginlab-order-discount",
          metafieldKey: "order-discount-config",
          buildRule: (offer) => ({
            offer_id: offer.id,
            discount_type: "FIXED_AMOUNT",
            value: (offer.discountRules["amount"] as number) ?? 0,
            minimum_cart_value: minCartValue(offer.triggerRules),
            requires_activation: false,
          }),
        };

      case "PERCENTAGE_DISCOUNT":
        return {
          functionHandle: "marginlab-order-discount",
          metafieldKey: "order-discount-config",
          buildRule: (offer) => ({
            offer_id: offer.id,
            discount_type: "PERCENTAGE",
            value: (offer.discountRules["percentage"] as number) ?? 0,
            minimum_cart_value: minCartValue(offer.triggerRules),
            requires_activation: false,
          }),
        };

      case "FREE_SHIPPING":
      case "PRODUCT_DISCOUNT":
      case "CAMPAIGN_LINK_OFFER":
      default:
        // FREE_SHIPPING and PRODUCT_DISCOUNT require function extensions that do not
        // yet exist (marginlab-shipping-discount, marginlab-product-discount).
        // CAMPAIGN_LINK_OFFER is handled client-side via URL param → cart attribute.
        // All other offer types (VOLUME_DISCOUNT, BUY_X_GET_Y, etc.) are served by
        // the volume-discount extension which reads per-product metafields, not the
        // centrally-managed discount node — so they are not wired here.
        // Return empty handles to make callers a no-op rather than crash.
        return {
          functionHandle: "",
          metafieldKey: "",
          buildRule: () => ({
            offer_id: "",
            discount_type: "PERCENTAGE",
            value: 0,
            requires_activation: false,
          }),
        };
    }
  }
}
