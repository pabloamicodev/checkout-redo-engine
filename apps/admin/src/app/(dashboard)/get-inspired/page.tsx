import Link from "next/link";
import { CreateTestModal } from "@/components/experiments/CreateTestModal";
import { Plus, Clock, BookOpen, Video, Star, Code2 } from "lucide-react";


export const dynamic = 'force-dynamic';
// ── Static template/guide data ─────────────────────────────────────────────

const TEMPLATE_TABS = [
  { label: "15 min Personalizations", icon: "✦" },
  { label: "Content", icon: null },
  { label: "Offers", icon: null },
  { label: "Checkout", icon: null },
  { label: "Shipping", icon: null },
  { label: "Pricing", icon: null },
];

const TEMPLATES = [
  {
    slug: "abandoned-cart",
    title: "Get Cart Abandoners to Buy",
    desc: "Use this 15-Minute Personalization to remind visitors with abandoned carts to complete their purchase",
    tab: "15 min Personalizations",
    gradient: "from-violet-600 to-blue-600",
  },
  {
    slug: "email-subscribers",
    title: "Get More Email Subscribers",
    desc: "Show targeted popups and announcement bars to grow your list",
    tab: "15 min Personalizations",
    gradient: "from-purple-600 to-indigo-600",
  },
  {
    slug: "quiz-personalization",
    title: "Quiz Data for Personalized Content",
    desc: "Use Klaviyo quiz answers to show relevant product recommendations",
    tab: "15 min Personalizations",
    gradient: "from-indigo-600 to-blue-700",
  },
  {
    slug: "checkout-trust-badges",
    title: "Checkout Trust Badges",
    desc: "Boost checkout confidence with security badges and social proof",
    tab: "15 min Personalizations",
    gradient: "from-blue-600 to-cyan-600",
  },
  {
    slug: "checkout-upsells",
    title: "Checkout Product Upsells",
    desc: "Increase AOV by offering complementary products at checkout",
    tab: "15 min Personalizations",
    gradient: "from-blue-700 to-indigo-800",
  },
];

const QUICK_GUIDES = [
  {
    title: "Price Testing",
    desc: "Set up your first price test in minutes with this step-by-step guide",
    readTime: "5 min read",
    href: "/price-tests",
    icon: "💰",
  },
  {
    title: "Shipping Testing",
    desc: "Learn how to test shipping rates and free shipping thresholds",
    readTime: "4 min read",
    href: "/shipping-tests",
    icon: "📦",
  },
  {
    title: "Abandoned Cart Recovery",
    desc: "Set up a personalization to recover lost sales from cart abandoners",
    readTime: "5 min read",
    href: "/personalizations/abandoned-cart",
    icon: "🛒",
  },
  {
    title: "Checkout Optimization",
    desc: "Reduce friction and boost conversion at every checkout step",
    readTime: "6 min read",
    href: "/checkout-tests",
    icon: "⚡",
  },
];

const FILTER_TABS = [
  { label: "Get started templates", icon: Star },
  { label: "Quick start guides", icon: BookOpen },
  { label: "Featured videos", icon: Video },
  { label: "Best practices", icon: Clock },
  { label: "Docs & APIs", icon: Code2 },
];

export default function GetInspiredPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; template?: string }>;
}) {
  const activeFilter = "Get started templates";

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      {/* Page header */}
      <div className="flex items-start justify-between px-8 pt-8 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Ideas &amp; inspiration</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Guides, examples, and strategies to run profitable tests
          </p>
        </div>
        <CreateTestModal>
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
          >
            <Plus className="w-4 h-4" />
            Create new
          </button>
        </CreateTestModal>
      </div>

      {/* Filter tabs */}
      <div className="px-8 pb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_TABS.map((f) => (
            <button
              key={f.label}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                f.label === activeFilter
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <f.icon className="w-3 h-3" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 pb-12 space-y-10">
        {/* Templates section — purple gradient card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #6d28d9 0%, #4f46e5 50%, #2563eb 100%)" }}>
          <div className="px-7 pt-6 pb-0">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-white text-base">💡</span>
              <h2 className="text-base font-semibold text-white">Get started templates</h2>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-0 -mb-px overflow-x-auto">
              {TEMPLATE_TABS.map((t, i) => (
                <button
                  key={t.label}
                  className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    i === 0
                      ? "border-white text-white"
                      : "border-transparent text-white/60 hover:text-white/90"
                  }`}
                >
                  {t.icon && <span>{t.icon}</span>}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template cards */}
          <div className="p-6 grid grid-cols-3 gap-3">
            {TEMPLATES.slice(0, 5).map((tpl, i) => (
              <Link key={tpl.slug} href={`/get-inspired/${tpl.slug}`}>
                <div
                  className={`rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl group ${
                    i === TEMPLATES.length - 1 ? "col-span-1" : ""
                  }`}
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <h3 className="text-sm font-semibold text-white leading-snug mb-1">{tpl.title}</h3>
                  <p className="text-xs text-white/60 leading-relaxed line-clamp-2 min-h-10">{tpl.desc}</p>
                  <span className="text-xs text-white/50 mt-2 inline-flex items-center gap-0.5 group-hover:text-white/80 transition-colors">
                    Get started →
                  </span>
                </div>
              </Link>
            ))}

            {/* View more card */}
            <div
              className="rounded-xl p-5 flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <span className="text-sm font-medium text-white/80">
                View more templates →
              </span>
            </div>
          </div>
        </div>

        {/* Quick start guides */}
        <div>
          <h2 className="text-base font-semibold text-neutral-900 mb-4">Quick start guides</h2>
          <div className="grid grid-cols-2 gap-4">
            {QUICK_GUIDES.map((guide) => (
              <Link key={guide.title} href={guide.href}>
                <div
                  className="bg-white rounded-xl p-5 flex items-start gap-4 hover:shadow-md transition-all cursor-pointer group border border-neutral-100"
                >
                  <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-xl shrink-0">
                    {guide.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 group-hover:text-brand-700 transition-colors">
                      {guide.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                      {guide.desc}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {guide.readTime}
                      </span>
                      <span className="text-[11px] font-medium text-brand-600">
                        Get started →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
