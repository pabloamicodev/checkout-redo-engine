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
  // ── Content templates ──────────────────────────────────────────────────────

  "headline-test": {
    title: "A/B Test Your Product Page Headline",
    subtitle: "Content Test",
    description: "Test two different headline angles on your product pages — benefit-led vs. feature-led, emotional vs. rational — and let conversion data pick the winner.",
    readTime: "4 min",
    impact: "High",
    emoji: "✏️",
    gradientFrom: "#7c3aed",
    gradientTo: "#6d28d9",
    cta: { label: "Create a Content Test", href: "/content-tests" },
    steps: [
      { title: "Identify your highest-traffic product page", description: "Go to Analytics and find the product page with the most visits. Start there for fastest results." },
      { title: "Write two headline variants", description: "Control = current headline. Variant B = a rewritten version with a different angle (e.g. benefit-first: 'Sleep 2x Deeper, Wake Up Refreshed')." },
      { title: "Create a Content Test", description: "In Content Tests, add a modification: selector = your headline element, operation = update-text, value = your variant copy." },
      { title: "Set traffic split and launch", description: "50/50 traffic split is ideal for headline tests. Launch once you have enough daily visitors for a clean result." },
      { title: "Measure conversion lift", description: "Track conversion rate and revenue per visitor per variant. Headlines can move CVR by 5-20% — the impact is worth testing." },
    ],
    results: [
      { label: "CVR Lift Range",    value: "5–20%",   icon: TrendingUp },
      { label: "Setup Time",        value: "10 min",  icon: Clock },
      { label: "Result Speed",      value: "1–2 wks", icon: Zap },
    ],
    tips: [
      "Lead with the biggest benefit, not the product name or brand.",
      "Keep variants similar in length so DOM layout doesn't change between groups.",
      "Run a second test after finding a winner — there's almost always more lift available.",
      "Test mobile and desktop separately if traffic profiles differ significantly.",
    ],
  },

  "hero-image-test": {
    title: "Hero Image vs. Video Test",
    subtitle: "Content Test",
    description: "Find out whether a lifestyle video or a high-quality static image converts better on your homepage or product page hero section.",
    readTime: "5 min",
    impact: "Medium",
    emoji: "🎬",
    gradientFrom: "#6d28d9",
    gradientTo: "#4f46e5",
    cta: { label: "Create a Content Test", href: "/content-tests" },
    steps: [
      { title: "Choose your hero placement", description: "Pick the page with the most traffic — usually the homepage or a hero product page. That's where the test will have the highest impact." },
      { title: "Prepare both assets", description: "Control = current static image. Variant B = a short (8-15s) lifestyle video showing the product in use. Keep file sizes optimized." },
      { title: "Upload and configure", description: "In Content Tests, use set-attribute to swap the src of your hero img tag, or set-display to toggle between a video and image wrapper." },
      { title: "Run for a full week minimum", description: "Video vs. image tests can be sensitive to time of day and device type. Run for at least 7 days for reliable data." },
      { title: "Segment by device", description: "Check if video wins on desktop but loses on mobile (autoplay rules and bandwidth differ). You may want different experiences per device." },
    ],
    results: [
      { label: "Avg. Engagement Lift", value: "+8–22%",  icon: TrendingUp },
      { label: "Setup Time",           value: "20 min",  icon: Clock },
      { label: "Typical Run Time",     value: "1–2 wks", icon: Zap },
    ],
    tips: [
      "Video autoplay works best muted with captions — never autoplay with sound.",
      "If video wins, test different video lengths (6s hook vs. 15s story).",
      "Use add-to-cart rate — not just conversion rate — as your primary metric for hero tests.",
      "A slow-loading video can hurt more than it helps. Run a Lighthouse check first.",
    ],
  },

  "pdp-copy-test": {
    title: "Product Description Copy Test",
    subtitle: "Content Test",
    description: "Test feature-led vs. benefit-led product descriptions, or short vs. long copy formats, and measure which drives more conversions and higher AOV.",
    readTime: "4 min",
    impact: "Medium",
    emoji: "📝",
    gradientFrom: "#4f46e5",
    gradientTo: "#2563eb",
    cta: { label: "Create a Content Test", href: "/content-tests" },
    steps: [
      { title: "Audit your current description", description: "Is it feature-led (specs and ingredients) or benefit-led (outcomes and feelings)? Most stores default to features. Test a benefit-first rewrite." },
      { title: "Write variant B copy", description: "Rewrite the description from the customer outcome perspective. Replace 'Contains 500mg of magnesium' with 'Wake up feeling rested — not groggy'." },
      { title: "Create the Content Test", description: "Use update-text on your description selector. If your description renders from metafields, you may need to target the rendered HTML directly." },
      { title: "Set goals", description: "Primary goal = add-to-cart or purchase. Secondary = time on page. Benefit-led copy can also reduce returns if it sets accurate expectations." },
      { title: "Iterate on the winner", description: "Once you find the winning angle, test a bulleted list vs. paragraph format, or add a guarantee block below the copy." },
    ],
    results: [
      { label: "CVR Lift Range",  value: "3–12%",   icon: TrendingUp },
      { label: "Setup Time",      value: "15 min",  icon: Clock },
      { label: "Result Speed",    value: "1–3 wks", icon: Zap },
    ],
    tips: [
      "Benefit copy works best for emotional/lifestyle products. Feature copy works for technical/professional products.",
      "Always test on your top revenue-generating product first.",
      "Short copy rarely wins for high-consideration products — test adding more, not removing.",
      "Use social proof language in variant B: 'Join 12,000+ customers who...'",
    ],
  },

  // ── Offer templates ─────────────────────────────────────────────────────────

  "volume-discount": {
    title: "Volume Discount Tiers",
    subtitle: "Offer Setup",
    description: "Set up automatic tiered discounts that reward customers for buying more — great for consumables, supplements, and any product where multi-unit purchases make sense.",
    readTime: "5 min",
    impact: "High",
    emoji: "📦",
    gradientFrom: "#059669",
    gradientTo: "#0d9488",
    cta: { label: "Create a Volume Discount Offer", href: "/offers-library" },
    steps: [
      { title: "Go to your Offer Library", description: "Navigate to Offers Library and click New Offer. Select Volume Discount as the offer type." },
      { title: "Define your tiers", description: "Start with 3 tiers: Buy 2 save 10%, Buy 3 save 15%, Buy 4+ save 20%. These ranges work well as a starting point for most categories." },
      { title: "Set eligible products", description: "Apply to your best-selling product first. Once validated, expand to a product collection." },
      { title: "Activate the offer", description: "Toggle the offer to Active. It will automatically apply to eligible carts through the Shopify discount function." },
      { title: "A/B test the thresholds", description: "Run an Offer Test with control (no discount) vs your volume tiers to quantify the exact AOV and revenue lift." },
    ],
    results: [
      { label: "AOV Increase",    value: "+15–30%",  icon: TrendingUp },
      { label: "Units Per Order", value: "+20–40%",  icon: ShoppingCart },
      { label: "Setup Time",      value: "10 min",   icon: Clock },
    ],
    tips: [
      "Show a visual tier chart on the product page so customers know what they're working toward.",
      "Margins permitting, make tier 3 feel like the obvious best-value choice.",
      "Test whether showing the savings in dollars (Save $12) vs. percent (Save 15%) performs better.",
      "Exclude products already on sale to protect margin.",
    ],
  },

  "free-shipping-bar": {
    title: "Free Shipping Progress Bar",
    subtitle: "Offer Setup",
    description: "A dynamic progress bar that shows customers how close they are to earning free shipping — one of the highest ROI tactics for increasing average order value.",
    readTime: "4 min",
    impact: "High",
    emoji: "🚀",
    gradientFrom: "#0d9488",
    gradientTo: "#0891b2",
    cta: { label: "Create a Free Shipping Offer", href: "/offers-library" },
    steps: [
      { title: "Set your free shipping threshold", description: "In Offers Library, create a Free Shipping offer. Set the minimum cart value — a common starting point is 20-30% above your current AOV." },
      { title: "Enable the progress bar", description: "In the offer's display settings, enable the progress bar widget. It will show the gap to threshold dynamically as customers add items." },
      { title: "Configure the messaging", description: "Customize the 'Add $X more for free shipping' message. Keep it short and urgent. 'You're $12 away!' outperforms generic text." },
      { title: "Choose placement", description: "The bar appears best in the cart drawer or cart page. It can also display in a sticky announcement bar on all pages." },
      { title: "Test different thresholds", description: "Run an Offer Test with two thresholds (e.g. $50 vs $75) to find the point that maximises net revenue after shipping costs." },
    ],
    results: [
      { label: "AOV Lift",       value: "+8–18%",  icon: TrendingUp },
      { label: "Shipping Cost",  value: "Neutral",  icon: ShoppingCart },
      { label: "Setup Time",     value: "8 min",    icon: Clock },
    ],
    tips: [
      "Update the threshold seasonally — raise it during high-AOV periods like Q4.",
      "The bar is most effective when customers are within $10-$20 of the threshold.",
      "Combine with a product recommendation widget: 'Add X to qualify — most popular with your cart.'",
      "Track whether the threshold is being hit more often after activation in your order analytics.",
    ],
  },

  "bxgy-offer": {
    title: "Buy X Get Y Offer",
    subtitle: "Offer Setup",
    description: "Classic Buy X Get Y mechanics — free product, discounted product, or free shipping when a specific quantity or product is in cart. Great for new product launches and inventory clearance.",
    readTime: "5 min",
    impact: "Medium",
    emoji: "🎁",
    gradientFrom: "#0891b2",
    gradientTo: "#2563eb",
    cta: { label: "Create a Buy X Get Y Offer", href: "/offers-library" },
    steps: [
      { title: "Create a Buy X Get Y offer", description: "In Offers Library, select Buy X Get Y. Set the trigger product (X) and the reward product (Y)." },
      { title: "Define the mechanics", description: "Choose: free Y, discounted Y (e.g. 50% off), or free shipping when X is in cart. 'Free gift' tends to convert better than % discounts for BXGY." },
      { title: "Set trigger rules", description: "Trigger when cart contains the specific SKU, or when quantity of a product reaches a threshold (e.g. buy 2, get 1 free)." },
      { title: "Choose your reward product carefully", description: "The Y product should be low-cost-to-you but high-perceived-value to the customer. Samples, complementary accessories, or branded merchandise work well." },
      { title: "Activate and monitor redemption rate", description: "Track offer views vs. claims in the offer analytics. A low claim rate means the offer is being seen but not acted on — revise the messaging." },
    ],
    results: [
      { label: "Redemption Rate",  value: "4–12%",   icon: ShoppingCart },
      { label: "CVR Lift",         value: "+3–8%",   icon: TrendingUp },
      { label: "Setup Time",       value: "15 min",  icon: Clock },
    ],
    tips: [
      "Make the free gift feel valuable — a $5 sample box beats a single sachet.",
      "Show a 'Free gift included' badge on product tiles to boost initial add-to-cart rate.",
      "Run BXGY during launches to drive trial of a new product alongside a bestseller.",
      "A/B test 'Buy 2 get 1 free' vs 'Buy 3 save 33%' — identical economics, very different perception.",
    ],
  },

  // ── Checkout templates ──────────────────────────────────────────────────────

  "urgency-timer": {
    title: "Checkout Urgency Timer",
    subtitle: "Checkout Block",
    description: "Add a countdown timer inside your Shopify checkout to reduce hesitation and cart abandonment at the most critical moment in the funnel.",
    readTime: "4 min",
    impact: "Medium",
    emoji: "⏱️",
    gradientFrom: "#dc2626",
    gradientTo: "#ea580c",
    cta: { label: "Create a Checkout Block", href: "/checkout-blocks" },
    steps: [
      { title: "Create an Urgency Message checkout block", description: "Go to Checkout Blocks and create a new block. Select Urgency Message as the type." },
      { title: "Configure the countdown", description: "Set the timer duration (15-20 minutes is standard for e-commerce). Add copy: 'Your cart is reserved for 18:32'." },
      { title: "Position before payment", description: "Place the block at the Before Payment step — where abandonment rates are highest and urgency has the most impact." },
      { title: "Set targeting rules (optional)", description: "You can restrict the timer to high-value carts only (e.g. cart value > $80) to avoid annoying low-consideration buyers." },
      { title: "A/B test as a Checkout Test", description: "Run a Checkout Test: control (no timer) vs. timer variant. Measure checkout completion rate as your primary metric." },
    ],
    results: [
      { label: "Checkout CVR Lift",    value: "+2–6%",    icon: TrendingUp },
      { label: "Abandonment Drop",     value: "-5–10%",   icon: ShoppingCart },
      { label: "Setup Time",           value: "10 min",   icon: Clock },
    ],
    tips: [
      "Never use fake timers — customers notice. Make the timer reset if they leave and return.",
      "Pair with a 'Selling fast' stock message for high-demand products.",
      "Test different durations: 10 min vs 20 min to find the right urgency level.",
      "Use neutral, factual language: 'Cart reserved' outperforms aggressive 'Hurry!' messaging.",
    ],
  },

  // ── Shipping templates ──────────────────────────────────────────────────────

  "free-shipping-threshold": {
    title: "Free Shipping Threshold Test",
    subtitle: "Shipping Test",
    description: "Find the exact free shipping threshold that maximises net revenue — not just the one that drives the most orders. A $5 threshold change can mean significant margin impact at scale.",
    readTime: "5 min",
    impact: "High",
    emoji: "🚚",
    gradientFrom: "#0369a1",
    gradientTo: "#4f46e5",
    cta: { label: "Create a Shipping Test", href: "/shipping-tests" },
    steps: [
      { title: "Know your current threshold and AOV", description: "Before testing, pull your current average order value from Analytics. Your test thresholds should bracket this number (one below, one at, one above)." },
      { title: "Create a Shipping Test", description: "Go to Shipping Tests, create a new experiment. Set up 2-3 variants with different free shipping thresholds." },
      { title: "Configure the delivery customization", description: "Each variant maps to a shipping rule: hide or rename the paid shipping option when the cart qualifies for the threshold." },
      { title: "Calculate your breakeven", description: "Know your average shipping cost. The winning threshold needs to generate enough additional revenue to offset any shipping cost increase." },
      { title: "Measure net revenue — not just orders", description: "More orders at a lower threshold can mean less profit. Use the profit analytics view to evaluate real impact." },
    ],
    results: [
      { label: "Net Revenue Lift",  value: "+5–15%",   icon: TrendingUp },
      { label: "AOV Impact",        value: "+$8–20",   icon: ShoppingCart },
      { label: "Setup Time",        value: "15 min",   icon: Clock },
    ],
    tips: [
      "Test in increments of $10-$20 to find the sensitivity curve for your audience.",
      "Different thresholds may perform differently by country — consider geo-targeted rules.",
      "Combine a free shipping threshold test with a progress bar offer for amplified results.",
      "Run the test for at least 2 weeks — shipping decisions are influenced by day-of-week behavior.",
    ],
  },

  "shipping-method-ab": {
    title: "Hide & Rename Shipping Methods",
    subtitle: "Shipping Test",
    description: "Test which shipping options shown at checkout lead to the highest completion rate — without changing your actual carrier rates. Hide expensive options, rename confusing ones, and measure the impact.",
    readTime: "4 min",
    impact: "Medium",
    emoji: "📬",
    gradientFrom: "#4f46e5",
    gradientTo: "#7c3aed",
    cta: { label: "Create a Shipping Test", href: "/shipping-tests" },
    steps: [
      { title: "Audit your current shipping options", description: "List every shipping method shown in checkout. Identify any that cause confusion (e.g. overlapping names) or friction (e.g. a very expensive express option)." },
      { title: "Design your variant rules", description: "Control = all shipping options shown. Variant B = hide the most expensive option. Variant C = rename 'Standard' to 'Free Standard Delivery'." },
      { title: "Create a Shipping Test", description: "In Shipping Tests, add per-variant operations: hide (by title keyword) and rename. The delivery customization function handles this at checkout." },
      { title: "Launch and monitor checkout completion", description: "Track checkout_completed rate per variant. Hiding a confusing option can meaningfully increase completion without changing actual costs." },
      { title: "Iterate on the winner", description: "Once you find the best combination, run a follow-up test refining the method names or adding a 'Most Popular' badge." },
    ],
    results: [
      { label: "Checkout CVR Lift", value: "+1–4%",    icon: TrendingUp },
      { label: "Choice Anxiety",    value: "Reduced",  icon: ShoppingCart },
      { label: "Setup Time",        value: "12 min",   icon: Clock },
    ],
    tips: [
      "Fewer shipping options = less decision paralysis. Two options often outperforms five.",
      "Rename carrier-branded methods (FedEx 2-Day) to customer-centric names (Arrives by Thursday).",
      "A/B test 'Free Shipping' vs '$0 Shipping' — different framing, measurably different perception.",
      "Check mobile vs. desktop separately — shipping method choice behavior differs significantly.",
    ],
  },

  // ── Pricing templates ───────────────────────────────────────────────────────

  "price-sensitivity": {
    title: "Price Sensitivity Test",
    subtitle: "Price Test",
    description: "Discover the optimal price point that balances conversion rate and revenue per visitor. A 10% price increase that drops conversion by only 5% is a net win — but you'll never know without testing.",
    readTime: "5 min",
    impact: "High",
    emoji: "💰",
    gradientFrom: "#d97706",
    gradientTo: "#ea580c",
    cta: { label: "Create a Price Test", href: "/price-tests" },
    steps: [
      { title: "Pick the right product to test", description: "Start with a mid-range product that gets at least 50-100 orders per month. Enough volume for results, low enough risk for a first test." },
      { title: "Choose your enforcement strategy", description: "Display Only shows the test price visually but charges the original. Shopify Function actually charges the test price. Use Function enforcement for real revenue data." },
      { title: "Set your price variants", description: "Control = current price. Test a range: -10% (conversion lift test) and +10% (margin expansion test). Run both simultaneously with a 3-way split." },
      { title: "Calculate breakeven before launching", description: "For a +10% price test: if CVR drops less than 9%, you're ahead. Use the in-app sample size calculator to know how long you need to run." },
      { title: "Evaluate profit — not just revenue", description: "A higher price with lower CVR may yield higher revenue per visitor AND higher profit per visitor. The profit analytics view shows both." },
    ],
    results: [
      { label: "Revenue Per Visitor Lift", value: "+5–25%",   icon: TrendingUp },
      { label: "Profit Margin Lift",       value: "+3–15%",   icon: ShoppingCart },
      { label: "Setup Time",               value: "10 min",   icon: Clock },
    ],
    tips: [
      "Never test more than a 20% price change as a first test — too large a jump creates noise.",
      "Run price tests for a full 2 weeks to capture weekend vs. weekday buyer behavior.",
      "Back up your original prices first (MarginLab does this automatically on rollout).",
      "Consider currency conversion effects if a significant portion of traffic is international.",
    ],
  },

  "compare-at-price": {
    title: "Compare-At Price Test",
    subtitle: "Price Test",
    description: "Test whether showing a crossed-out compare-at (was) price increases conversion and perceived value — a common pattern that works differently depending on your brand positioning.",
    readTime: "4 min",
    impact: "Medium",
    emoji: "🏷️",
    gradientFrom: "#ea580c",
    gradientTo: "#dc2626",
    cta: { label: "Create a Price Test", href: "/price-tests" },
    steps: [
      { title: "Understand compare-at semantics", description: "Shopify's compareAtPrice shows a strikethrough price above the actual price. It signals a discount or sale, even if the product was never sold at the higher price." },
      { title: "Define your variants", description: "Control = no compare-at price shown. Variant B = compare-at set to 20% above current price. Variant C = compare-at set to 10% above current price." },
      { title: "Use DISPLAY_ONLY enforcement", description: "For a compare-at test, select Display Only enforcement — you're testing the visual perception of value, not applying a real discount." },
      { title: "Watch for brand fit", description: "Compare-at prices work well for value/mass brands but can hurt premium/luxury brands. Your analytics will tell the story quickly." },
      { title: "Run for 2+ weeks and measure CVR + AOV", description: "Perceived value signals can lift conversion rate significantly, and sometimes also lift AOV if customers feel they're getting a deal." },
    ],
    results: [
      { label: "CVR Lift Range",    value: "+3–12%",   icon: TrendingUp },
      { label: "AOV Impact",        value: "Neutral",  icon: ShoppingCart },
      { label: "Setup Time",        value: "8 min",    icon: Clock },
    ],
    tips: [
      "Only use compare-at if the higher price reflects genuine historical pricing — consumer protection laws apply.",
      "Test on a category page tile and product page separately — the lift can differ.",
      "Luxury brands often see negative lift: discount signals undermine perceived exclusivity.",
      "Combine with a 'Sale ends Sunday' label to amplify urgency further.",
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
