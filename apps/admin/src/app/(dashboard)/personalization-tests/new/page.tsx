import Link from "next/link";
import { PersonalizationTestWizard } from "@/components/personalization-tests/PersonalizationTestWizard";
import { ChevronLeft } from "lucide-react";


export const dynamic = 'force-dynamic';
export default function NewPersonalizationTestPage() {
  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div>
          <Link href="/personalization-tests" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-2">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Personalization Tests
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">New Personalization Test</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Show personalized offers to specific visitor segments.</p>
        </div>
        <PersonalizationTestWizard />
      </div>
    </div>
  );
}
