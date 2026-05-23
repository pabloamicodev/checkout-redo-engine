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

function Extension() {
  const { lines, attributes, settings, applyCartLinesChange, localization } = shopify;

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
    const apiBase = String(settings.current?.apiBase ?? "");
    if (!apiBase) { setLoading(false); return; }

    setLoading(true);
    fetchBlockContent(apiBase, assignment)
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
    case "TRUST_BADGES":       return <TrustBadgesBlock {...props} />;
    case "SOCIAL_PROOF":       return <SocialProofBlock {...props} />;
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

async function fetchBlockContent(apiBase, assignment) {
  try {
    const res = await fetch(
      `${apiBase}/api/runtime/checkout-blocks?experimentId=${assignment.experimentId}&variantKey=${assignment.variantKey}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.block) return null;
    return { ...data.block.content, type: data.block.type };
  } catch {
    return null;
  }
}
