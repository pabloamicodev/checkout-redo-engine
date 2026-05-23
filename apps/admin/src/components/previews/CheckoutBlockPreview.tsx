"use client";

import { cn } from "@/lib/utils";

type BlockType =
  | "trust_badges"
  | "guarantee"
  | "shipping_message"
  | "payment_icons"
  | "urgency"
  | "custom_text"
  | string;

interface CheckoutBlockPreviewProps {
  blockType?: BlockType;
  content?: {
    text?: string;
    headline?: string;
    items?: string[];
  };
  className?: string;
}

const TRUST_BADGES = ["🔒 Secure Checkout", "✅ Verified Store", "🏅 Trusted by 10k+"];
const PAYMENT_ICONS = ["💳 Visa", "💳 Mastercard", "🅿 PayPal", "🍎 Apple Pay"];

function TrustBadges({ items }: { items?: string[] }) {
  const badges = items ?? TRUST_BADGES;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {badges.map((b, i) => (
        <span key={i} className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 font-medium">
          {b}
        </span>
      ))}
    </div>
  );
}

function GuaranteeBlock({ text }: { text?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl">🛡️</span>
      <div>
        <p className="text-sm font-semibold text-neutral-700">Satisfaction Guarantee</p>
        <p className="text-xs text-neutral-500 mt-0.5">{text ?? "Not satisfied? Get a full refund within 30 days — no questions asked."}</p>
      </div>
    </div>
  );
}

function ShippingMessage({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">🚚</span>
      <p className="text-sm text-neutral-700 font-medium">{text ?? "Free shipping on orders over $50"}</p>
    </div>
  );
}

function PaymentIcons({ items }: { items?: string[] }) {
  const icons = items ?? PAYMENT_ICONS;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {icons.map((icon, i) => (
        <span key={i} className="text-[11px] bg-neutral-100 border border-neutral-200 rounded px-2 py-1 text-neutral-600">{icon}</span>
      ))}
    </div>
  );
}

function UrgencyBlock({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <span className="text-lg">⏰</span>
      <p className="text-xs font-semibold text-amber-700">{text ?? "Only 3 left in stock — order soon!"}</p>
    </div>
  );
}

function CustomText({ headline, text }: { headline?: string; text?: string }) {
  return (
    <div className="text-center space-y-1">
      {headline && <p className="text-sm font-semibold text-neutral-800">{headline}</p>}
      {text && <p className="text-xs text-neutral-500">{text}</p>}
    </div>
  );
}

export function CheckoutBlockPreview({ blockType = "trust_badges", content, className }: CheckoutBlockPreviewProps) {
  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Checkout Block Preview</span>
      </div>

      {/* Simulated checkout UI */}
      <div className="p-4">
        {/* Fake checkout wrapper */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-5 space-y-3">
          {/* Fake order summary line */}
          <div className="flex justify-between items-center text-xs text-neutral-400 border-b border-neutral-200 pb-3">
            <span>Order Summary</span>
            <span>$49.99</span>
          </div>

          {/* Block preview */}
          <div>
            {blockType === "trust_badges" && <TrustBadges items={content?.items} />}
            {blockType === "guarantee" && <GuaranteeBlock text={content?.text} />}
            {blockType === "shipping_message" && <ShippingMessage text={content?.text} />}
            {blockType === "payment_icons" && <PaymentIcons items={content?.items} />}
            {blockType === "urgency" && <UrgencyBlock text={content?.text} />}
            {(blockType === "custom_text" || !["trust_badges","guarantee","shipping_message","payment_icons","urgency"].includes(blockType)) && (
              <CustomText headline={content?.headline} text={content?.text} />
            )}
          </div>

          {/* Fake pay button */}
          <div className="pt-2">
            <div className="w-full h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-semibold">Pay now</span>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-neutral-400 text-center">Simulated checkout context</p>
      </div>
    </div>
  );
}
