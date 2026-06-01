// @ts-nocheck
import "@shopify/ui-extensions/preact";
import { useState, useEffect } from "preact/hooks";
import { TrustBadgeList } from "./components/TrustBadgeList.jsx";
import { ReviewList } from "./components/ReviewList.jsx";

var APP_URL = "https://checkout-redo-engine.vercel.app";

var DEFAULT_BADGES = [
  { id: "guarantee", line1: "30-Day Money", line2: "Back Guarantee*", iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_cftpjb.webp?v=1778721307", accessibilityLabel: "30-Day Money Back Guarantee" },
  { id: "shipping",  line1: "Fast",         line2: "Shipping",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_1_vfx39d.webp?v=1778721307", accessibilityLabel: "Fast Shipping" },
  { id: "secure",    line1: "Safe & Secure",line2: "Checkout",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_2_dsnu9m.webp?v=1778721307", accessibilityLabel: "Safe and Secure Checkout" },
];

var DEFAULT_REVIEWS = [
  { id: "r1", quote: "The ability to lift more while on it, is not joke. I'm currently on my wellness and gym journey.", name: "Annika H.", label: "Verified Buyer", rating: 5 },
  { id: "r2", quote: "Love drinking this creatine. The taste is so much better than all the other products I've tried.", name: "P.J.", label: "Verified Buyer", rating: 5 },
  { id: "r3", quote: "It tastes sooooo good. I was satisfied at the fact that it didn't leave any after taste.", name: "Shakerra", label: "Verified Buyer", rating: 5 },
];

export function MarginLabBlock() {
  // attrs in body = reactive signal subscription (re-runs effect when cart attrs change)
  var attrs = shopify.attributes.value ?? [];

  var [content, setContent] = useState(null);
  var [hidden, setHidden] = useState(false);
  var [dbgDomain, setDbgDomain] = useState("...");

  useEffect(function() {
    var cancelled = false;
    // shopDomain read INSIDE effect — same as trust-social-proof (populated at mount time)
    var domain = "";
    try { domain = shopify.shop?.myshopifyDomain ?? ""; } catch(_) {}
    setDbgDomain(domain || "EMPTY");

  /*   if (!domain) return;  */// editor without real shop context

    function mlFetch(url, cb) {
      try {
        if (typeof fetch === "function") {
          fetch(url, { headers: { "X-Shop-Domain": domain } })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(cb)
            .catch(function() { cb(null); });
          return;
        }
      } catch(_) {}
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("X-Shop-Domain", domain);
        xhr.onload = function() {
          try { cb(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null); }
          catch(_) { cb(null); }
        };
        xhr.onerror = function() { cb(null); };
        xhr.send();
      } catch(_) { cb(null); }
    }

    mlFetch(APP_URL + "/api/runtime/config?shop=" + encodeURIComponent(domain), function(config) {
      if (cancelled || !config) return;

      var experiment = (config.experiments || []).find(function(e) {
        return e.status === "RUNNING" && e.type === "CHECKOUT_TEST";
      });
      if (!experiment || !experiment.variants || !experiment.variants.length) return;

      // Match SPECIFIC experiment ID to avoid using old archived experiment's attribute
      var expKey = "_ml_exp_" + experiment.id.slice(0, 8);
      var expAttr = attrs.find(function(a) { return a && a.key === expKey; });
      var assignedVariant = expAttr
        ? experiment.variants.find(function(v) { return v.key === expAttr.value; })
        : null;

      // Explicitly assigned to control → hide
      if (assignedVariant && assignedVariant.isControl) {
        if (!cancelled) setHidden(true);
        return;
      }

      // Target: assigned non-control, or first non-control variant
      var targetVariant = assignedVariant || experiment.variants.find(function(v) {
        return !v.isControl;
      });
      if (!targetVariant) return;

      // Find block from config.checkoutBlocks using variantId (the reliable link).
      // variant.checkoutBlockIds[] is an optional denormalized cache that may be empty
      // even when the block exists — always prefer the direct variantId match first.
      var allBlocks = config.checkoutBlocks || [];
      var block = allBlocks.find(function(b) {
        return b.variantId === targetVariant.id;
      });

      // Fallback: match via the denormalized checkoutBlockIds array
      if (!block && targetVariant.checkoutBlockIds && targetVariant.checkoutBlockIds.length) {
        block = allBlocks.find(function(b) {
          return targetVariant.checkoutBlockIds.indexOf(b.id) !== -1;
        });
      }

      if (block && block.content && !cancelled) {
        setContent(block.content);
      }
    });

    return function() { cancelled = true; };
  }, [JSON.stringify(attrs)]); // re-run when cart attrs change

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

  var dbgAttrKey = attrs.find(function(a){ return a && a.key && a.key.startsWith("_ml_exp_"); });
  var dbgLine = "domain:" + dbgDomain
    + " | attrs:" + attrs.length
    + " | expAttr:" + (dbgAttrKey ? dbgAttrKey.key + "=" + dbgAttrKey.value : "none")
    + " | content:" + (content ? "ADMIN(badge0=" + (content.badges && content.badges[0] && content.badges[0].label) + ")" : "DEFAULT");

  return (
    <s-box paddingBlock="base" paddingInline="none">
      <s-stack direction="block" gap="base">
        <s-text>{dbgLine}</s-text>
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
