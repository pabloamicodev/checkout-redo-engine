import Link from "next/link";
import { OfferWizard } from "@/components/offers/OfferWizard";
import { ChevronLeft } from "lucide-react";

export default function NewOfferPage() {
  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div>
          <Link
            href="/offers-library"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Offers Library
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">New Offer</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Create a reusable discount rule for experiments or personalizations</p>
        </div>
        <OfferWizard />
      </div>
    </div>
  );
}
