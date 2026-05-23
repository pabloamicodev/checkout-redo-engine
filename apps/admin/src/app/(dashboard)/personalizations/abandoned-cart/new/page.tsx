import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AbandonedCartClient } from "@/components/personalizations/AbandonedCartClient";

export default function AbandonedCartNewPage() {
  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div>
          <Link
            href="/personalizations/abandoned-cart"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-3"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Abandoned Cart Recovery
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
            New Abandoned Cart Recovery
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Create a personalized recovery message for cart abandoners.
          </p>
        </div>

        <AbandonedCartClient
          initialItems={[]}
          initialShowWizard={true}
          redirectAfterCreate="/personalizations/abandoned-cart"
        />
      </div>
    </div>
  );
}
