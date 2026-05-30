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

export function MarginLabBlock() {
  var [content, setContent] = useState(null);

  useEffect(function() {
    var cancelled = false;
    var shopDomain = "";
    try { shopDomain = shopify.shop?.myshopifyDomain ?? ""; } catch(_) {}

    function mlFetch(url, headers, cb) {
      // Try native fetch first, fall back to XHR
      try {
        if (typeof fetch === "function") {
          fetch(url, { headers: headers })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(cb)
            .catch(function() { cb(null); });
          return;
        }
      } catch(_) {}
      // XHR fallback
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        Object.keys(headers).forEach(function(k) { xhr.setRequestHeader(k, headers[k]); });
        xhr.onload = function() {
          try { cb(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null); }
          catch(_) { cb(null); }
        };
        xhr.onerror = function() { cb(null); };
        xhr.send();
      } catch(_) { cb(null); }
    }

    var hdrs = { "X-Shop-Domain": shopDomain };

    mlFetch(APP_URL + "/api/runtime/config?shop=" + encodeURIComponent(shopDomain), hdrs, function(config) {
      if (cancelled || !config) return;

      var experiment = (config.experiments || []).find(function(e) {
        return e.status === "RUNNING" && e.type === "CHECKOUT_TEST";
      });
      if (!experiment || !experiment.variants || !experiment.variants.length) return;

      // Try cart attributes first to respect storefront assignment
      var assignedVariant = null;
      try {
        var attrsA = shopify.attributes?.value;
        var attrsB = shopify.attributes?.current;
        var attrs = Array.isArray(attrsA) ? attrsA : Array.isArray(attrsB) ? attrsB : [];
        var expAttr = attrs.find(function(a) { return a && a.key && a.key.startsWith("_ml_exp_"); });
        if (expAttr) {
          assignedVariant = experiment.variants.find(function(v) { return v.key === expAttr.value; });
        }
      } catch(_) {}

      // Fallback: pick first non-control variant with block IDs
      var targetVariant = assignedVariant || experiment.variants.find(function(v) {
        return !v.isControl && v.checkoutBlockIds && v.checkoutBlockIds.length > 0;
      });
      if (!targetVariant || !targetVariant.checkoutBlockIds || !targetVariant.checkoutBlockIds.length) return;

      mlFetch(
        APP_URL + "/api/runtime/checkout-blocks?experimentId=" + experiment.id.slice(0, 8) + "&variantKey=" + targetVariant.key,
        hdrs,
        function(data) {
          if (!cancelled && data && data.block && data.block.content) {
            setContent(data.block.content);
          }
        }
      );
    });

    return function() { cancelled = true; };
  }, []);

  var badges = (content && content.badges && content.badges.length)
    ? content.badges.map(function(b, i) {
        return {
          id: b.id || ("badge-" + i),
          line1: b.label || b.line1 || "",
          line2: b.sublabel || b.line2 || "",
          iconSource: b.iconUrl || b.iconSource || "",
          accessibilityLabel: b.alt || b.label || "",
        };
      })
    : DEFAULT_BADGES;

  var reviews = (content && content.reviews ? content.reviews : []).map(function(r, i) {
    return {
      id: r.id || ("review-" + i),
      quote: r.quote || "",
      name: r.name || "",
      label: r.label || "Verified Buyer",
      rating: Math.min(5, Math.max(1, Number(r.rating || 5))),
    };
  });

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
