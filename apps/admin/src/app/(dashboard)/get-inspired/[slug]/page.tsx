"use server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ArrowRight, Clock, CheckCircle2, Zap, Users, TrendingUp, ShoppingCart } from "lucide-react";

interface TemplateStep { title: string; description: string }
interface TemplateResult { label: string; value: string; icon: React.ElementType }

interface TemplateConfig {
  title: string;
  subtitle: string;
  description: string;
  readTime: string;
  impact: "High" | "Medium" | "Low";
  cta: { label: string; href: string };
  steps: TemplateStep[];
  results: TemplateResult[];
  tips: string[];
  gradientFrom: string;
  gradientTo: string;
  emoji: string;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  "abandoned-cart": {
    title: "Get Cart Abandoners to Buy",
    subtitle: "15-Minute Personalization",
    description: "Show a targeted banner to visitors with items in their cart who have not checked out. Recover lost revenue with a personalized message and optional incentive.",
    readTime: "5 min",
    impact: "High",
    emoji: "🛒",
    gradientFrom: "#7c3aed",
    gradientTo: "#2563eb",
    cta: { label: "Set up Abandoned Cart Recovery", href: "/personalizations/abandoned-cart/new" },
    steps: [
      { title: "Create an Abandoned Cart personalization", description: "Navigate to Personalizations, then Abandoned Cart and click New. Give it a descriptive name." },
      { title: "Write your recovery message", description: "Craft a short, high-urgency message. Example: You left something behind! Complete your order and get free shipping today only." },
      { title: "Add an offer (optional)", description: "Link a free-shipping or percentage-discount offer from your Offers Library to sweeten the deal." },
      { title: "Set your targeting rules", description: "Target visitors with cart abandonment signals. Narrow by device type, traffic source, or cart value thresholds." },
      { title: "Activate and monitor", description: "Launch the personalization and watch your Recovery Rate and Attributed Revenue metrics in the detail page analytics." },
    ],
    results: [
      { label: "Avg. Recovery Rate", value: "4-8%", icon: ShoppingCart },
      { label: "Revenue Lift", value: "+12-18%", icon: TrendingUp },
      { label: "Setup Time", value: "15 min", icon: Clock },
    ],
    tips: [
      "Use social proof in your message (284 people bought this today).",
      "Urgency works -- add a countdown or limited-time offer.",
      "Keep the message short: headline plus one sentence plus CTA button.",
      "A/B test different incentives: free shipping vs 10% off vs no incentive.",
    ],
  },

  "email-subscribers": {
    title: "Get More Email Subscribers",
    subtitle: "15-Minute Personalization",
    description: "Display a targeted popup or announcement bar to grow your email list. Show different messages to new vs returning visitors, and suppress it once someone subscribes.",
    readTime: "4 min",
    impact: "Medium",
    emoji: "📧",
    gradientFrom: "#9333ea",
    gradientTo: "#4f46e5",
    cta: { label: "Create Email Subscriber Personalization", href: "/personalizations/new" },
    steps: [
      { title: "Create a Content personalization", description: "Go to Personalizations, then Site Content, then New. Choose the Email Subscriber Popup modification type." },
      { title: "Design your offer", description: "Give visitors a reason to subscribe: 10% off their first order, early access to sales, or free shipping on the next order." },
      { title: "Target new visitors only", description: "Set targeting to Visitor Type = New so returning subscribers do not see the popup every time they visit." },
      { title: "Set a display delay", description: "Show the popup after 15-30 seconds or when the visitor scrolls 50% down the page for better engagement." },
      { title: "Connect your email platform", description: "In Settings, Integrations, connect Klaviyo or another email provider to automatically add subscribers." },
    ],
    results: [
      { label: "Avg. Opt-in Rate", value: "3-6%", icon: Users },
      { label: "List Growth", value: "+20-40%", icon: TrendingUp },
      { label: "Setup Time", value: "15 min", icon: Clock },
    ],
    tips: [
      "Lead with the benefit, not the ask. Get 10% off beats Subscribe to our newsletter.",
      "Keep the form to email only -- fewer fields means higher conversion.",
      "Test a floating bar vs a centered modal popup.",
      "Always include an easy dismiss option to avoid annoying real customers.",
    ],
  },

  "quiz-personalization": {
    title: "Quiz Data for Personalized Content",
    subtitle: "15-Minute Personalization",
    description: "Use answers from a product recommendation quiz to show relevant content, product recommendations, or offers to each visitor segment.",
    readTime: "6 min",
    impact: "High",
    emoji: "🎯",
    gradientFrom: "#4f46e5",
    gradientTo: "#1d4ed8",
    cta: { label: "Create Quiz Personalization", href: "/personalizations/new" },
    steps: [
      { title: "Set up your quiz", description: "Use a quiz tool (Octane AI, Typeform, Klaviyo) to capture visitor preferences and store results in browser storage or as Klaviyo profile properties." },
      { title: "Define your visitor segments", description: "Based on quiz answers, create logical segments such as Skin type: Oily, Budget: Premium, or Goal: Muscle Gain." },
      { title: "Create a Personalization per segment", description: "In Personalizations, create one personalization for each segment. Target using the quiz result custom event or cookie value." },
      { title: "Modify the relevant page content", description: "Swap in personalized headlines, product grids, or hero images that match each segment preferences." },
      { title: "Measure engagement lift", description: "Track conversion rate and revenue per visitor for personalized vs non-personalized traffic to validate the impact." },
    ],
    results: [
      { label: "CVR Lift", value: "+15-30%", icon: TrendingUp },
      { label: "RPV Increase", value: "+18-25%", icon: ShoppingCart },
      { label: "Setup Time", value: "~1 hour", icon: Clock },
    ],
    tips: [
      "Start with 2-3 high-volume segments instead of many small ones.",
      "Use MarginLab custom events to fire a quiz_completed signal when results are ready.",
      "Personalize the page hero and product grid for maximum visual impact.",
      "Run it alongside a content A/B test to validate the best message per segment.",
    ],
  },

  "checkout-trust-badges": {
    title: "Checkout Trust Badges",
    subtitle: "15-Minute Personalization",
    description: "Add security badges, payment icons, and social proof elements inside your Shopify checkout to reduce anxiety and boost conversion at the most critical moment.",
    readTime: "3 min",
    impact: "High",
    emoji: "🛡️",
    gradientFrom: "#2563eb",
    gradientTo: "#0891b2",
    cta: { label: "Create Checkout Block", href: "/checkout-blocks/new" },
    steps: [
      { title: "Create a Trust Badges checkout block", description: "Go to Checkout Blocks, then New Block. Select Trust Badges as the type and choose the checkout step where it should appear." },
      { title: "Choose your badges", description: "Select from SSL Secure, Money-back Guarantee, Free Returns, Payment icons (Visa, MC, PayPal), and review counts." },
      { title: "Position before payment", description: "The highest-impact placement is Before Payment -- it addresses security concerns at the exact moment customers hesitate." },
      { title: "A/B test badge combinations", description: "Create a Checkout Test with 2 variants: one with just security badges, one adding a 10,000+ happy customers counter." },
      { title: "Activate and measure", description: "Launch the block and track checkout completion rate in your analytics to measure the conversion lift." },
    ],
    results: [
      { label: "Checkout CVR Lift", value: "+2-5%", icon: TrendingUp },
      { label: "Cart Abandonment Drop", value: "-8-12%", icon: ShoppingCart },
      { label: "Setup Time", value: "10 min", icon: Clock },
    ],
    tips: [
      "Less is more -- 3-4 badges looks polished, 10 badges looks desperate.",
      "Match badge style to your brand (minimal for premium brands, colorful for mass market).",
      "Add a short 30-day free returns text below the badges for extra reassurance.",
      "Test different badge combinations to find what resonates with your audience.",
    ],
  },

  "checkout-upsells": {
    title: "Checkout Product Upsells",
    subtitle: "15-Minute Personalization",
    description: "Show a targeted product recommendation inside checkout to increase average order value. Triggered when a cart contains specific products or meets a value threshold.",
    readTime: "5 min",
    impact: "High",
    emoji: "⬆️",
    gradientFrom: "#1d4ed8",
    gradientTo: "#3730a3",
    cta: { label: "Create Upsell Block", href: "/checkout-blocks/new" },
    steps: [
      { title: "Identify your best upsell products", description: "Find products frequently bought together or accessories that complement your best-sellers. AOV data in Analytics will help." },
      { title: "Create a Product Upsell checkout block", description: "Go to Checkout Blocks, then New. Select Product Upsell and configure the product to display and the trigger condition." },
      { title: "Set smart targeting rules", description: "Trigger the upsell only when the cart contains the parent product and does NOT already contain the upsell product." },
      { title: "Write compelling copy", description: "Use Complete the look, You might also need, or Most customers also add as proven copy frameworks." },
      { title: "Test placement and product", description: "Run a Checkout Test: control (no upsell) vs upsell A vs upsell B to find the highest AOV combination." },
    ],
    results: [
      { label: "AOV Increase", value: "+8-15%", icon: TrendingUp },
      { label: "Attachment Rate", value: "4-12%", icon: ShoppingCart },
      { label: "Setup Time", value: "20 min", icon: Clock },
    ],
    tips: [
      "Keep the upsell price at 20-30% of the cart value max to avoid checkout friction.",
      "One-click add to cart (no page redirect) is essential for checkout upsells.",
      "Use a product image plus 1 short sentence -- do not over-explain.",
      "Exclude customers who already own the upsell product if your data supports it.",
    ],
  },
};

const IMPACT_COLOR: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export default async function GetInspiredTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tpl = TEMPLATES[slug];
  if (!tpl) return notFound();

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">

        <Link
          href="/get-inspired"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Ideas &amp; Inspiration
        </Link>

        {/* Hero card */}
        <div
          className="rounded-2xl p-7 text-white"
          style={{ background: `linear-gradient(135deg, ${tpl.gradientFrom} 0%, ${tpl.gradientTo} 100%)` }}
        >
          <div className="text-3xl mb-3">{tpl.emoji}</div>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">{tpl.subtitle}</p>
          <h1 className="text-2xl font-bold leading-snug mb-2">{tpl.title}</h1>
          <p className="text-sm text-white/80 leading-relaxed max-w-xl">{tpl.description}</p>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Clock className="w-3.5 h-3.5" />
              {tpl.readTime} read
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20">
              <Zap className="w-3 h-3" />
              {tpl.impact} Impact
            </span>
          </div>
        </div>

        {/* Metric callouts */}
        <div className="grid grid-cols-3 gap-4">
          {tpl.results.map((r) => (
            <div key={r.label} className="bg-white rounded-xl border border-neutral-100 p-4 text-center shadow-card">
              <r.icon className="w-4 h-4 text-brand-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-neutral-900">{r.value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{r.label}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl border border-neutral-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900">How to set it up</h2>
          </div>
          <div className="divide-y divide-neutral-50">
            {tpl.steps.map((step, i) => (
              <div key={i} className="flex gap-4 px-5 py-4">
                <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{step.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-brand-900 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-600" />
            Pro tips
          </h2>
          <ul className="space-y-2">
            {tpl.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-brand-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA bar */}
        <div className="flex items-center justify-between bg-white border border-neutral-100 rounded-xl px-5 py-4 shadow-card">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Ready to get started?</p>
            <p className="text-xs text-neutral-400 mt-0.5">Takes about {tpl.readTime}</p>
          </div>
          <Link
            href={tpl.cta.href}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
          >
            {tpl.cta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
}
