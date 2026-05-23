import Link from "next/link";
import { ChevronLeft, Clock, Sparkles } from "lucide-react";

interface ComingSoonPageProps {
  accentHex: string;
  typeLabel: string;
  typeDescription: string;
  features: string[];
  backHref: string;
  backLabel: string;
}

export function ComingSoonPage({ accentHex, typeLabel, typeDescription, features, backHref, backLabel }: ComingSoonPageProps) {
  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-2xl mx-auto px-8 py-12 space-y-8">

        {/* Back link */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {backLabel}
        </Link>

        {/* Hero card */}
        <div
          className="rounded-2xl px-8 py-10 text-center space-y-4"
          style={{
            background: `linear-gradient(135deg, ${accentHex}08 0%, ${accentHex}04 100%)`,
            border: `1px solid ${accentHex}20`,
          }}
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${accentHex}15` }}
            >
              <Clock className="w-8 h-8" style={{ color: accentHex }} />
            </div>
          </div>

          {/* Badge */}
          <div className="flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: `${accentHex}12`, color: accentHex, border: `1px solid ${accentHex}25` }}
            >
              <Sparkles className="w-3 h-3" />
              Coming soon
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{typeLabel}</h1>
            <p className="text-sm text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{typeDescription}</p>
          </div>
        </div>

        {/* Features preview */}
        <div className="bg-white rounded-xl border border-neutral-100 p-6 space-y-4">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">What&apos;s coming</p>
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${accentHex}15` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentHex }} />
                </div>
                <span className="text-sm text-neutral-600 leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Notify section */}
        <div className="text-center space-y-2">
          <p className="text-xs text-neutral-400">
            This feature is in development. Check back soon or reach out to{" "}
            <a
              href="mailto:pablo@focus-digital.co"
              className="underline underline-offset-2 hover:text-neutral-600 transition-colors"
            >
              pablo@focus-digital.co
            </a>
            {" "}for early access.
          </p>
        </div>
      </div>
    </div>
  );
}
