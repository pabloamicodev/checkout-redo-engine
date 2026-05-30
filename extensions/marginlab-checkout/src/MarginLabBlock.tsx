// @ts-nocheck
import "@shopify/ui-extensions/preact";
import { useState, useEffect } from "preact/hooks";
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
  // Exact Shopify docs pattern — shopify.attributes.value and shopify.shop
  // are Preact signals, accessed directly in render for reactive subscriptions
  var attrs = shopify.attributes.value;          // per Shopify docs
  var shopDomain = shopify.shop.myshopifyDomain; // per Shopify docs

  var [content, setContent] = useState(null);
  var [hidden, setHidden] = useState(false);

  useEffect(function() {
    var cancelled = false;

    // Re-read inside effect to get latest value
    var domain = shopDomain;
    var configuredBlockId = "";
    try { configuredBlockId = String(shopify.settings?.current?.block_id ?? "").trim(); } catch(_) {}

    // No domain = editor or initial load without shop context → defaults render
    if (!domain) return;

    function mlFetch(url, cb) {
      try {
        if (typeof fetch === "function") {
          fetch(url, { headers: { "X-Shop-Domain": domain } })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(cb)
            .catch(function() { cb(null); });
          return;
        }
      } catch (_) {}
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("X-Shop-Domain", domain);
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

    mlFetch(APP_URL + "/api/runtime/config?shop=" + encodeURIComponent(domain), function(config) {
      if (cancelled || !config) return;

      var allBlocks = config.checkoutBlocks || [];
      if (!allBlocks.length) return;

      var targetBlock = configuredBlockId
        ? allBlocks.find(function(b) { return b.id === configuredBlockId; })
        : allBlocks[0];

      if (!targetBlock || !targetBlock.content) return;

      // Check A/B assignment only if block is part of a running test
      var runningTests = (config.experiments || []).filter(function(e) {
        return e.status === "RUNNING" && e.type === "CHECKOUT_TEST";
      });

      var testForBlock = runningTests.find(function(exp) {
        return exp.variants.some(function(v) {
          return v.checkoutBlockIds && v.checkoutBlockIds.includes(targetBlock.id);
        });
      });

      if (testForBlock) {
        // Read explicit assignment from cart attributes (reactive signal value)
        var expAttr = attrs.find(function(a) {
          return a && a.key && a.key.startsWith("_ml_exp_");
        });
        if (expAttr) {
          var assigned = testForBlock.variants.find(function(v) { return v.key === expAttr.value; });
          if (assigned && assigned.isControl) {
            if (!cancelled) setHidden(true);
            return;
          }
        }
        // No explicit assignment → show by default
      }

      if (!cancelled) {
        setContent(targetBlock.content);
        setHidden(false);
      }
    });

    return function() { cancelled = true; };
  }, [shopDomain, JSON.stringify(attrs)]); // re-run when domain or attributes change

  if (hidden) return null;

  var badges = (content && content.badges && content.badges.length)
    ? content.badges.map(function(b, i) {
        return { id: b.id || ("b" + i), line1: b.label || b.line1 || "", line2: b.sublabel || b.line2 || "", iconSource: b.iconUrl || b.iconSource || "", accessibilityLabel: b.alt || b.label || "" };
      })
    : DEFAULT_BADGES;

  var reviews = (content && content.reviews && content.reviews.length)
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
