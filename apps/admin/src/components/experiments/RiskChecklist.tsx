"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TestType =
  | "PRICE_TEST"
  | "DISCOUNT_TEST"
  | "SHIPPING_TEST"
  | "CONTENT_TEST"
  | "SPLIT_URL_TEST"
  | "OFFER_TEST"
  | "CHECKOUT_TEST";

const RISK_ITEMS: Record<TestType, string[]> = {
  PRICE_TEST: [
    "I have reviewed the price changes for each variant",
    "Prices are within expected competitive range (< 50% delta)",
    "I understand prices will be visible to ALL visitors, not just test cohort",
    "A price rollback plan is in place",
    "COGS data is up to date for accurate profit calculations",
  ],
  DISCOUNT_TEST: [
    "Discount stacking rules are configured correctly",
    "The Shopify Function is deployed and active",
    "Discount values are non-zero and within expected range",
    "I have reviewed potential margin impact",
  ],
  SHIPPING_TEST: [
    "Shipping threshold is correctly set for target AOV",
    "Delivery customization function is active",
    "Test does not conflict with existing shipping promotions",
  ],
  CONTENT_TEST: [
    "Test hypothesis is clearly defined",
    "Traffic allocation sums to 100%",
    "All variants have distinct configurations",
    "Analytics tracking is verified",
  ],
  SPLIT_URL_TEST: [
    "Test hypothesis is clearly defined",
    "Traffic allocation sums to 100%",
    "All variants have distinct configurations",
    "Analytics tracking is verified",
  ],
  OFFER_TEST: [
    "Test hypothesis is clearly defined",
    "Traffic allocation sums to 100%",
    "All variants have distinct configurations",
    "Analytics tracking is verified",
  ],
  CHECKOUT_TEST: [
    "Test hypothesis is clearly defined",
    "Traffic allocation sums to 100%",
    "All variants have distinct configurations",
    "Analytics tracking is verified",
  ],
};

interface RiskChecklistProps {
  type: TestType;
  onComplete: (allPassed: boolean) => void;
  className?: string;
}

export function RiskChecklist({ type, onComplete, className }: RiskChecklistProps) {
  const items: string[] = RISK_ITEMS[type] ?? [];
  const [checked, setChecked] = useState<boolean[]>(() =>
    new Array(items.length).fill(false) as boolean[]
  );

  function handleChange(index: number, value: boolean) {
    const next = checked.map((v, i) => (i === index ? value : v));
    setChecked(next);
    onComplete(next.every(Boolean));
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        const isChecked = checked[index] ?? false;
        return (
          <label
            key={index}
            className="flex items-start gap-2.5 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleChange(index, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
            />
            <span
              className={cn(
                "text-sm transition-colors",
                isChecked
                  ? "text-neutral-400 line-through"
                  : "text-neutral-700 group-hover:text-neutral-900"
              )}
            >
              {item}
            </span>
          </label>
        );
      })}
    </div>
  );
}
