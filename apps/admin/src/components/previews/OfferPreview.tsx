"use client";

import { cn } from "@/lib/utils";

type OfferType =
  | "free_gift"
  | "volume_discount"
  | "bxgy"
  | "spend_more_save"
  | "bundle"
  | "upsell"
  | string;

interface OfferPreviewProps {
  offerType?: OfferType;
  headline?: string;
  description?: string;
  ctaLabel?: string;
  badgeLabel?: string;
  className?: string;
}

const OFFER_DEFAULTS: Record<string, { icon: string; headline: string; description: string; cta: string; badge: string }> = {
  free_gift: {
    icon: "🎁",
    headline: "Free gift with your order!",
    description: "Add $25 more to unlock a free sample kit.",
    cta: "Add to cart",
    badge: "FREE GIFT",
  },
  volume_discount: {
    icon: "📦",
    headline: "Buy more, save more",
    description: "Buy 2 get 10% off • Buy 3 get 20% off • Buy 4+ get 30% off",
    cta: "Shop now",
    badge: "VOLUME DEAL",
  },
  bxgy: {
    icon: "🛒",
    headline: "Buy 2, Get 1 Free",
    description: "Mix & match any 3 items and the cheapest is free.",
    cta: "Claim offer",
    badge: "BXGY",
  },
  spend_more_save: {
    icon: "💰",
    headline: "Spend $75+ and save 15%",
    description: "Discount applied automatically at checkout.",
    cta: "Keep shopping",
    badge: "SAVE 15%",
  },
  bundle: {
    icon: "🧺",
    headline: "Bundle & save",
    description: "Complete the set and get 25% off your entire order.",
    cta: "Build bundle",
    badge: "BUNDLE",
  },
  upsell: {
    icon: "⬆️",
    headline: "Upgrade your order",
    description: "Add the premium version for just $9 more.",
    cta: "Upgrade",
    badge: "UPGRADE",
  },
};

export function OfferPreview({
  offerType = "free_gift",
  headline,
  description,
  ctaLabel,
  badgeLabel,
  className,
}: OfferPreviewProps) {
  const defaults = OFFER_DEFAULTS[offerType] ?? OFFER_DEFAULTS.free_gift!;
  const icon = defaults.icon;
  const title = headline || defaults.headline;
  const desc = description || defaults.description;
  const cta = ctaLabel || defaults.cta;
  const badge = badgeLabel || defaults.badge;

  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Offer Preview</span>
      </div>

      <div className="p-4">
        {/* Simulated cart offer card */}
        <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
          {/* Badge strip */}
          <div className="bg-emerald-500 px-3 py-1 flex items-center gap-1.5">
            <span className="text-white text-[10px] font-bold tracking-widest">{badge}</span>
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-800 leading-tight">{title}</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>

            <button className="w-full h-8 rounded-md bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center">
              <span className="text-white text-xs font-semibold">{cta}</span>
            </button>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-neutral-400 text-center">Simulated cart offer widget</p>
      </div>
    </div>
  );
}
