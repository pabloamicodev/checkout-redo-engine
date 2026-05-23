"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";

interface TestType {
  key: string;
  label: string;
  desc: string;
  group: "content" | "profit";
  beta?: boolean;
  comingSoon?: boolean;
}

const TEST_TYPES: TestType[] = [
  { key: "CONTENT_TEST",       label: "Onsite Edit",    desc: "Edit or hide page elements like text, images, or sections without changing your theme.", group: "content" },
  { key: "SPLIT_URL_TEST",     label: "Split URL",       desc: "Send visitors to alternate URLs to test page-level changes.", group: "content" },
  { key: "TEMPLATE_TEST",      label: "Template",        desc: "Compare and test different homepage, product, and collections templates.", group: "content" },
  { key: "THEME_TEST",         label: "Theme",           desc: "Test theme redesigns, new navigation, or impact of adding an app.", group: "content" },
  { key: "OFFER_TEST",         label: "Offer",           desc: "Compare percentage discounts, dollar-off amounts, or tiered incentives.", group: "profit" },
  { key: "CHECKOUT_TEST",      label: "Checkout Test",   desc: "Try checkout customizations like trust badges, guarantees, and custom images.", group: "profit" },
  { key: "PRICE_TEST",         label: "Pricing+",        desc: "Test price points on one product, multiple products, or entire collections.", group: "profit" },
  { key: "SHIPPING_TEST",      label: "Shipping+",       desc: "Explore different shipping rates and free shipping thresholds.", group: "profit" },
  { key: "PERSONALIZATION_TEST", label: "Post-purchase", desc: "Test post-purchase experiences that appear after checkout is complete.", group: "profit", beta: true },
];

export function CreateTestModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  const handleContinue = () => {
    if (!selected) return;
    const type = TEST_TYPES.find((t) => t.key === selected);
    if (type?.comingSoon) return;
    setOpen(false);
    const typeMap: Record<string, string> = {
      PRICE_TEST:           "/price-tests/new",
      SHIPPING_TEST:        "/shipping-tests/new",
      OFFER_TEST:           "/offer-tests/new",
      CONTENT_TEST:         "/content-tests/new",
      CHECKOUT_TEST:        "/checkout-tests/new",
      SPLIT_URL_TEST:       "/split-url-tests/new",
      TEMPLATE_TEST:        "/template-tests/new",
      THEME_TEST:           "/theme-tests/new",
      PERSONALIZATION_TEST: "/personalization-tests/new",
    };
    router.push(typeMap[selected] ?? "/experiments/new");
  };

  const contentTypes = TEST_TYPES.filter((t) => t.group === "content");
  const profitTypes = TEST_TYPES.filter((t) => t.group === "profit");

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Create a new test</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Choose the type of test you want to run</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              {/* Content Tests */}
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                  Content Tests
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {contentTypes.map((t) => (
                    <TypeCard
                      key={t.key}
                      type={t}
                      selected={selected === t.key}
                      onClick={() => setSelected(t.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Profit Tests */}
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                  Profit Tests
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {profitTypes.map((t) => (
                    <TypeCard
                      key={t.key}
                      type={t}
                      selected={selected === t.key}
                      onClick={() => setSelected(t.key)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 font-medium rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={!selected}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TypeCard({
  type,
  selected,
  onClick,
}: {
  type: TestType;
  selected: boolean;
  onClick: () => void;
}) {
  const disabled = !!type.comingSoon;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-left p-3.5 rounded-xl border-2 transition-all relative ${
        disabled
          ? "border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60"
          : selected
            ? "border-brand-500 bg-brand-50"
            : "border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50"
      }`}
    >
      {selected && !disabled && (
        <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </span>
      )}
      {disabled && (
        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded-full">
          SOON
        </span>
      )}
      <p className="text-sm font-medium text-neutral-800 flex items-center gap-1.5">
        {type.label}
        {type.beta && !disabled && (
          <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded">BETA</span>
        )}
      </p>
      <p className="text-xs text-neutral-400 mt-0.5 leading-snug">{type.desc}</p>
    </button>
  );
}
