// @ts-nocheck
import "@shopify/ui-extensions/preact";
import { useState, useEffect } from "preact/hooks";
import { useAttributes, useShop } from "@shopify/ui-extensions/checkout/preact";
import { TrustBadgeList } from "./components/TrustBadgeList.jsx";
import { ReviewList } from "./components/ReviewList.jsx";

const APP_URL = "https://checkout-redo-engine.vercel.app";

const DEFAULT_BADGES = [
  { id: "guarantee", line1: "30-Day Money", line2: "Back Guarantee*", iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_cftpjb.webp?v=1778721307", accessibilityLabel: "30-Day Money Back Guarantee" },
  { id: "shipping",  line1: "Fast",          line2: "Shipping",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_1_vfx39d.webp?v=1778721307", accessibilityLabel: "Fast Shipping" },
  { id: "secure",    line1: "Safe & Secure",  line2: "Checkout",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_2_dsnu9m.webp?v=1778721307", accessibilityLabel: "Safe and Secure Checkout" },
];

interface ContentBadge { id?: string; label?: string; line1?: string; sublabel?: string; line2?: string; iconUrl?: string; iconSource?: string; alt?: string }
interface ContentReview { id?: string; quote?: string; name?: string; label?: string; rating?: number }
interface BlockContent { badges?: ContentBadge[]; reviews?: ContentReview[] }

const DEFAULT_REVIEWS = [
  { id: "review-1", quote: "The ability to lift more while on it, is not joke. I won't ever take anything else. I'm currently on my wellness and gym journey.", name: "Annika H.", label: "Verified Buyer", rating: 5 },
  { id: "review-2", quote: "Love drinking this creatine. The taste is so much better than all the other products I've tried previously.", name: "P.J.", label: "Verified Buyer", rating: 5 },
  { id: "review-3", quote: "It tastes sooooo good. I was using the unflavored one and was satisfied at the fact that it didn't leave any after taste.", name: "Shakerra", label: "Verified Buyer", rating: 5 },
];

export function MarginLabBlock() {
  // useAttributes() reads checkout cart attributes — this is the correct Preact hook
  const attributes = useAttributes();
  const shop = useShop();
  const [content, setContent] = useState<BlockContent | null>(null);

  const shopDomain = shop?.myshopifyDomain ?? "";

  useEffect(function() {
    if (!shopDomain) return;
    let cancelled = false;

    function mlFetch(url: string, cb: (data: unknown) => void) {
      try {
        if (typeof fetch === "function") {
          fetch(url, { headers: { "X-Shop-Domain": shopDomain } })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(cb)
            .catch(function() { cb(null); });
          return;
        }
      } catch (_) {}
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("X-Shop-Domain", shopDomain);
        xhr.onload = function() {
          try { cb(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null); }
          catch (_) { cb(null); }
        };
        xhr.onerror = function() { cb(null); };
        xhr.ontimeout = function() { cb(null); };
        xhr.timeout = 8000;
        xhr.send();
      } catch (_) { cb(null); }
    }

    mlFetch(APP_URL + "/api/runtime/config?shop=" + encodeURIComponent(shopDomain), function(config) {
      if (cancelled || !config) return;

      const experiment = (config.experiments || []).find(function(e) {
        return e.status === "RUNNING" && e.type === "CHECKOUT_TEST";
      });
      if (!experiment || !experiment.variants || !experiment.variants.length) return;

      // Primary: use useAttributes() hook — reads actual checkout cart attributes
      let assignedVariant = null;
      const expAttr = attributes.find(function(a) { return a && a.key && a.key.startsWith("_ml_exp_"); });
      if (expAttr) {
        assignedVariant = experiment.variants.find(function(v) { return v.key === expAttr.value; });
      }

      // Fallback: consistent hash using shopDomain (NOT random — same result every checkout)
      if (!assignedVariant) {
        let h = 5381;
        const seed = shopDomain + experiment.id;
        for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
        const idx = Math.abs(h) % experiment.variants.length;
        assignedVariant = experiment.variants[idx];
      }

      // Control = show nothing
      if (!assignedVariant || assignedVariant.isControl) return;

      // Find block in config.checkoutBlocks (single API call)
      const block = (config.checkoutBlocks || []).find(function(b) {
        return assignedVariant.checkoutBlockIds && assignedVariant.checkoutBlockIds.includes(b.id);
      });
      if (!cancelled && block && block.content) {
        setContent(block.content);
      }
    });

    return function() { cancelled = true; };
  }, [shopDomain, JSON.stringify(attributes)]);

  // Control group or pre-load = nothing
  if (!content) return null;

  const badges = (content.badges && content.badges.length)
    ? content.badges.map(function(b, i) {
        return { id: b.id || ("b" + i), line1: b.label || b.line1 || "", line2: b.sublabel || b.line2 || "", iconSource: b.iconUrl || b.iconSource || "", accessibilityLabel: b.alt || b.label || "" };
      })
    : DEFAULT_BADGES;

  const reviews = (content.reviews && content.reviews.length)
    ? content.reviews.map(function(r, i) {
        return { id: r.id || ("r" + i), quote: r.quote || "", name: r.name || "", label: r.label || "Verified Buyer", rating: Math.min(5, Math.max(1, Number(r.rating || 5))) };
      })
    : DEFAULT_REVIEWS;

  return (
    <s-box paddingBlock="base" paddingInline="none">
      <s-stack direction="block" gap="base">
        <TrustBadgeList badges={badges} />
        {reviews.length > 0 && (
          <s-stack direction="block" gap="base">
            <s-divider />
            <ReviewList reviews={reviews} />
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
