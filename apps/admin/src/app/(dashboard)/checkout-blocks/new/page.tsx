import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CheckoutBlockWizard } from "@/components/checkout-blocks/CheckoutBlockWizard";


export const dynamic = 'force-dynamic';
export default function NewCheckoutBlockPage() {
  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div>
          <Link
            href="/checkout-blocks"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-3"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Checkout Blocks
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">New Checkout Block</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Create a content block to display inside the Shopify checkout</p>
        </div>
        <CheckoutBlockWizard />
      </div>
    </div>
  );
}
