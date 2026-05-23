import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ShippingTestWizard } from "@/components/shipping/ShippingTestWizard";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Create Shipping Test — MarginLab" };

export default function NewShippingTestPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-neutral-100 bg-white">
        <Link href="/shipping-tests" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Shipping Tests
        </Link>
      </div>
      <ShippingTestWizard />
    </div>
  );
}
