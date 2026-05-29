import "@shopify/ui-extensions/preact";
import { useState, useEffect } from "preact/hooks";
import { TrustBadgeList } from "./components/TrustBadgeList.jsx";
import { ReviewList } from "./components/ReviewList.jsx";

const DEFAULT_BADGES = [
  { id: "guarantee", line1: "30-Day Money", line2: "Back Guarantee*", iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_cftpjb.webp?v=1778721307", accessibilityLabel: "30-Day Money Back Guarantee" },
  { id: "shipping",  line1: "Fast",          line2: "Shipping",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_1_vfx39d.webp?v=1778721307", accessibilityLabel: "Fast Shipping" },
  { id: "secure",    line1: "Safe & Secure", line2: "Checkout",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_2_dsnu9m.webp?v=1778721307", accessibilityLabel: "Safe and Secure Checkout" },
];

var APP_URL = "https://checkout-redo-engine.vercel.app";

export function MarginLabBlock() {
  var appUrl = APP_URL;
  const shopDomain = (() => { try { return shopify.shop?.myshopifyDomain ?? ""; } catch (_) { return ""; } })();

  const [content, setContent] = useState(/** @type {{ badges?: any[], reviews?: any[] } | null} */ (null));

  useEffect(() => {
    if (!appUrl) return;
    let cancelled = false;

    // Read cart attributes to find ML experiment assignment
    // shopify.attributes is available in checkout extension context
    const attrs = (() => {
      try {
        const raw = shopify.attributes?.current ?? shopify.checkout?.attributes ?? {};
        return /** @type {Record<string, string>} */ (raw);
      } catch (_) { return {}; }
    })();

    const expAttrKey = Object.keys(attrs).find((k) => k.startsWith("_ml_exp_"));
    const variantKey = expAttrKey ? attrs[expAttrKey] : null;
    const experimentShortId = expAttrKey ? expAttrKey.replace("_ml_exp_", "") : null;

    // If we have an assignment from the storefront, fetch the block directly
    if (experimentShortId && variantKey) {
      fetch(`${appUrl}/api/runtime/checkout-blocks?experimentId=${experimentShortId}&variantKey=${variantKey}`, {
        headers: { "X-Shop-Domain": shopDomain },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((/** @type {any} */ data) => {
          if (cancelled || !data?.block?.content) return;
          setContent(data.block.content);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }

    // Fallback: fetch full config and assign variant based on ML session key
    const ML_SESSION_KEY = String(Math.random());
    fetch(`${appUrl}/api/runtime/config`, {
      headers: { "X-Shop-Domain": shopDomain },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((/** @type {any} */ config) => {
        if (cancelled || !config) return;
        const experiment = (config.experiments ?? []).find(
          (/** @type {any} */ e) => e.status === "RUNNING" && e.type === "CHECKOUT_TEST"
        );
        if (!experiment?.variants?.length) return;

        // Use same djb2 hash as checkout-trust-social-proof for consistent assignment
        const str = ML_SESSION_KEY;
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
        const variantIdx = Math.abs(h) % experiment.variants.length;
        const variant = experiment.variants[variantIdx];
        if (!variant?.checkoutBlockIds?.length) return;

        fetch(`${appUrl}/api/runtime/checkout-blocks?experimentId=${experiment.id.slice(0, 8)}&variantKey=${variant.key}`, {
          headers: { "X-Shop-Domain": shopDomain },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((/** @type {any} */ data) => {
            if (cancelled || !data?.block?.content) return;
            setContent(data.block.content);
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // Build badges — from ML content or defaults
  const badges = content?.badges?.length
    ? content.badges.map((b, i) => ({
        id: b.id ?? `badge-${i}`,
        line1: b.label ?? b.line1 ?? "",
        line2: b.sublabel ?? b.line2 ?? "",
        iconSource: b.iconUrl ?? b.iconSource ?? "",
        accessibilityLabel: b.alt ?? b.label ?? "",
      }))
    : DEFAULT_BADGES;

  // Build reviews — from ML content or empty
  const reviews = (content?.reviews ?? []).map((r, i) => ({
    id: r.id ?? `review-${i}`,
    quote: r.quote ?? "",
    name: r.name ?? "",
    label: r.label ?? "Verified Buyer",
    rating: Math.min(5, Math.max(1, Number(r.rating ?? 5))),
  }));

  return (
    <s-box paddingBlock="base" paddingInline="none">
      <s-stack direction="block" gap="base">
        <TrustBadgeList badges={badges} />
        {reviews.length > 0 && (
          <>
            <s-divider />
            <ReviewList reviews={reviews} />
          </>
        )}
      </s-stack>
    </s-box>
  );
}
