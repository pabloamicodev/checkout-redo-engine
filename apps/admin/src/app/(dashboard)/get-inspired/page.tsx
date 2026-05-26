import Link from "next/link";
import { CreateTestModal } from "@/components/experiments/CreateTestModal";
import {
  Plus, Clock, BookOpen, Video, Star, Code2,
  Play, CheckCircle2, Zap, Users, FlaskConical,
  ArrowRight, ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Filter tab config ──────────────────────────────────────────────────────────

const FILTER_TABS = [
  { label: "Get started templates", key: "templates", icon: Star },
  { label: "Quick start guides",    key: "guides",    icon: BookOpen },
  { label: "Featured videos",       key: "videos",    icon: Video },
  { label: "Best practices",        key: "practices", icon: Zap },
  { label: "Docs & APIs",           key: "docs",      icon: Code2 },
];

// ── Template sub-tabs ──────────────────────────────────────────────────────────

const TEMPLATE_TABS = [
  { label: "15 min Personalizations", key: "15min",    icon: "✦" },
  { label: "Content",                 key: "content",  icon: null },
  { label: "Offers",                  key: "offers",   icon: null },
  { label: "Checkout",                key: "checkout", icon: null },
  { label: "Shipping",                key: "shipping", icon: null },
  { label: "Pricing",                 key: "pricing",  icon: null },
];

// ── Template cards per sub-tab ─────────────────────────────────────────────────

const TEMPLATES_BY_TAB: Record<string, Array<{ slug: string; title: string; desc: string; gradient: string }>> = {
  "15min": [
    { slug: "abandoned-cart",      title: "Get Cart Abandoners to Buy",       desc: "Show a personalized recovery banner to visitors with items left in cart.", gradient: "from-violet-600 to-blue-600" },
    { slug: "email-subscribers",   title: "Get More Email Subscribers",        desc: "Show targeted popups to grow your email list with a first-order incentive.", gradient: "from-purple-600 to-indigo-600" },
    { slug: "quiz-personalization",title: "Quiz Data for Personalized Content",desc: "Use quiz answers to show the right products and copy to each visitor segment.", gradient: "from-indigo-600 to-blue-700" },
    { slug: "checkout-trust-badges", title: "Checkout Trust Badges",           desc: "Add security badges and social proof inside checkout to reduce drop-off.", gradient: "from-blue-600 to-cyan-600" },
    { slug: "checkout-upsells",    title: "Checkout Product Upsells",          desc: "Increase AOV by suggesting complementary products at the checkout step.", gradient: "from-blue-700 to-indigo-800" },
  ],
  "content": [
    { slug: "headline-test",      title: "A/B Test Your Product Page Headline", desc: "Test two different headline angles to find the copy that drives more conversions.", gradient: "from-violet-600 to-purple-700" },
    { slug: "hero-image-test",    title: "Hero Image vs. Video Test",            desc: "Find out whether lifestyle video or a static hero image converts better.", gradient: "from-purple-700 to-indigo-700" },
    { slug: "pdp-copy-test",      title: "Product Description Copy Test",        desc: "Test feature-led vs. benefit-led product descriptions and measure the uplift.", gradient: "from-indigo-700 to-blue-700" },
  ],
  "offers": [
    { slug: "volume-discount",     title: "Volume Discount Tiers",             desc: "Reward bulk buyers with automatic tiered discounts — set once and let it run.", gradient: "from-emerald-600 to-teal-600" },
    { slug: "free-shipping-bar",   title: "Free Shipping Progress Bar",         desc: "A spend-to-unlock bar that nudges customers to add one more item to qualify.", gradient: "from-teal-600 to-cyan-600" },
    { slug: "bxgy-offer",          title: "Buy X Get Y Offer",                  desc: "Classic BOGO mechanics — great for clearing inventory or launching new SKUs.", gradient: "from-cyan-600 to-blue-600" },
  ],
  "checkout": [
    { slug: "checkout-trust-badges", title: "Checkout Trust Badges",           desc: "Add security and guarantee badges exactly where purchase anxiety peaks.", gradient: "from-blue-600 to-cyan-600" },
    { slug: "checkout-upsells",    title: "Checkout Product Upsells",           desc: "One-click add for complementary products inside the checkout flow.", gradient: "from-blue-700 to-indigo-800" },
    { slug: "urgency-timer",       title: "Checkout Urgency Timer",             desc: "Add a countdown timer inside checkout to reduce hesitation and cart drops.", gradient: "from-red-600 to-orange-600" },
  ],
  "shipping": [
    { slug: "free-shipping-threshold", title: "Free Shipping Threshold Test",  desc: "Find the exact cart value threshold that maximises orders without killing margin.", gradient: "from-sky-600 to-blue-600" },
    { slug: "shipping-method-ab",      title: "Hide & Rename Shipping Methods", desc: "Test which shipping options increase checkout completion at lowest cost.", gradient: "from-blue-600 to-violet-600" },
  ],
  "pricing": [
    { slug: "price-sensitivity",  title: "Price Sensitivity Test",             desc: "Discover the optimal price point that balances conversion rate and revenue.", gradient: "from-amber-600 to-orange-600" },
    { slug: "compare-at-price",   title: "Compare-At Price Test",              desc: "Test whether showing a crossed-out higher price lifts conversion and perceived value.", gradient: "from-orange-600 to-rose-600" },
  ],
};

// ── Quick-start guides ─────────────────────────────────────────────────────────

const QUICK_GUIDES = [
  { title: "Price Testing",             desc: "Set up your first price test in minutes with this step-by-step guide.", readTime: "5 min", href: "/price-tests",                      icon: "💰" },
  { title: "Shipping Testing",          desc: "Learn how to test shipping rates and free shipping thresholds.",        readTime: "4 min", href: "/shipping-tests",                   icon: "📦" },
  { title: "Abandoned Cart Recovery",   desc: "Set up a personalization to recover lost sales from cart abandoners.",  readTime: "5 min", href: "/personalizations/abandoned-cart",  icon: "🛒" },
  { title: "Checkout Optimization",     desc: "Reduce friction and boost conversion at every checkout step.",          readTime: "6 min", href: "/checkout-tests",                   icon: "⚡" },
  { title: "Offer Library",             desc: "Build your first offer — volume discount, BOGO, or free shipping bar.", readTime: "4 min", href: "/offers-library",                   icon: "🎁" },
  { title: "Analytics & Statistics",    desc: "Learn to read your results and know when a winner is statistically real.", readTime: "7 min", href: "/analytics",                   icon: "📊" },
  { title: "Content A/B Tests",         desc: "Test headlines, copy, images, and layout changes on any page.",         readTime: "4 min", href: "/content-tests",                    icon: "✏️" },
  { title: "Integration Setup",         desc: "Connect GA4, Klaviyo, Slack, and custom webhooks in under 5 minutes.",  readTime: "3 min", href: "/integrations",                    icon: "🔗" },
];

// ── Featured videos ────────────────────────────────────────────────────────────

const VIDEOS = [
  { title: "Getting Started with A/B Testing",                     duration: "8:32",  category: "Getting Started",  emoji: "🚀", href: "#" },
  { title: "Setting Up Your First Price Test",                      duration: "5:14",  category: "Price Tests",      emoji: "💰", href: "#" },
  { title: "Understanding Statistical Significance",                duration: "12:04", category: "Analytics",        emoji: "📊", href: "#" },
  { title: "Recovering Cart Abandoners with Personalizations",      duration: "7:48",  category: "Personalizations", emoji: "🛒", href: "#" },
  { title: "Shipping Test Strategy: What to Test First",            duration: "6:22",  category: "Shipping",         emoji: "📦", href: "#" },
  { title: "Reading Your Analytics Dashboard",                      duration: "9:11",  category: "Analytics",        emoji: "📈", href: "#" },
  { title: "Building an Offer Library That Converts",               duration: "11:03", category: "Offers",           emoji: "🎁", href: "#" },
  { title: "How to Run a Checkout Conversion Experiment",           duration: "8:55",  category: "Checkout",         emoji: "⚡", href: "#" },
];

// ── Best practices ─────────────────────────────────────────────────────────────

const BEST_PRACTICES = [
  {
    category: "Test Design",
    icon: FlaskConical,
    items: [
      "Always have a control variant — never compare two changed variants without a baseline.",
      "Run tests for a minimum of 7 days to capture full weekly seasonality cycles.",
      "Change only one significant element at a time so you know what's driving the result.",
      "Calculate your minimum sample size before launching — use the in-app estimator.",
    ],
  },
  {
    category: "Traffic & Targeting",
    icon: Users,
    items: [
      "Never run a test on less than 20% of your traffic — low exposure slows results significantly.",
      "Use mutual exclusion groups to prevent overlapping tests from contaminating each other.",
      "Avoid launching during Black Friday or holiday spikes — atypical traffic skews results.",
      "Segment your test if you expect meaningful differences by device type or country.",
    ],
  },
  {
    category: "Analytics & Decisions",
    icon: Star,
    items: [
      "Wait for 95%+ statistical confidence before declaring a winner.",
      "Don't check results daily — the peeking problem inflates your false positive rate.",
      "Consider revenue per visitor alongside conversion rate. Higher CVR with lower AOV can mean less total revenue.",
      "For price tests, always evaluate profit margin — not just revenue — when picking a winner.",
    ],
  },
  {
    category: "Rollout & Iteration",
    icon: Zap,
    items: [
      "After a winner, run a follow-up test — there's almost always more lift to find.",
      "Document losing tests too. Understanding what doesn't work is equally valuable.",
      "Roll out gradually if your audience is large — watch for anomalies before going 100%.",
      "Archive experiments cleanly so your dashboard stays organized and your history stays searchable.",
    ],
  },
];

// ── Docs & APIs ────────────────────────────────────────────────────────────────

const DOCS_SECTIONS = [
  {
    title: "Getting Started",
    icon: Zap,
    links: [
      { title: "Check install health",               href: "/install-health",              external: false },
      { title: "Create your first A/B test",         href: "/experiments",                 external: false },
      { title: "Set up the analytics dashboard",     href: "/analytics",                   external: false },
      { title: "Connect an integration",             href: "/integrations",                external: false },
    ],
  },
  {
    title: "Experiment Types",
    icon: FlaskConical,
    links: [
      { title: "Price Tests",       href: "/price-tests",       external: false },
      { title: "Discount Tests",    href: "/discount-tests",    external: false },
      { title: "Shipping Tests",    href: "/shipping-tests",    external: false },
      { title: "Content Tests",     href: "/content-tests",     external: false },
      { title: "Split URL Tests",   href: "/split-url-tests",   external: false },
      { title: "Checkout Tests",    href: "/checkout-tests",    external: false },
    ],
  },
  {
    title: "Personalizations",
    icon: Users,
    links: [
      { title: "All Personalizations",        href: "/personalizations",                  external: false },
      { title: "Abandoned Cart Recovery",     href: "/personalizations/abandoned-cart",   external: false },
      { title: "Post-purchase Offers",        href: "/personalizations/post-purchase",    external: false },
    ],
  },
  {
    title: "Advanced",
    icon: Code2,
    links: [
      { title: "Custom events",         href: "/custom-events",   external: false },
      { title: "Cost of goods (COGS)",  href: "/cogs",            external: false },
      { title: "Audit log",             href: "/audit-log",       external: false },
      { title: "Shopify Function docs", href: "https://shopify.dev/docs/apps/build/functions", external: true },
    ],
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function GetInspiredPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = params?.filter ?? "templates";
  const activeTab    = params?.tab    ?? "15min";

  const currentTemplates = TEMPLATES_BY_TAB[activeTab] ?? TEMPLATES_BY_TAB["15min"]!;

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
            <Link
              key={f.key}
              href={`/get-inspired?filter=${f.key}`}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                f.key === activeFilter
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <f.icon className="w-3 h-3" />
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-8 pb-12 space-y-10">

        {/* ── GET STARTED TEMPLATES ── */}
        {activeFilter === "templates" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #6d28d9 0%, #4f46e5 50%, #2563eb 100%)" }}>
            <div className="px-7 pt-6 pb-0">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-white text-base">💡</span>
                <h2 className="text-base font-semibold text-white">Get started templates</h2>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-0 -mb-px overflow-x-auto">
                {TEMPLATE_TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={`/get-inspired?filter=templates&tab=${t.key}`}
                    className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                      t.key === activeTab
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white/90"
                    }`}
                  >
                    {t.icon && <span>{t.icon}</span>}
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Template cards */}
            <div className="p-6 grid grid-cols-3 gap-3">
              {currentTemplates.map((tpl) => (
                <Link key={tpl.slug} href={`/get-inspired/${tpl.slug}`}>
                  <div
                    className="rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl group"
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
            </div>
          </div>
        )}

        {/* ── QUICK START GUIDES ── */}
        {activeFilter === "guides" && (
          <div>
            <h2 className="text-base font-semibold text-neutral-900 mb-4">Quick start guides</h2>
            <div className="grid grid-cols-2 gap-4">
              {QUICK_GUIDES.map((guide) => (
                <Link key={guide.title} href={guide.href}>
                  <div className="bg-white rounded-xl p-5 flex items-start gap-4 hover:shadow-md transition-all cursor-pointer group border border-neutral-100">
                    <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-xl shrink-0">
                      {guide.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 group-hover:text-indigo-700 transition-colors">
                        {guide.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{guide.desc}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {guide.readTime} read
                        </span>
                        <span className="text-[11px] font-medium text-indigo-600">
                          Get started →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── FEATURED VIDEOS ── */}
        {activeFilter === "videos" && (
          <div>
            <h2 className="text-base font-semibold text-neutral-900 mb-4">Featured videos</h2>
            <div className="grid grid-cols-2 gap-4">
              {VIDEOS.map((v) => (
                <Link key={v.title} href={v.href}>
                  <div className="bg-white rounded-xl overflow-hidden border border-neutral-100 hover:shadow-md transition-all group cursor-pointer">
                    {/* Thumbnail placeholder */}
                    <div
                      className="h-36 flex items-center justify-center relative"
                      style={{ background: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)" }}
                    >
                      <span className="text-4xl">{v.emoji}</span>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-5 h-5 text-indigo-700 ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 text-[11px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">
                        {v.duration}
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">
                        {v.category}
                      </span>
                      <p className="text-sm font-semibold text-neutral-800 mt-1 leading-snug group-hover:text-indigo-700 transition-colors">
                        {v.title}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── BEST PRACTICES ── */}
        {activeFilter === "practices" && (
          <div>
            <h2 className="text-base font-semibold text-neutral-900 mb-4">Best practices</h2>
            <div className="grid grid-cols-2 gap-5">
              {BEST_PRACTICES.map((section) => (
                <div key={section.category} className="bg-white rounded-xl border border-neutral-100 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <section.icon className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">{section.category}</h3>
                  </div>
                  <ul className="space-y-3">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-neutral-600 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DOCS & APIs ── */}
        {activeFilter === "docs" && (
          <div>
            <h2 className="text-base font-semibold text-neutral-900 mb-4">Docs &amp; APIs</h2>
            <div className="grid grid-cols-2 gap-5">
              {DOCS_SECTIONS.map((section) => (
                <div key={section.title} className="bg-white rounded-xl border border-neutral-100 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <section.icon className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">{section.title}</h3>
                  </div>
                  <ul className="space-y-1">
                    {section.links.map((link) => (
                      <li key={link.title}>
                        <Link
                          href={link.href}
                          target={link.external ? "_blank" : undefined}
                          rel={link.external ? "noopener noreferrer" : undefined}
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs text-neutral-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group"
                        >
                          <span>{link.title}</span>
                          {link.external
                            ? <ExternalLink className="w-3 h-3 text-neutral-300 group-hover:text-indigo-400" />
                            : <ArrowRight className="w-3 h-3 text-neutral-300 group-hover:text-indigo-400" />
                          }
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DEFAULT: show quick guides below templates ── */}
        {activeFilter === "templates" && (
          <div>
            <h2 className="text-base font-semibold text-neutral-900 mb-4">Quick start guides</h2>
            <div className="grid grid-cols-2 gap-4">
              {QUICK_GUIDES.slice(0, 4).map((guide) => (
                <Link key={guide.title} href={guide.href}>
                  <div className="bg-white rounded-xl p-5 flex items-start gap-4 hover:shadow-md transition-all cursor-pointer group border border-neutral-100">
                    <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-xl shrink-0">
                      {guide.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 group-hover:text-indigo-700 transition-colors">
                        {guide.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{guide.desc}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {guide.readTime} read
                        </span>
                        <span className="text-[11px] font-medium text-indigo-600">Get started →</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-3 text-right">
              <Link href="/get-inspired?filter=guides" className="text-xs text-indigo-600 hover:underline">
                View all guides →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
