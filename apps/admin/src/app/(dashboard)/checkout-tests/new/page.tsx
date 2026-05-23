import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CheckoutTestWizard } from "@/components/checkout-tests/CheckoutTestWizard";

export const metadata = { title: "Create Checkout Test — MarginLab" };

export default function NewCheckoutTestPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-neutral-100 bg-white">
        <Link href="/checkout-tests" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Checkout Tests
        </Link>
      </div>
      <CheckoutTestWizard />
    </div>
  );
}
