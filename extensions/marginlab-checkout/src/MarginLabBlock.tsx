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

const DEFAULT_REVIEWS = [
  { id: "r1", quote: "The ability to lift more while on it, is not joke. I'm currently on my wellness and gym journey.", name: "Annika H.", label: "Verified Buyer", rating: 5 },
  { id: "r2", quote: "Love drinking this creatine. The taste is so much better than all the other products I've tried.", name: "P.J.", label: "Verified Buyer", rating: 5 },
  { id: "r3", quote: "It tastes sooooo good. I was satisfied at the fact that it didn't leave any after taste.", name: "Shakerra", label: "Verified Buyer", rating: 5 },
];

export function MarginLabBlock() {
  const attributes = useAttributes();
  const shop = useShop();
  const [content, setContent] = useState(null);
  const [hidden, setHidden] = useState(false);

  const shopDomain = shop?.myshopifyDomain ?? "";
  // Read block_id from extension settings (set per-instance in checkout editor)
  const configuredBlockId = String(shopify.settings?.current?.block_id ?? "").trim();

  useEffect(function() {
    if (!shopDomain) return;
    let cancelled = false;

    function mlFetch(url, cb) {
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

      const allBlocks = config.checkoutBlocks || [];
      if (!allBlocks.length) return;

      // Find the target block:
      // 1. If block_id is configured → use that specific block
      // 2. Otherwise → use the first available block
      const targetBlock = configuredBlockId
        ? allBlocks.find(function(b) { return b.id === configuredBlockId; })
        : allBlocks[0];

      if (!targetBlock || !targetBlock.content) return;

      // Check if this block is part of a running A/B test
      const runningTests = (config.experiments || []).filter(function(e) {
        return e.status === "RUNNING" && e.type === "CHECKOUT_TEST";
      });

      const testForBlock = runningTests.find(function(exp) {
        return exp.variants.some(function(v) {
          return v.checkoutBlockIds && v.checkoutBlockIds.includes(targetBlock.id);
        });
      });

      if (testForBlock) {
        // Block is in a test — check explicit cart attribute assignment
        const expAttr = attributes.find(function(a) {
          return a && a.key && a.key.startsWith("_ml_exp_");
        });

        if (expAttr) {
          const assigned = testForBlock.variants.find(function(v) { return v.key === expAttr.value; });
          if (assigned && assigned.isControl) {
            // Explicitly assigned to control → hide this block
            if (!cancelled) setHidden(true);
            return;
          }
          // Explicitly assigned to variant → show
        }
        // No explicit assignment (editor, new visitor without storefront attribution) → show by default
      }

      if (!cancelled) {
        setContent(targetBlock.content);
        setHidden(false);
      }
    });

    return function() { cancelled = true; };
  }, [shopDomain, configuredBlockId, JSON.stringify(attributes)]);

  // DEBUG: always render visible state info
  const debugLine = "ML| domain:" + (shopDomain || "EMPTY") + " | blockId:" + (configuredBlockId || "none") + " | content:" + (content ? "OK" : "null") + " | hidden:" + hidden;
  if (!content || hidden) {
    return <s-text>{debugLine}</s-text>;
  }

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
