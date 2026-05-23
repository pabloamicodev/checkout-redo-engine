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
 *   - order-discount-config
 *   - product-discount-config
 *   - shipping-discount-config
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Shopify GraphQL helpers
// ---------------------------------------------------------------------------

async function shopifyGraphQL(
  shopDomain: string,
  query: string,
  variables: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!token) throw new Error("SHOPIFY_ADMIN_TOKEN is not set");

  const res = await fetch(`https://${shopDomain}/admin/api/2025-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data ?? {};
}

// ---------------------------------------------------------------------------
// GQL mutations
// ---------------------------------------------------------------------------

const DISCOUNT_AUTOMATIC_CREATE_MUTATION = /* GraphQL */ `
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

const METAFIELD_SET_MUTATION = /* GraphQL */ `
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

const DISCOUNT_QUERY = /* GraphQL */ `
  query getDiscount($id: ID!) {
    discountNode(id: $id) {
      id
      metafield(namespace: "$app:marginlab", key: "order-discount-config") {
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
    const data = await shopifyGraphQL(shopDomain, DISCOUNT_QUERY, { id: discountGid });
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
        return {
          functionHandle: "marginlab-shipping-discount",
          metafieldKey: "shipping-discount-config",
          buildRule: (offer) => ({
            offer_id: offer.id,
            discount_type: "FREE",
            value: 100,
            minimum_cart_value:
              (offer.discountRules["threshold"] as number | undefined) ??
              minCartValue(offer.triggerRules),
            requires_activation: false,
          }),
        };

      case "PRODUCT_DISCOUNT":
        return {
          functionHandle: "marginlab-product-discount",
          metafieldKey: "product-discount-config",
          buildRule: (offer) => ({
            offer_id: offer.id,
            discount_type: "PERCENTAGE",
            value: (offer.discountRules["percentage"] as number) ?? 0,
            minimum_cart_value: minCartValue(offer.triggerRules),
            requires_activation: false,
          }),
        };

      case "CAMPAIGN_LINK_OFFER":
        // No Shopify Function — handled client-side via URL param → cart attribute
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

      default:
        // VOLUME_DISCOUNT, QUANTITY_BREAK, BUY_X_GET_Y, FREE_GIFT, TIERED_PROGRESS_BAR
        // all route through the product discount function
        return {
          functionHandle: "marginlab-product-discount",
          metafieldKey: "product-discount-config",
          buildRule: (offer) => ({
            offer_id: offer.id,
            discount_type: "PERCENTAGE",
            value: 0,
            minimum_cart_value: minCartValue(offer.triggerRules),
            requires_activation: false,
          }),
        };
    }
  }
}
