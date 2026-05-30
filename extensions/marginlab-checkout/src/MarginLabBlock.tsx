import "@shopify/ui-extensions/preact";
import { useState, useEffect } from "preact/hooks";
import { TrustBadgeList } from "./components/TrustBadgeList.jsx";
import { ReviewList } from "./components/ReviewList.jsx";

const APP_URL = "https://checkout-redo-engine.vercel.app";

interface Badge {
  id: string;
  line1: string;
  line2: string;
  iconSource: string;
  accessibilityLabel: string;
}

interface Review {
  id: string;
  quote: string;
  name: string;
  label: string;
  rating: number;
}

interface BlockContent {
  badges?: Array<{ id?: string; label?: string; line1?: string; sublabel?: string; line2?: string; iconUrl?: string; iconSource?: string; alt?: string }>;
  reviews?: Array<{ id?: string; quote?: string; name?: string; label?: string; rating?: number }>;
}

interface Variant {
  key: string;
  isControl: boolean;
  checkoutBlockIds?: string[];
}

interface Experiment {
  id: string;
  status: string;
  type: string;
  variants: Variant[];
}

interface Config {
  experiments?: Experiment[];
}

const DEFAULT_BADGES: Badge[] = [
  { id: "guarantee", line1: "30-Day Money", line2: "Back Guarantee*", iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_cftpjb.webp?v=1778721307", accessibilityLabel: "30-Day Money Back Guarantee" },
  { id: "shipping",  line1: "Fast",         line2: "Shipping",        iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_1_vfx39d.webp?v=1778721307", accessibilityLabel: "Fast Shipping" },
  { id: "secure",    line1: "Safe & Secure", line2: "Checkout",       iconSource: "https://cdn.shopify.com/s/files/1/0600/5643/6975/files/icon-money-back-v2.svg_2_dsnu9m.webp?v=1778721307", accessibilityLabel: "Safe and Secure Checkout" },
];

declare const shopify: {
  shop?: { myshopifyDomain?: string };
  attributes?: { value?: Array<{ key: string; value: string }>; current?: Array<{ key: string; value: string }> };
};

export function MarginLabBlock() {
  const [content, setContent] = useState<BlockContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    let shopDomain = "";
    try { shopDomain = shopify.shop?.myshopifyDomain ?? ""; } catch (_) {}

    function mlFetch(url: string, cb: (data: unknown) => void): void {
      try {
        if (typeof fetch === "function") {
          fetch(url, { headers: { "X-Shop-Domain": shopDomain } })
            .then((r) => (r.ok ? r.json() : null))
            .then(cb)
            .catch(() => cb(null));
          return;
        }
      } catch (_) {}
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("X-Shop-Domain", shopDomain);
        xhr.onload = () => {
          try { cb(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null); }
          catch (_) { cb(null); }
        };
        xhr.onerror = () => cb(null);
        xhr.send();
      } catch (_) { cb(null); }
    }

    mlFetch(`${APP_URL}/api/runtime/config?shop=${encodeURIComponent(shopDomain)}`, (raw) => {
      if (cancelled) return;
      const config = raw as Config | null;
      if (!config?.experiments?.length) return;

      const experiment = config.experiments.find(
        (e) => e.status === "RUNNING" && e.type === "CHECKOUT_TEST"
      );
      if (!experiment?.variants?.length) return;

      let assignedVariant: Variant | undefined;
      try {
        const attrsA = shopify.attributes?.value;
        const attrsB = shopify.attributes?.current;
        const attrs = Array.isArray(attrsA) ? attrsA : Array.isArray(attrsB) ? attrsB : [];
        const expAttr = attrs.find((a) => a.key.startsWith("_ml_exp_"));
        if (expAttr) {
          assignedVariant = experiment.variants.find((v) => v.key === expAttr.value);
        }
      } catch (_) {}

      const targetVariant = assignedVariant ?? experiment.variants.find(
        (v) => !v.isControl && v.checkoutBlockIds && v.checkoutBlockIds.length > 0
      );
      if (!targetVariant?.checkoutBlockIds?.length) return;

      mlFetch(
        `${APP_URL}/api/runtime/checkout-blocks?experimentId=${experiment.id.slice(0, 8)}&variantKey=${targetVariant.key}`,
        (raw) => {
          const data = raw as { block?: { content?: BlockContent } } | null;
          if (!cancelled && data?.block?.content) {
            setContent(data.block.content);
          }
        }
      );
    });

    return () => { cancelled = true; };
  }, []);

  const badges: Badge[] = content?.badges?.length
    ? content.badges.map((b, i) => ({
        id: b.id ?? `b${i}`,
        line1: b.label ?? b.line1 ?? "",
        line2: b.sublabel ?? b.line2 ?? "",
        iconSource: b.iconUrl ?? b.iconSource ?? "",
        accessibilityLabel: b.alt ?? b.label ?? "",
      }))
    : DEFAULT_BADGES;

  const reviews: Review[] = (content?.reviews ?? []).map((r, i) => ({
    id: r.id ?? `r${i}`,
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
          <s-stack direction="block" gap="base">
            <s-divider />
            <ReviewList reviews={reviews} />
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
