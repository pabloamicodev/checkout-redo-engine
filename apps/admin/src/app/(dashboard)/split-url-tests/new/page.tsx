import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SplitUrlWizard } from "@/components/experiments/SplitUrlWizard";


export const dynamic = 'force-dynamic';
export const metadata = { title: "Create Split URL Test — MarginLab" };

export default function NewSplitUrlTestPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-neutral-100 bg-white">
        <Link href="/split-url-tests" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Split URL Tests
        </Link>
      </div>
      <SplitUrlWizard />
    </div>
  );
}
