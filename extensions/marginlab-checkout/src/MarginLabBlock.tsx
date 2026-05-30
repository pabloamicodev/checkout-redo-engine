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
  { id: "r1", quote: "The ability to lift more while on it, is not joke. I won't ever take anything else. I'm currently on my wellness and gym journey.", name: "Annika H.", label: "Verified Buyer", rating: 5 },
  { id: "r2", quote: "Love drinking this creatine. The taste is so much better than all the other products I've tried previously.", name: "P.J.", label: "Verified Buyer", rating: 5 },
  { id: "r3", quote: "It tastes sooooo good. I was using the unflavored one and was satisfied at the fact that it didn't leave any after taste.", name: "Shakerra", label: "Verified Buyer", rating: 5 },
];

export function MarginLabBlock() {
  const attributes = useAttributes();
  const shop = useShop();
  const [content, setContent] = useState(null);
  const [isControl, setIsControl] = useState(false);

  const shopDomain = shop?.myshopifyDomain ?? "";

  useEffect(function() {
    let cancelled = false;

    // Build URL — if no domain yet (editor), use empty string (API will use fallback)
    const domain = shopDomain || "";

    function mlFetch(url, cb) {
      try {
        if (typeof fetch === "function") {
          fetch(url, { headers: domain ? { "X-Shop-Domain": domain } : {} })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(cb)
            .catch(function() { cb(null); });
          return;
        }
      } catch (_) {}
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        if (domain) xhr.setRequestHeader("X-Shop-Domain", domain);
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

    const configUrl = domain
      ? APP_URL + "/api/runtime/config?shop=" + encodeURIComponent(domain)
      : null;

    if (!configUrl) return; // no domain = editor without shop context, skip

    mlFetch(configUrl, function(config) {
      if (cancelled || !config) return;

      const blocks = config.checkoutBlocks || [];
      if (!blocks.length) return;

      // Build a set of ALL block IDs that are in running A/B tests
      const testBlockIds = new Set();
      const runningTests = (config.experiments || []).filter(function(e) {
        return e.status === "RUNNING" && e.type === "CHECKOUT_TEST";
      });

      runningTests.forEach(function(exp) {
        (exp.variants || []).forEach(function(v) {
          (v.checkoutBlockIds || []).forEach(function(id) {
            testBlockIds.add(id);
          });
        });
      });

      // For each active block, decide if/how to show it
      for (const block of blocks) {
        const isInTest = testBlockIds.has(block.id);

        if (!isInTest) {
          // Standalone block (not in any test) → always show
          if (!cancelled && block.content) {
            setContent(block.content);
            setIsControl(false);
          }
          return;
        }

        // Block is in a test → find which experiment and check assignment
        const experiment = runningTests.find(function(exp) {
          return exp.variants.some(function(v) {
            return v.checkoutBlockIds && v.checkoutBlockIds.includes(block.id);
          });
        });
        if (!experiment) continue;

        // Read EXPLICIT assignment from cart attributes (set by storefront runtime)
        const expAttr = attributes.find(function(a) {
          return a && a.key && a.key.startsWith("_ml_exp_");
        });

        if (expAttr) {
          // Visitor has an explicit assignment from the storefront
          const assignedVariant = experiment.variants.find(function(v) { return v.key === expAttr.value; });
          if (assignedVariant && assignedVariant.isControl) {
            // Explicitly assigned to control → show nothing
            if (!cancelled) setIsControl(true);
            return;
          }
          // Explicitly assigned to variant → show the block
        }
        // No explicit assignment (editor, new visitor) → show the block by default

        if (!cancelled && block.content) {
          setContent(block.content);
          setIsControl(false);
        }
        return;
      }
    });

    return function() { cancelled = true; };
  }, [shopDomain, JSON.stringify(attributes)]);

  // Explicitly control group = show nothing
  if (isControl) return null;

  // No content yet (loading) = show nothing
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
