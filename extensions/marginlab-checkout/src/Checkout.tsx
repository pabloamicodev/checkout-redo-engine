// @ts-nocheck — Shopify Checkout UI Extension: types provided at build time by Shopify CLI.
/**
 * MarginLab Checkout UI Extension
 *
 * Renders checkout blocks based on:
 * 1. Cart attributes (set by storefront runtime before checkout)
 * 2. Experiment variant assignment stored in cart
 * 3. Active personalizations matching the current buyer context
 *
 * No admin API access. All data comes from:
 * - Cart attributes (experiment assignments)
 * - Extension metafield or app bridge settings
 */

import {
  reactExtension,
  useCartLines,
  useApplyCartLinesChange,
  useAttributes,
  Banner,
  BlockStack,
  InlineStack,
  View,
  Text,
  Image,
  Button,
  Divider,
  Badge,
  Icon,
  SkeletonText,
  useShippingAddress,
  useCurrency,
  useSettings,
  useShop,
  useExtensionEditor,
} from "@shopify/ui-extensions-react/checkout";
import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckoutBlockContent {
  type: string;
  heading?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  badges?: Array<{ label: string; icon?: string }>;
  buttonText?: string;
  buttonUrl?: string;
  urgencyText?: string;
  guaranteeText?: string;
  // PRODUCT_UPSELL fields
  variantId?: string;
  // FREE_SHIPPING_PROGRESS fields
  threshold?: number;
  message?: string;
  successMessage?: string;
}

interface ExperimentAssignment {
  experimentId: string;
  variantKey: string;
  checkoutBlockType?: string;
  content?: CheckoutBlockContent;
}

// ---------------------------------------------------------------------------
// Main extension
// ---------------------------------------------------------------------------

export default reactExtension(
  "purchase.checkout.block.render",
  () => <MarginLabCheckoutBlock />
);

interface BlockOption { id: string; name: string; type: string; }

function MarginLabCheckoutBlock() {
  const attributes = useAttributes();
  const shop = useShop();
  const editor = useExtensionEditor();
  const isEditorMode = !!editor;

  const [blockContent, setBlockContent] = useState<CheckoutBlockContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableBlocks, setAvailableBlocks] = useState<BlockOption[]>([]);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>("");

  const cartAssignment = readAssignmentFromAttributes(attributes);
  const API_BASE = "https://checkout-redo-engine.vercel.app";
  const shopDomain = shop?.myshopifyDomain ?? "";
  const settings = useSettings() as Record<string, string>;
  const previewBlockId = settings.previewBlockId?.trim() || selectedPreviewId;

  // STATIC TEST — always render to confirm extension renders at all
  return (
    <BlockStack spacing="tight">
      <Text size="small" emphasis="bold">MarginLab ✓</Text>
      <InlineStack spacing="base">
        <Badge tone="success">30-Day Guarantee</Badge>
        <Badge tone="success">Fast Shipping</Badge>
        <Badge tone="success">Secure Checkout</Badge>
      </InlineStack>
      <Text size="extraSmall" appearance="subdued">
        attrs: {attributes.filter(a => a.key.startsWith("_ml")).map(a => `${a.key}=${a.value}`).join(", ") || "none"}
      </Text>
    </BlockStack>
  );

  // In editor mode, fetch list of available blocks for the picker
  useEffect(() => {
    if (!isEditorMode || !shopDomain) return;
    fetch(`${API_BASE}/api/runtime/checkout-blocks/list`, {
      headers: { "X-Shop-Domain": shopDomain },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { blocks?: BlockOption[] } | null) => { if (d?.blocks) setAvailableBlocks(d.blocks); })
      .catch(() => {});
  }, [isEditorMode, shopDomain]);

  useEffect(() => {
    console.log("[MarginLab][Checkout] attributes:", JSON.stringify(attributes));
    console.log("[MarginLab][Checkout] cartAssignment:", JSON.stringify(cartAssignment));
    console.log("[MarginLab][Checkout] shopDomain:", shopDomain);
    if (isEditorMode && previewBlockId) {
      setLoading(true);
      fetchBlockById(API_BASE, previewBlockId, shopDomain)
        .then((content) => { setBlockContent(content); setLoading(false); })
        .catch((err) => { console.error("[MarginLab][Checkout] fetchBlockById error:", err); setLoading(false); });
      return;
    }
    if (!cartAssignment) { setLoading(false); return; }
    setLoading(true);
    fetchBlockContent(API_BASE, cartAssignment, shopDomain)
      .then((content) => { console.log("[MarginLab][Checkout] blockContent:", JSON.stringify(content)); setBlockContent(content); setLoading(false); })
      .catch((err) => { console.error("[MarginLab][Checkout] fetchBlockContent error:", err); setLoading(false); });
  }, [isEditorMode, previewBlockId, cartAssignment?.experimentId, cartAssignment?.variantKey]);

  // Editor picker — no block selected yet
  if (isEditorMode && !previewBlockId) {
    return (
      <BlockStack spacing="base">
        <Text size="small" emphasis="bold">MarginLab A/B Checkout Block</Text>
        <Text size="small" appearance="subdued">
          En producción muestra el bloque del test A/B activo. Elegí uno para previsualizar:
        </Text>
        {availableBlocks.length > 0 ? (
          <BlockStack spacing="extraTight">
            {availableBlocks.map((b) => (
              <Button key={b.id} kind="secondary" onPress={() => setSelectedPreviewId(b.id)}>
                {b.name} ({b.type.replace(/_/g, " ").toLowerCase()})
              </Button>
            ))}
          </BlockStack>
        ) : (
          <InlineStack spacing="base" blockAlignment="center">
            <Badge tone="success">Secure Checkout</Badge>
            <Badge tone="success">Free Returns</Badge>
            <Badge tone="success">Fast Shipping</Badge>
          </InlineStack>
        )}
      </BlockStack>
    );
  }

  if (loading) {
    return (
      <BlockStack spacing="tight">
        <SkeletonText inlineSize="medium" />
        <SkeletonText inlineSize="small" />
      </BlockStack>
    );
  }

  if (!blockContent) {
    // DEBUG: show what attributes the extension sees
    const mlAttrs = attributes.filter((a) => a.key.startsWith("_ml"));
    return (
      <Text size="extraSmall" appearance="subdued">
        {mlAttrs.length > 0
          ? `[ML debug] assignment: ${mlAttrs.find(a => a.key.startsWith("_ml_exp_"))?.value ?? "none"}`
          : "[ML debug] no _ml_* attributes in checkout"}
      </Text>
    );
  }

  return <BlockRenderer content={blockContent} assignment={cartAssignment} />;
}

// ---------------------------------------------------------------------------
// Block renderer — maps block type to UI
// ---------------------------------------------------------------------------

function BlockRenderer({
  content,
  assignment,
}: {
  content: CheckoutBlockContent;
  assignment: ExperimentAssignment | null;
}) {
  switch (content.type) {
    case "TRUST_BADGES":
      return <TrustBadgesBlock content={content} />;
    case "TRUST_BADGES_WITH_REVIEWS":
      return <TrustBadgesWithReviewsBlock content={content} />;
    case "SOCIAL_PROOF":
      return <SocialProofBlock content={content} />;
    case "GUARANTEE":
      return <GuaranteeBlock content={content} />;
    case "SHIPPING_MESSAGE":
      return <ShippingMessageBlock content={content} />;
    case "URGENCY_MESSAGE":
      return <UrgencyMessageBlock content={content} />;
    case "PAYMENT_ICONS":
      return <PaymentIconsBlock content={content} />;
    case "CUSTOM_CONTENT":
      return <CustomContentBlock content={content} />;
    case "IMAGE_WITH_TEXT":
      return <ImageWithTextBlock content={content} />;
    case "PRODUCT_UPSELL":
      return <ProductUpsellBlock content={content} />;
    case "FREE_SHIPPING_PROGRESS":
      return <FreeShippingProgressBlock content={content} />;
    case "SECURITY_MESSAGE":
      return <SecurityMessageBlock content={content} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Block implementations
// ---------------------------------------------------------------------------

function TrustBadgesBlock({ content }: { content: CheckoutBlockContent }) {
  const badges = content.badges ?? [
    { label: "Secure Checkout" },
    { label: "Free Returns" },
    { label: "Fast Shipping" },
  ];

  return (
    <BlockStack spacing="tight">
      {content.heading && (
        <Text size="small" emphasis="bold">{content.heading}</Text>
      )}
      <InlineStack spacing="base" blockAlignment="center">
        {badges.map((badge, i) => (
          <Badge key={i} tone="success">
            {badge.label}
          </Badge>
        ))}
      </InlineStack>
    </BlockStack>
  );
}

function SocialProofBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <BlockStack spacing="tight">
      {content.heading && (
        <Text size="small" emphasis="bold">{content.heading}</Text>
      )}
      {content.body && (
        <Text size="small" appearance="subdued">{content.body}</Text>
      )}
    </BlockStack>
  );
}

function GuaranteeBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <Banner tone="success">
      <BlockStack spacing="extraTight">
        {content.heading && (
          <Text emphasis="bold">{content.heading}</Text>
        )}
        <Text size="small">
          {content.body ?? content.guaranteeText ?? "100% satisfaction guaranteed or your money back."}
        </Text>
      </BlockStack>
    </Banner>
  );
}

function ShippingMessageBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <Banner tone="info">
      <Text size="small">
        {content.body ?? "Free shipping on your order!"}
      </Text>
    </Banner>
  );
}

function UrgencyMessageBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <Banner tone="warning">
      <Text size="small" emphasis="bold">
        {content.urgencyText ?? content.body ?? "Limited time offer — don't miss out!"}
      </Text>
    </Banner>
  );
}

function PaymentIconsBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <BlockStack spacing="tight">
      {content.heading && (
        <Text size="small" emphasis="bold">{content.heading}</Text>
      )}
      <Text size="small" appearance="subdued">
        {content.body ?? "Secure payment methods accepted"}
      </Text>
    </BlockStack>
  );
}

function CustomContentBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <BlockStack spacing="tight">
      {content.heading && (
        <Text emphasis="bold">{content.heading}</Text>
      )}
      {content.body && <Text size="small">{content.body}</Text>}
      {content.buttonText && content.buttonUrl && (
        <Button kind="secondary" to={content.buttonUrl}>
          {content.buttonText}
        </Button>
      )}
    </BlockStack>
  );
}

function ImageWithTextBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <InlineStack spacing="base" blockAlignment="center">
      {content.imageUrl && (
        <Image
          source={content.imageUrl}
          description={content.imageAlt ?? ""}
          accessibilityDescription={content.imageAlt ?? ""}
        />
      )}
      <BlockStack spacing="extraTight">
        {content.heading && <Text emphasis="bold">{content.heading}</Text>}
        {content.body && <Text size="small">{content.body}</Text>}
      </BlockStack>
    </InlineStack>
  );
}

// ---------------------------------------------------------------------------
// PRODUCT_UPSELL block
// Adds a single variant to the cart with one click.
// GUARD: renders null when variantId is missing.
// ---------------------------------------------------------------------------

function ProductUpsellBlock({ content }: { content: CheckoutBlockContent }) {
  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // All hooks are called unconditionally above; guard fires after hooks.
  const variantId = content.variantId;

  // GUARD: no variantId — fail silently
  if (!variantId) return null;

  const alreadyInCart = cartLines.some((l) => l.merchandise.id === variantId);

  async function handleAdd() {
    if (adding || alreadyInCart || added) return;
    setAdding(true);
    await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: variantId,
      quantity: 1,
    });
    setAdding(false);
    setAdded(true);
  }

  const buttonLabel =
    added || alreadyInCart ? "Added ✓" : adding ? "Adding…" : content.buttonText ?? "Add to order";

  return (
    <BlockStack spacing="tight">
      {content.heading && (
        <Text emphasis="bold">{content.heading}</Text>
      )}
      {content.body && (
        <Text size="small">{content.body}</Text>
      )}
      <Button
        kind="secondary"
        onPress={handleAdd}
        disabled={adding || alreadyInCart || added}
      >
        {buttonLabel}
      </Button>
    </BlockStack>
  );
}

// ---------------------------------------------------------------------------
// FREE_SHIPPING_PROGRESS block
// Shows a simulated progress bar toward a free-shipping threshold.
// GUARD: threshold <= 0 shows the "already free" message immediately.
// ---------------------------------------------------------------------------

function FreeShippingProgressBlock({ content }: { content: CheckoutBlockContent }) {
  const cartLines = useCartLines();
  const currency = useCurrency();

  const threshold = content.threshold ?? 75;

  // Compute cart subtotal from line items
  const subtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.cost.totalAmount.amount),
    0
  );

  // GUARD: threshold <= 0 means free shipping is always unlocked
  const remaining = threshold <= 0 ? 0 : Math.max(0, threshold - subtotal);
  const pct = threshold <= 0 ? 100 : Math.min(100, (subtotal / threshold) * 100);

  const message =
    remaining <= 0
      ? (content.successMessage ?? "You've unlocked free shipping!")
      : (content.message ?? "Add {remaining} more for free shipping!").replace(
          "{remaining}",
          `${currency.isoCode} ${remaining.toFixed(2)}`
        );

  // Shopify checkout UI extensions do not expose a ProgressBar component.
  // We simulate one by rendering a filled segment inside a bordered track
  // using View blocks. The fill width is represented by choosing one of five
  // discrete fill levels (0 / 25 / 50 / 75 / 100 %) mapped from `pct`.
  const filledPercent = Math.round(pct);

  // Represent 0-100% as 0-5 discrete "fill dots" displayed in an InlineStack.
  // Each dot is a small coloured square; empty slots are lighter.
  const totalDots = 10;
  const filledDots = Math.round((filledPercent / 100) * totalDots);

  return (
    <BlockStack spacing="tight">
      <Text size="small">{message}</Text>
      {/* Simulated progress bar — 10-segment dot track */}
      <InlineStack spacing="extraTight" blockAlignment="center">
        {Array.from({ length: totalDots }).map((_, i) => (
          <View
            key={i}
            background={i < filledDots ? (filledPercent >= 100 ? "success" : "accent") : "subdued"}
            borderRadius="base"
            minBlockSize={6}
            minInlineSize={24}
          />
        ))}
      </InlineStack>
    </BlockStack>
  );
}

interface ReviewItem { id?: string; name?: string; label?: string; quote?: string; rating?: number; }
interface BadgeItem { id?: string; label: string; sublabel?: string; iconUrl?: string; alt?: string; }

function TrustBadgesWithReviewsBlock({ content }: { content: CheckoutBlockContent }) {
  const raw = content as unknown as Record<string, unknown>;
  const badges = (raw.badges as BadgeItem[]) ?? content.badges ?? [
    { label: "Secure Checkout" },
    { label: "Free Returns" },
    { label: "Fast Shipping" },
  ];
  const reviews = (raw.reviews as ReviewItem[]) ?? [];

  return (
    <BlockStack spacing="base">
      {content.heading && (
        <Text size="small" emphasis="bold">{content.heading}</Text>
      )}

      {/* Trust badges */}
      <InlineStack spacing="base" blockAlignment="center">
        {badges.map((badge, i) => (
          <BlockStack key={i} spacing="extraTight">
            <Text size="small" emphasis="bold">{badge.label}</Text>
            {badge.sublabel && (
              <Text size="extraSmall" appearance="subdued">{badge.sublabel}</Text>
            )}
          </BlockStack>
        ))}
      </InlineStack>

      {/* Customer reviews */}
      {reviews.length > 0 && (
        <BlockStack spacing="tight">
          {reviews.map((review, i) => (
            <BlockStack key={review.id ?? i} spacing="extraTight">
              <InlineStack spacing="extraTight" blockAlignment="center">
                {review.rating != null && (
                  <Text size="small">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</Text>
                )}
                {review.name && (
                  <Text size="small" emphasis="bold">{review.name}</Text>
                )}
                {review.label && (
                  <Text size="extraSmall" appearance="subdued">{review.label}</Text>
                )}
              </InlineStack>
              {review.quote && (
                <Text size="small" appearance="subdued">"{review.quote}"</Text>
              )}
            </BlockStack>
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}

function SecurityMessageBlock({ content }: { content: CheckoutBlockContent }) {
  return (
    <BlockStack spacing="tight">
      {content.heading && (
        <Text size="small" emphasis="bold">{content.heading}</Text>
      )}
      {content.body && (
        <Text size="small" appearance="subdued">{content.body}</Text>
      )}
    </BlockStack>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAssignmentFromAttributes(
  attributes: ReadonlyArray<{ key: string; value: string }>
): ExperimentAssignment | null {
  const expAttr = attributes.find((a) => a.key.startsWith("_ml_exp_"));
  const visitorAttr = attributes.find((a) => a.key === "_ml_visitor_id");

  if (!expAttr) return null;

  const expId = expAttr.key.replace("_ml_exp_", "");
  return {
    experimentId: expId,
    variantKey: expAttr.value,
  };
}

async function fetchBlockContent(
  apiBase: string,
  assignment: ExperimentAssignment,
  shopDomain: string
): Promise<CheckoutBlockContent | null> {
  try {
    const res = await fetch(
      `${apiBase}/api/runtime/checkout-blocks?experimentId=${assignment.experimentId}&variantKey=${assignment.variantKey}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(shopDomain ? { "X-Shop-Domain": shopDomain } : {}),
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { block?: { content?: CheckoutBlockContent; type?: string } };
    if (!data.block) return null;
    return { ...data.block.content, type: data.block.type } as CheckoutBlockContent;
  } catch {
    return null;
  }
}

// Fetch a checkout block directly by ID — used for editor preview.
async function fetchBlockById(
  apiBase: string,
  blockId: string,
  shopDomain: string
): Promise<CheckoutBlockContent | null> {
  try {
    const res = await fetch(
      `${apiBase}/api/runtime/checkout-blocks?blockId=${blockId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(shopDomain ? { "X-Shop-Domain": shopDomain } : {}),
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { block?: { content?: CheckoutBlockContent; type?: string } };
    if (!data.block) return null;
    return { ...data.block.content, type: data.block.type } as CheckoutBlockContent;
  } catch {
    return null;
  }
}
