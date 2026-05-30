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

interface CheckoutBlockData {
  id: string;
  type: string;
  content: BlockContent;
}

interface Config {
  experiments?: Experiment[];
  checkoutBlocks?: CheckoutBlockData[];
}

const DEFAULT_REVIEWS: Review[] = [
  { id: "review-1", quote: "The ability to lift more while on it, is not joke. I won't ever take anything else. I'm currently on my wellness and gym journey - after a few failed ventures- I wish I had OneSol creatine during that time because I believe it would've given me the assistance I needed back then.", name: "Annika H.", label: "Verified Buyer", rating: 5 },
  { id: "review-2", quote: "Love drinking this creatine. I have never liked creatine before I tried this product. I don't feel like I'm drinking creatine when I'm drinking this product. The taste is so much better than all the other products I've tried previously.", name: "P.J.", label: "Verified Buyer", rating: 5 },
  { id: "review-3", quote: "It tastes sooooo good. I was using the unflavored one and was satisfied at the fact that it didn't leave any after taste, but this one, it's so delicious.", name: "Shakerra", label: "Verified Buyer", rating: 5 },
];

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
    // shopify.shop is a Preact signal — try .value/.current before direct access
    let shopDomain = "";
    try {
      const shop = shopify.shop as unknown as { value?: { myshopifyDomain?: string }; current?: { myshopifyDomain?: string }; myshopifyDomain?: string };
      shopDomain = shop?.value?.myshopifyDomain
        ?? shop?.current?.myshopifyDomain
        ?? shop?.myshopifyDomain
        ?? "";
    } catch (_) {}


    function xhrFetch(url: string, cb: (data: unknown) => void): void {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("X-Shop-Domain", shopDomain);
        xhr.onload = () => {
          try { cb(xhr.status >= 200 && xhr.status < 300 ? JSON.parse(xhr.responseText) : null); }
          catch (_) { cb(null); }
        };
        xhr.onerror = () => cb(null);
        xhr.ontimeout = () => cb(null);
        xhr.timeout = 8000;
        xhr.send();
      } catch (_) { cb(null); }
    }

    function mlFetch(url: string, cb: (data: unknown) => void): void {
      // Try fetch first; fall back to XHR if fetch is unavailable or fails
      let fetchAttempted = false;
      try {
        if (typeof fetch === "function") {
          fetchAttempted = true;
          fetch(url, { headers: { "X-Shop-Domain": shopDomain } })
            .then((r) => (r.ok ? r.json() : null))
            .then(cb)
            .catch(() => xhrFetch(url, cb)); // on fetch rejection → XHR
          return;
        }
      } catch (_) {}
      if (!fetchAttempted) xhrFetch(url, cb);
    }

    // djb2 hash for consistent 50/50 assignment when cart attrs unavailable
    const sessionKey = String(Math.random());
    function hashToIndex(str: string, n: number): number {
      if (!str || n <= 1) return 0;
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
      return Math.abs(h) % n;
    }

    mlFetch(`${APP_URL}/api/runtime/config?shop=${encodeURIComponent(shopDomain)}`, (raw) => {
      if (cancelled) return;
      const config = raw as Config | null;
      if (!config?.experiments?.length) return;

      const experiment = config.experiments.find(
        (e) => e.status === "RUNNING" && e.type === "CHECKOUT_TEST"
      );
      if (!experiment?.variants?.length) return;

      // Try cart attributes first (storefront assignment = most accurate)
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

      // Fallback: consistent hash for this session (same split as storefront)
      if (!assignedVariant) {
        const idx = hashToIndex(sessionKey, experiment.variants.length);
        assignedVariant = experiment.variants[idx];
      }

      // Control = show nothing
      if (!assignedVariant || assignedVariant.isControl) return;

      // Variant with block IDs = find block directly in config.checkoutBlocks
      const targetVariant = assignedVariant;
      if (!targetVariant.checkoutBlockIds?.length) return;

      const block = (config.checkoutBlocks ?? []).find(
        (b) => targetVariant.checkoutBlockIds!.includes(b.id)
      );
      if (!cancelled && block?.content) {
        setContent(block.content);
      }
    });

    return () => { cancelled = true; };
  }, []);

  // No content = control group (or config not yet loaded) → show debug then nothing
  if (!content) return null;

  const badges: Badge[] = content.badges?.length
    ? content.badges.map((b, i) => ({
        id: b.id ?? `b${i}`,
        line1: b.label ?? b.line1 ?? "",
        line2: b.sublabel ?? b.line2 ?? "",
        iconSource: b.iconUrl ?? b.iconSource ?? "",
        accessibilityLabel: b.alt ?? b.label ?? "",
      }))
    : DEFAULT_BADGES;

  const reviews: Review[] = content.reviews?.length
    ? content.reviews.map((r, i) => ({
        id: r.id ?? `r${i}`,
        quote: r.quote ?? "",
        name: r.name ?? "",
        label: r.label ?? "Verified Buyer",
        rating: Math.min(5, Math.max(1, Number(r.rating ?? 5))),
      }))
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
