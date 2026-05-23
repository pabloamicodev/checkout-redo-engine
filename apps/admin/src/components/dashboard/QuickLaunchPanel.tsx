"use client";

import Link from "next/link";
import { ArrowUpRight, Zap } from "lucide-react";
import { useState } from "react";

const QUICK_CREATE = [
  {
    label: "Pricing+",
    desc: "Test price points & margins",
    href: "/price-tests",
    color: "#d97706",
    glowColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  {
    label: "Shipping+",
    desc: "Free shipping thresholds",
    href: "/shipping-tests",
    color: "#0891b2",
    glowColor: "rgba(6, 182, 212, 0.12)",
    borderColor: "rgba(6, 182, 212, 0.25)",
  },
  {
    label: "Checkout",
    desc: "Improve checkout conversion",
    href: "/checkout-tests",
    color: "#4f46e5",
    glowColor: "rgba(99, 102, 241, 0.12)",
    borderColor: "rgba(99, 102, 241, 0.25)",
  },
  {
    label: "Content",
    desc: "Copy, images & messaging",
    href: "/content-tests",
    color: "#7c3aed",
    glowColor: "rgba(139, 92, 246, 0.12)",
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
  {
    label: "Offers",
    desc: "Discounts & promotions",
    href: "/offer-tests",
    color: "#059669",
    glowColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  {
    label: "Split URL",
    desc: "Landing page variants",
    href: "/split-url-tests",
    color: "#0284c7",
    glowColor: "rgba(14, 165, 233, 0.12)",
    borderColor: "rgba(14, 165, 233, 0.25)",
  },
];

function QuickCard({ card }: { card: (typeof QUICK_CREATE)[0] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={card.href}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150"
        style={{
          background: hovered ? card.glowColor : "transparent",
          border: `1px solid ${hovered ? card.borderColor : "transparent"}`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: card.color }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-semibold transition-colors"
            style={{ color: hovered ? "#1e293b" : "#475569" }}
          >
            {card.label}
          </p>
          <p className="text-[10px] text-neutral-400 truncate">{card.desc}</p>
        </div>
        <ArrowUpRight
          className="w-3 h-3 shrink-0 transition-colors"
          style={{ color: hovered ? "#94a3b8" : "#e2e8f0" }}
        />
      </div>
    </Link>
  );
}

export function QuickLaunchPanel() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-sm font-semibold text-neutral-800">Quick launch</span>
        </div>
      </div>
      <div className="p-3 space-y-1">
        {QUICK_CREATE.map((card) => (
          <QuickCard key={card.href} card={card} />
        ))}
      </div>
    </div>
  );
}
