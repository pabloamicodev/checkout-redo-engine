import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OfferTestWizard } from "@/components/offer-tests/OfferTestWizard";

export const metadata = { title: "Create Offer Test — MarginLab" };

export default function NewOfferTestPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-neutral-100 bg-white">
        <Link href="/offer-tests" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Offer Tests
        </Link>
      </div>
      <OfferTestWizard />
    </div>
  );
}
