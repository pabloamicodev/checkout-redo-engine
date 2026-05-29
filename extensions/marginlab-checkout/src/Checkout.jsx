/**
 * MarginLab Checkout UI Extension
 *
 * Renders checkout blocks based on cart attributes (experiment assignments).
 * Uses @shopify/ui-extensions preact integration (s-* web components).
 */
import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default function () {
  render(<Extension />, document.body);
}

const API_BASE = "https://checkout-redo-engine.vercel.app";

function Extension() {
  const { lines, attributes, applyCartLinesChange, localization } = shopify;
  const shopDomain = shopify.shop?.myshopifyDomain ?? "";

  const [cartLines, setCartLines] = useState(lines.current);
  const [cartAttributes, setCartAttributes] = useState(attributes.current);
  const [blockContent, setBlockContent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to reactive updates
  useEffect(() => {
    const unsubLines = lines.subscribe((v) => setCartLines(v));
    const unsubAttrs = attributes.subscribe((v) => setCartAttributes(v));
    return () => { unsubLines(); unsubAttrs(); };
  }, []);

  // Read experiment assignment from cart attributes
  const assignment = readAssignment(cartAttributes);

  useEffect(() => {
    if (!assignment) { setLoading(false); return; }

    setLoading(true);
    fetchBlockContent(API_BASE, assignment, shopDomain)
      .then((c) => { setBlockContent(c); setLoading(false); })
      .catch(() => setLoading(false));
  }, [assignment?.experimentId]);

  if (loading) {
    return (
      <s-stack direction="block" gap="small">
        <s-skeleton-text inlineSize="medium" />
        <s-skeleton-text inlineSize="small" />
      </s-stack>
    );
  }

  if (!blockContent) return null;

  return (
    <BlockRenderer
      content={blockContent}
      cartLines={cartLines}
      applyCartLinesChange={applyCartLinesChange}
      currency={localization?.currency?.current?.isoCode ?? "USD"}
    />
  );
}

// ---------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------

function BlockRenderer({ content, cartLines, applyCartLinesChange, currency }) {
  const props = { content, cartLines, applyCartLinesChange, currency };
  switch (content.type) {
    case "TRUST_BADGES":                return <TrustBadgesBlock {...props} />;
    case "SOCIAL_PROOF":                return <SocialProofBlock {...props} />;
    case "TRUST_BADGES_WITH_REVIEWS":   return <TrustBadgesWithReviewsBlock {...props} />;
    case "GUARANTEE":          return <GuaranteeBlock {...props} />;
    case "SHIPPING_MESSAGE":   return <ShippingMessageBlock {...props} />;
    case "URGENCY_MESSAGE":    return <UrgencyMessageBlock {...props} />;
    case "PAYMENT_ICONS":      return <PaymentIconsBlock {...props} />;
    case "CUSTOM_CONTENT":     return <CustomContentBlock {...props} />;
    case "IMAGE_WITH_TEXT":    return <ImageWithTextBlock {...props} />;
    case "PRODUCT_UPSELL":     return <ProductUpsellBlock {...props} />;
    case "FREE_SHIPPING_PROGRESS": return <FreeShippingProgressBlock {...props} />;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Block implementations
// ---------------------------------------------------------------------------

function TrustBadgesBlock({ content }) {
  const badges = content.badges ?? [
    { label: "Secure Checkout" },
    { label: "Free Returns" },
    { label: "Fast Shipping" },
  ];
  return (
    <s-stack direction="block" gap="small">
      {content.heading && <s-text type="strong">{content.heading}</s-text>}
      <s-stack direction="inline" gap="small" alignItems="center" wrap>
        {badges.map((b, i) => (
          <s-badge key={i} tone="success">{b.label}</s-badge>
        ))}
      </s-stack>
    </s-stack>
  );
}

function SocialProofBlock({ content }) {
  return (
    <s-stack direction="block" gap="small">
      {content.heading && <s-text type="strong">{content.heading}</s-text>}
      {content.body && <s-text color="subdued">{content.body}</s-text>}
    </s-stack>
  );
}

// ---------------------------------------------------------------------------
// TRUST_BADGES_WITH_REVIEWS — combined block
//
// Layout:
//   ┌──────────────────────────────────────────┐
//   │  [badge 1]    [badge 2]    [badge 3]     │  ← 3 badges, equal columns
//   ├──────────────────────────────────────────┤
//   │  [review] [review] [review] →scroll→     │  ← horizontal carousel
//   └──────────────────────────────────────────┘
//
// content shape:
//   {
//     type: "TRUST_BADGES_WITH_REVIEWS",
//     heading?: string,              // optional section title
//     badges: Array<{
//       iconUrl:    string,          // image URL
//       label:      string,          // main text (e.g. "Secure Checkout")
//       sublabel?:  string,          // secondary line (e.g. "256-bit SSL")
//       alt?:       string,          // img alt, defaults to label
//     }>,
//     reviews: Array<{
//       quote:   string,
//       name:    string,
//       rating?: number,             // 1–5, default 5
//       label?:  string,             // e.g. "Verified Buyer"
//     }>,
//   }
// ---------------------------------------------------------------------------

function TrustBadgesWithReviewsBlock({ content }) {
  const badges = content.badges ?? [];
  const reviews = content.reviews ?? [];

  return (
    <s-stack direction="block" gap="base">

      {/* Optional section heading */}
      {content.heading && (
        <s-text type="strong" alignment="center">{content.heading}</s-text>
      )}

      {/* ── Row 1: Trust badges ── */}
      {badges.length > 0 && (
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small">
          {badges.slice(0, 3).map((badge, i) => (
            <CombinedBadge
              key={badge.label ?? i}
              iconUrl={badge.iconUrl}
              label={badge.label}
              sublabel={badge.sublabel}
              alt={badge.alt ?? badge.label}
            />
          ))}
        </s-grid>
      )}

      {/* Divider between sections */}
      {badges.length > 0 && reviews.length > 0 && <s-divider />}

      {/* ── Row 2: Reviews carousel (horizontal scroll) ── */}
      {reviews.length > 0 && (
        <s-scroll-box overflow="hidden auto">
          {/* Fixed-pixel columns make each card the same width and force the
              grid to overflow the scroll container instead of wrapping. */}
          <s-grid gridTemplateColumns={reviews.map(() => "240px").join(" ")} gap="small">
            {reviews.map((review, i) => (
              <CombinedReviewCard
                key={review.name ?? i}
                quote={review.quote}
                name={review.name}
                rating={Math.min(5, Math.max(1, Number(review.rating ?? 5)))}
                label={review.label ?? "Verified Buyer"}
              />
            ))}
          </s-grid>
        </s-scroll-box>
      )}

    </s-stack>
  );
}

/**
 * Single trust badge with normalized image container.
 * Image box is clamped between 40px–72px on both axes so wildly
 * different icon sizes all render consistently side-by-side.
 */
function CombinedBadge({ iconUrl, label, sublabel, alt }) {
  return (
    <s-stack direction="block" gap="extra-small" alignItems="center">
      {/* Normalized image container — min 40px, max 72px */}
      <s-box
        minInlineSize="40px"
        maxInlineSize="72px"
        minBlockSize="40px"
        maxBlockSize="72px"
        overflow="hidden"
      >
        <s-image
          src={iconUrl}
          alt={alt ?? label}
          inlineSize="fill"
          blockSize="fill"
          fit="contain"
        />
      </s-box>
      <s-text type="small" alignment="center">{label}</s-text>
      {sublabel && (
        <s-text type="small" color="subdued" alignment="center">{sublabel}</s-text>
      )}
    </s-stack>
  );
}

/**
 * Single review card inside the horizontal carousel.
 * Fixed inlineSize keeps all cards the same width and triggers scroll.
 */
function CombinedReviewCard({ quote, name, rating, label }) {
  return (
    <s-stack
      direction="block"
      gap="small"
      border="base"
      borderRadius="base"
      padding="base"
      justifyContent="space-between"
    >
      {/* Stars */}
      <s-stack direction="inline" gap="extra-small">
        {Array.from({ length: 5 }).map((_, i) => (
          <s-text key={i} color={i < rating ? "default" : "subdued"}>★</s-text>
        ))}
      </s-stack>
      {/* Quote */}
      <s-text>"{quote}"</s-text>
      {/* Reviewer */}
      <s-stack direction="block" gap="none">
        <s-text type="strong">{name}</s-text>
        <s-text type="emphasis" color="subdued">{label}</s-text>
      </s-stack>
    </s-stack>
  );
}

function GuaranteeBlock({ content }) {
  return (
    <s-banner tone="success">
      <s-stack direction="block" gap="small-100">
        {content.heading && <s-text type="strong">{content.heading}</s-text>}
        <s-text>{content.body ?? content.guaranteeText ?? "100% satisfaction guaranteed or your money back."}</s-text>
      </s-stack>
    </s-banner>
  );
}

function ShippingMessageBlock({ content }) {
  return (
    <s-banner tone="info">
      <s-text>{content.body ?? "Free shipping on your order!"}</s-text>
    </s-banner>
  );
}

function UrgencyMessageBlock({ content }) {
  return (
    <s-banner tone="warning">
      <s-text type="strong">{content.urgencyText ?? content.body ?? "Limited time offer — don't miss out!"}</s-text>
    </s-banner>
  );
}

function PaymentIconsBlock({ content }) {
  return (
    <s-stack direction="block" gap="small">
      {content.heading && <s-text type="strong">{content.heading}</s-text>}
      <s-text color="subdued">{content.body ?? "Secure payment methods accepted"}</s-text>
    </s-stack>
  );
}

function CustomContentBlock({ content }) {
  return (
    <s-stack direction="block" gap="small">
      {content.heading && <s-text type="strong">{content.heading}</s-text>}
      {content.body && <s-text>{content.body}</s-text>}
      {content.buttonText && content.buttonUrl && (
        <s-button variant="secondary" to={content.buttonUrl}>
          {content.buttonText}
        </s-button>
      )}
    </s-stack>
  );
}

function ImageWithTextBlock({ content }) {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {content.imageUrl && (
        <s-image source={content.imageUrl} description={content.imageAlt ?? ""} />
      )}
      <s-stack direction="block" gap="small-100">
        {content.heading && <s-text type="strong">{content.heading}</s-text>}
        {content.body && <s-text>{content.body}</s-text>}
      </s-stack>
    </s-stack>
  );
}

function ProductUpsellBlock({ content, cartLines, applyCartLinesChange }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const variantId = content.variantId;
  if (!variantId) return null;

  const alreadyInCart = cartLines.some((l) => l.merchandise?.id === variantId);

  async function handleAdd() {
    if (adding || alreadyInCart || added) return;
    setAdding(true);
    try {
      await applyCartLinesChange({ type: "addCartLine", merchandiseId: variantId, quantity: 1 });
      setAdded(true);
    } catch (e) {
      console.error("ProductUpsell add error", e);
    }
    setAdding(false);
  }

  const label = added || alreadyInCart ? "Added ✓" : adding ? "Adding…" : (content.buttonText ?? "Add to order");

  return (
    <s-stack direction="block" gap="small">
      {content.heading && <s-text type="strong">{content.heading}</s-text>}
      {content.body && <s-text>{content.body}</s-text>}
      <s-button
        variant="secondary"
        disabled={adding || alreadyInCart || added}
        onClick={handleAdd}
      >
        {label}
      </s-button>
    </s-stack>
  );
}

function FreeShippingProgressBlock({ content, cartLines, currency }) {
  const threshold = content.threshold ?? 75;
  const subtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.cost?.totalAmount?.amount ?? 0),
    0
  );
  const remaining = threshold <= 0 ? 0 : Math.max(0, threshold - subtotal);
  const pct = threshold <= 0 ? 100 : Math.min(100, (subtotal / threshold) * 100);

  const message =
    remaining <= 0
      ? (content.successMessage ?? "You've unlocked free shipping!")
      : (content.message ?? "Add {remaining} more for free shipping!").replace(
          "{remaining}",
          `${currency} ${remaining.toFixed(2)}`
        );

  const totalDots = 10;
  const filledDots = Math.round((pct / 100) * totalDots);

  return (
    <s-stack direction="block" gap="small">
      <s-text>{message}</s-text>
      <s-stack direction="inline" gap="extra-small" alignItems="center">
        {Array.from({ length: totalDots }).map((_, i) => (
          <s-box
            key={i}
            background={i < filledDots ? (pct >= 100 ? "success" : "accent") : "subdued"}
            borderRadius="base"
            minBlockSize={6}
            minInlineSize={24}
          />
        ))}
      </s-stack>
    </s-stack>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAssignment(attrs) {
  const expAttr = attrs?.find?.((a) => a.key?.startsWith("_ml_exp_"));
  if (!expAttr) return null;
  return {
    experimentId: expAttr.key.replace("_ml_exp_", ""),
    variantKey: expAttr.value,
  };
}

async function fetchBlockContent(apiBase, assignment, shopDomain) {
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
    const data = await res.json();
    if (!data.block) return null;
    return { ...data.block.content, type: data.block.type };
  } catch {
    return null;
  }
}
