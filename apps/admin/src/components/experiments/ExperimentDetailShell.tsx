import Link from "next/link";
import { ChevronLeft, Users, TrendingUp, Layers, Activity, CalendarDays, Download } from "lucide-react";
import { ExperimentTabs } from "./ExperimentTabs";
import { ExperimentActions } from "./ExperimentActions";
import { ExperimentGuardBanners } from "./ExperimentGuardBanners";
import type { ExperimentAnalytics } from "@/services/analytics.service";
import { getTestTypeTheme } from "@/lib/design/testTypeTheme";
import { getStatusTheme } from "@/lib/design/statusTheme";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "groups",           label: "Test Groups" },
  { key: "modifications",    label: "Modifications" },
  { key: "targeting",        label: "Targeting" },
  { key: "preview",          label: "Preview" },
  { key: "analytics-config", label: "Analytics" },
  { key: "qa",               label: "QA / Health" },
  { key: "results",          label: "Results" },
];

export interface Variant {
  id: string;
  name: string;
  key: string;
  isControl: boolean;
  allocationPercent: number;
  redirectUrl?: string | null;
  modifications?: unknown;
  priceOverrides?: unknown;
  discountConfig?: unknown;
  settings?: unknown;
}

export interface Experiment {
  id: string;
  name: string;
  type: string;
  status: string;
  slug: string;
  hypothesis: string | null;
  primaryMetric: string;
  trafficAllocation: number;
  assignmentStrategy: string;
  launchedAt: Date | null;
  variants: Variant[];
  mutuallyExclusiveGroup: { name: string } | null;
  _count: { assignments: number; orderAttributions: number; events: number };
  contentConfig?: unknown;
  splitUrlConfig?: unknown;
  priceConfig?: unknown;
  discountConfig?: unknown;
  shippingConfig?: unknown;
  targetingRules?: unknown;
  settings?: unknown;
}

interface Props {
  experiment: Experiment;
  analytics: ExperimentAnalytics | null;
  currencyCode: string;
  shopDomain?: string;
  tab: string;
  breadcrumb: { href: string; label: string };
}

export function ExperimentDetailShell({ experiment, analytics, currencyCode, shopDomain, tab, breadcrumb }: Props) {
  const st = getStatusTheme(experiment.status);
  const tt = getTestTypeTheme(experiment.type);
  const isRunning = experiment.status === "RUNNING";

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">

      {/* Gradient hero header */}
      <div
        className="px-6 pt-5 pb-0 border-b border-neutral-100"
        style={{ background: `linear-gradient(160deg, ${tt.hex}0d 0%, ${tt.hex}05 60%, #fff 100%)` }}
      >
        {/* Breadcrumb */}
        <Link
          href={breadcrumb.href}
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {breadcrumb.label}
        </Link>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Type icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base font-bold"
              style={{ background: `${tt.hex}15`, color: tt.hex }}
            >
              {tt.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-neutral-900 leading-tight">{experiment.name}</h1>
                {/* Status badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0"
                  style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
                >
                  <span
                    className={cn("w-1.5 h-1.5 rounded-full shrink-0", isRunning && "animate-pulse")}
                    style={{ background: st.hex }}
                  />
                  {st.label}
                </span>
                {/* Type label */}
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${tt.hex}10`, color: tt.hex }}
                >
                  {tt.shortLabel}
                </span>
              </div>
              {experiment.hypothesis && (
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed max-w-2xl line-clamp-2">
                  {experiment.hypothesis}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <ExperimentActions experimentId={experiment.id} status={experiment.status} accentHex={tt.hex} />
          </div>
        </div>

        {/* Stat cards row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <StatPill icon={<Layers className="w-3 h-3" />} label="Variants" value={experiment.variants.length} accent={tt.hex} />
          <StatPill icon={<TrendingUp className="w-3 h-3" />} label="Traffic" value={`${experiment.trafficAllocation}%`} accent={tt.hex} />
          <StatPill icon={<Users className="w-3 h-3" />} label="Assignments" value={experiment._count.assignments.toLocaleString()} accent={tt.hex} />
          <StatPill icon={<Activity className="w-3 h-3" />} label="Events" value={experiment._count.events.toLocaleString()} accent={tt.hex} />
          {experiment.launchedAt && (
            <StatPill
              icon={<CalendarDays className="w-3 h-3" />}
              label="Launched"
              value={new Date(experiment.launchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              accent={tt.hex}
            />
          )}
          {experiment.mutuallyExclusiveGroup && (
            <span className="text-xs text-neutral-400 px-2 py-1 rounded-lg bg-neutral-100 border border-neutral-200">
              Group: {experiment.mutuallyExclusiveGroup.name}
            </span>
          )}
        </div>

        {/* Summary metric cards */}
        <SummaryCardsSection experiment={experiment} analytics={analytics} accentHex={tt.hex} />

        {/* Type-specific summary banner */}
        <TypeSummaryStrip experiment={experiment} accentHex={tt.hex} />

        {/* Tab navigation */}
        <nav className="flex items-center gap-0 -mb-px mt-3">
          {TABS.map((t) => {
            const label = t.key === "groups"
              ? `Groups (${experiment.variants.length})`
              : t.label;
            const active = tab === t.key;
            const noData = t.key === "results" && !analytics;
            return (
              <Link
                key={t.key}
                href={`${breadcrumb.href}/${experiment.id}?tab=${t.key}`}
                className={cn(
                  "px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap",
                  active
                    ? "font-semibold text-neutral-900"
                    : noData
                    ? "border-transparent text-neutral-300 cursor-default pointer-events-none"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                )}
                style={active ? { borderBottomColor: tt.hex, color: tt.hex } : {}}
                title={noData ? "No data yet — run the test longer" : undefined}
                aria-disabled={noData || undefined}
              >
                {label}
              </Link>
            );
          })}

          {/* Spacer + Export CSV button (shown when analytics data is available) */}
          {analytics && (
            <div className="ml-auto pl-3 pb-1 flex items-center shrink-0">
              <a
                href={`/api/analytics/export?type=experiment&experimentId=${experiment.id}`}
                download={`${experiment.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-analytics.csv`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-neutral-500 border border-neutral-200 bg-white hover:bg-neutral-50 hover:text-neutral-700 hover:border-neutral-300 transition-colors"
                title="Download analytics data as CSV"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </a>
            </div>
          )}
        </nav>
      </div>

      {/* Type-specific guard banners */}
      <ExperimentGuardBanners type={experiment.type} status={experiment.status} experiment={experiment} />

      {/* Tab content */}
      <ExperimentTabs
        tab={tab}
        experiment={experiment}
        analytics={analytics}
        currencyCode={currencyCode}
        shopDomain={shopDomain}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// SUMMARY CARDS SECTION
// ─────────────────────────────────────────────
function SummaryCardsSection({ experiment, analytics, accentHex }: {
  experiment: Experiment;
  analytics: ExperimentAnalytics | null;
  accentHex: string;
}) {
  const cards = buildSummaryCards(experiment, analytics);
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
      {cards.map((card, i) => (
        <div key={i} className="bg-white/80 rounded-lg border border-neutral-100 px-3 py-2.5">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide truncate">{card.label}</p>
          <p className="text-sm font-semibold text-neutral-800 mt-0.5 truncate" style={card.accent ? { color: accentHex } : {}}>
            {card.value}
          </p>
          {card.sub && <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
}

type SummaryCard = { label: string; value: string; sub?: string; accent?: boolean };

function buildSummaryCards(experiment: Experiment, analytics: ExperimentAnalytics | null): SummaryCard[] {
  const type = experiment.type;
  const totalAssignments = experiment._count.assignments;
  const totalOrders = analytics?.summary.totalOrders ?? 0;
  const cvr = totalAssignments > 0 && totalOrders > 0
    ? `${((totalOrders / totalAssignments) * 100).toFixed(2)}%`
    : "No data";

  // Find leading variant by CVR
  const leader = analytics?.variants.reduce((best, v) =>
    v.conversionRate > (best?.conversionRate ?? -1) ? v : best, analytics.variants[0]);

  if (type === "CONTENT_TEST") {
    const cfg = experiment.contentConfig as Record<string, unknown> | null | undefined;
    const urlPattern = cfg?.urlPattern as string | undefined;

    // Count mods and assess selector health (non-empty selector = healthy)
    let totalMods = 0;
    let healthySelectors = 0;
    for (const v of experiment.variants) {
      const mods = v.modifications as Array<Record<string, unknown>> | null | undefined;
      if (Array.isArray(mods)) {
        totalMods += mods.length;
        for (const m of mods) {
          if (m.selector && String(m.selector).trim().length > 0) healthySelectors++;
        }
      }
    }
    const selectorHealth = totalMods === 0 ? "No mods" : `${healthySelectors}/${totalMods} valid`;

    return [
      { label: "Target Pages", value: urlPattern ? String(urlPattern) : "All pages" },
      { label: "Active Modifications", value: String(totalMods), accent: totalMods > 0 },
      { label: "Selector Health", value: selectorHealth, accent: healthySelectors === totalMods && totalMods > 0 },
      { label: "Anti-flicker", value: "Unknown", sub: "Check install health" },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
      { label: "Conversion Rate", value: cvr },
    ];
  }

  if (type === "SPLIT_URL_TEST") {
    const splitCfg = experiment.splitUrlConfig as Record<string, unknown> | null | undefined;
    const controlUrl = splitCfg?.baseUrl as string | undefined;
    const variantCount = experiment.variants.filter(v => !v.isControl).length;

    const nonControlUrls = experiment.variants
      .filter(v => !v.isControl)
      .map(v => (v as unknown as { redirectUrl?: string }).redirectUrl)
      .filter(Boolean) as string[];
    const hasDuplicates = new Set(nonControlUrls).size !== nonControlUrls.length;
    const hasAllUrls = !!controlUrl && experiment.variants.filter(v => !v.isControl).every(
      v => !!(v as unknown as { redirectUrl?: string }).redirectUrl
    );
    const redirectHealth = !hasAllUrls ? "⚠ URL Missing" : hasDuplicates ? "⚠ Duplicates" : "OK";

    const loopProtection = splitCfg?.loopProtection as boolean | undefined;

    return [
      { label: "Control URL", value: controlUrl ? String(controlUrl) : "Not set" },
      { label: "Variant Count", value: String(variantCount) },
      { label: "Redirect Health", value: redirectHealth, accent: redirectHealth === "OK" },
      { label: "Loop Protection", value: loopProtection === true ? "Enabled ✓" : loopProtection === false ? "Disabled ✗" : "Unknown", accent: loopProtection === true },
      { label: "Landing CVR", value: cvr },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
    ];
  }

  if (type === "OFFER_TEST") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const offerType = cfg?.offerType as string | undefined;
    const placements = cfg?.placements as unknown[] | undefined;

    // Claim rate: orders / assignments (offers claimed / visitors exposed)
    const claimRate = totalAssignments > 0 && totalOrders > 0
      ? `${((totalOrders / totalAssignments) * 100).toFixed(1)}%`
      : "No data";

    // Revenue influenced
    const totalRevenue = analytics?.summary.totalRevenue ?? 0;
    const revenueStr = totalRevenue > 0
      ? totalRevenue >= 10000
        ? `$${(totalRevenue / 1000).toFixed(0)}k`
        : `$${totalRevenue.toFixed(0)}`
      : "No data";

    const cartDisplay = Array.isArray(placements) && placements.length > 0
      ? `${placements.length} placement${placements.length > 1 ? "s" : ""}`
      : "Not set";

    return [
      { label: "Offer Type", value: offerType ? offerType.replace(/_/g, " ") : "Not set" },
      { label: "Claim Rate", value: claimRate, accent: totalOrders > 0 },
      { label: "Revenue Influenced", value: revenueStr, accent: totalRevenue > 0 },
      { label: "Cart Display", value: cartDisplay, accent: Array.isArray(placements) && placements.length > 0 },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
    ];
  }

  if (type === "CHECKOUT_TEST") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const blockType = cfg?.blockType as string | undefined;
    const placement = cfg?.placement as string | undefined;
    const extensionInstalled = cfg?.extensionInstalled as boolean | undefined;
    const extensionHealth = extensionInstalled === true
      ? "Installed ✓"
      : extensionInstalled === false
      ? "Not Installed ✗"
      : experiment._count.events > 0 ? "Active" : "Unknown";
    return [
      { label: "Block Type", value: blockType ? blockType.replace(/_/g, " ") : "Not set" },
      { label: "Placement", value: placement ? placement.replace(/_/g, " ") : "Not set" },
      { label: "Extension Health", value: extensionHealth, accent: extensionInstalled === true || experiment._count.events > 0 },
      { label: "Block Impressions", value: experiment._count.events.toLocaleString() },
      { label: "Checkout CVR", value: cvr },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
    ];
  }

  if (type === "DISCOUNT_TEST") {
    const cfg = experiment.discountConfig as Record<string, unknown> | null | undefined;
    const discountType = cfg?.discountType as string | undefined;
    const stacking = cfg?.stacking as string | undefined;
    const functionDeployed = cfg?.functionDeployed as boolean | undefined;
    const functionHealth = functionDeployed === true ? "Deployed ✓" : functionDeployed === false ? "Not Deployed ✗" : "Unknown";
    const bestNonControl = analytics
      ? analytics.variants.filter(v => !v.isControl).sort((a, b) => (b.revenuePerVisitorTest?.relativeLift ?? -Infinity) - (a.revenuePerVisitorTest?.relativeLift ?? -Infinity))[0]
      : undefined;
    const revLift = bestNonControl?.revenuePerVisitorTest?.relativeLift;
    return [
      { label: "Discount Type", value: discountType ? discountType.replace(/_/g, " ") : "Not set" },
      { label: "Stacking", value: stacking ? stacking.replace(/_/g, " ") : "Not set" },
      { label: "Revenue Lift", value: revLift != null ? `${revLift >= 0 ? "+" : ""}${(revLift * 100).toFixed(1)}%` : "No data", accent: (revLift ?? 0) > 0 },
      { label: "Function Health", value: functionHealth, accent: functionDeployed === true },
      { label: "Total Orders", value: String(totalOrders) },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
    ];
  }

  if (type === "SHIPPING_TEST") {
    const cfg = experiment.shippingConfig as Record<string, unknown> | null | undefined;
    const strategy = cfg?.strategy as string | undefined;
    const threshold = cfg?.threshold as number | undefined;
    const method = cfg?.method as string | undefined;
    const functionDeployed = cfg?.functionDeployed as boolean | undefined;
    const functionHealth = functionDeployed === true ? "Deployed ✓" : functionDeployed === false ? "Not Deployed ✗" : "Unknown";
    const bestNonControl = analytics
      ? analytics.variants.filter(v => !v.isControl).sort((a, b) =>
          (b.revenuePerVisitorTest?.relativeLift ?? -Infinity) - (a.revenuePerVisitorTest?.relativeLift ?? -Infinity))[0]
      : undefined;
    const rpvLift = bestNonControl?.revenuePerVisitorTest?.relativeLift;
    return [
      { label: "Strategy", value: strategy ? strategy.replace(/_/g, " ") : "Not set" },
      { label: "Threshold / Method", value: threshold != null ? `$${threshold}` : method ? method : "—" },
      { label: "Shipping Rev. Impact", value: rpvLift != null ? `${rpvLift >= 0 ? "+" : ""}${(rpvLift * 100).toFixed(1)}%` : "No data", accent: (rpvLift ?? 0) > 0 },
      { label: "Function Health", value: functionHealth, accent: functionDeployed === true },
      { label: "Total Orders", value: String(totalOrders) },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
    ];
  }

  if (type === "PRICE_TEST") {
    const cfg = experiment.priceConfig as Record<string, unknown> | null | undefined;
    const productCount = experiment.variants.reduce((max, v) => {
      const overrides = v.priceOverrides as unknown[] | null | undefined;
      return Math.max(max, Array.isArray(overrides) ? overrides.length : 0);
    }, 0);
    const riskConfirmed = cfg?.riskConfirmed as boolean | undefined;
    const rolloutState = cfg?.rolloutState as string | undefined;
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    for (const v of experiment.variants) {
      const overrides = v.priceOverrides as Array<Record<string, unknown>> | null | undefined;
      if (Array.isArray(overrides)) {
        for (const o of overrides) {
          const p = o.price as number | undefined;
          if (p != null) {
            if (minPrice == null || p < minPrice) minPrice = p;
            if (maxPrice == null || p > maxPrice) maxPrice = p;
          }
        }
      }
    }
    const priceRange = minPrice != null && maxPrice != null
      ? minPrice === maxPrice ? `$${minPrice}` : `$${minPrice}–$${maxPrice}`
      : "No data";
    const bestNonControl = analytics
      ? analytics.variants.filter(v => !v.isControl).sort((a, b) =>
          (b.profitPerVisitor ?? -Infinity) - (a.profitPerVisitor ?? -Infinity))[0]
      : undefined;
    const ppv = bestNonControl?.profitPerVisitor;
    return [
      { label: "Product Count", value: String(productCount) },
      { label: "Price Range", value: priceRange },
      { label: "Risk Level", value: riskConfirmed ? "Confirmed ✓" : "Pending ⚠", accent: riskConfirmed },
      { label: "Profit / Visitor", value: ppv != null ? `$${ppv.toFixed(2)}` : "No data", accent: (ppv ?? 0) > 0 },
      { label: "Assignments", value: totalAssignments.toLocaleString() },
      { label: "Rollout State", value: rolloutState ? rolloutState.replace(/_/g, " ") : "Not set" },
    ];
  }

  if (type === "PERSONALIZATION") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const audienceRules = cfg?.audienceRules as unknown[] | undefined;
    const priority = cfg?.priority as number | string | undefined;
    const scheduleStatus = (cfg?.scheduleStatus ?? cfg?.schedule) as string | undefined;
    const offerCount = experiment.variants.reduce((sum, v) => {
      const vs = v.settings as Record<string, unknown> | null | undefined;
      const offers = vs?.offers as unknown[] | undefined;
      return sum + (Array.isArray(offers) ? offers.length : 0);
    }, 0);
    return [
      { label: "Audience Rules", value: Array.isArray(audienceRules) ? `${audienceRules.length} rule${audienceRules.length !== 1 ? "s" : ""}` : "Not set" },
      { label: "Priority", value: priority != null ? String(priority) : "—" },
      { label: "Impressions", value: experiment._count.events.toLocaleString() },
      { label: "Offer Count", value: String(offerCount) },
      { label: "Schedule Status", value: scheduleStatus ? scheduleStatus.replace(/_/g, " ") : "No schedule" },
      { label: "Current Leader", value: leader?.variantName ?? "No data" },
    ];
  }

  // Generic fallback
  return [
    { label: "Variants", value: String(experiment.variants.length) },
    { label: "Assignments", value: totalAssignments.toLocaleString() },
    { label: "Events", value: experiment._count.events.toLocaleString() },
    { label: "Conversion Rate", value: cvr },
  ];
}

// ─────────────────────────────────────────────
// TYPE-SPECIFIC SUMMARY STRIP
// ─────────────────────────────────────────────
function TypeSummaryStrip({ experiment, accentHex }: { experiment: Experiment; accentHex: string }) {
  const chips = buildSummaryChips(experiment);
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
          style={{ background: `${accentHex}08`, color: accentHex, borderColor: `${accentHex}20` }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function buildSummaryChips(experiment: Experiment): string[] {
  const type = experiment.type;

  if (type === "CONTENT_TEST") {
    const cfg = experiment.contentConfig as Record<string, unknown> | null | undefined;
    const urlPattern = cfg?.urlPattern as string | undefined;
    const totalMods = experiment.variants.reduce((sum, v) => {
      const mods = v.modifications as unknown[];
      return sum + (Array.isArray(mods) ? mods.length : 0);
    }, 0);
    const chips: string[] = [];
    if (urlPattern) chips.push(`URL: ${urlPattern}`);
    chips.push(`Modifications: ${totalMods} total`);
    return chips;
  }

  if (type === "SPLIT_URL_TEST") {
    const cfg = experiment.splitUrlConfig as Record<string, unknown> | null | undefined;
    const variantB = experiment.variants.find((v) => !v.isControl);
    const controlUrl = cfg?.baseUrl as string | undefined;
    const variantUrl = (variantB as unknown as { redirectUrl?: string })?.redirectUrl;
    const chips: string[] = [];
    if (controlUrl) chips.push(`Control: ${controlUrl}`);
    if (variantUrl) chips.push(`Variant: ${variantUrl}`);
    return chips;
  }

  if (type === "PRICE_TEST") {
    const cfg = experiment.priceConfig as Record<string, unknown> | null | undefined;
    const enforcement = cfg?.enforcement as string | undefined;
    const productCount = experiment.variants.reduce((max, v) => {
      const overrides = v.priceOverrides as unknown[];
      return Math.max(max, Array.isArray(overrides) ? overrides.length : 0);
    }, 0);
    const riskConfirmed = cfg?.riskConfirmed as boolean | undefined;
    const chips: string[] = [];
    if (productCount > 0) chips.push(`Products: ${productCount}`);
    if (enforcement) chips.push(`Enforcement: ${formatEnforcement(enforcement)}`);
    if (riskConfirmed) chips.push("Risk: Confirmed ✓");
    return chips;
  }

  if (type === "DISCOUNT_TEST") {
    const cfg = experiment.discountConfig as Record<string, unknown> | null | undefined;
    const discountType = cfg?.discountType as string | undefined;
    const stacking = cfg?.stacking as string | undefined;
    const chips: string[] = [];
    if (discountType) chips.push(`Type: ${formatLabel(discountType)}`);
    if (stacking) chips.push(`Stacking: ${formatLabel(stacking)}`);
    return chips;
  }

  if (type === "SHIPPING_TEST") {
    const cfg = experiment.shippingConfig as Record<string, unknown> | null | undefined;
    const strategy = cfg?.strategy as string | undefined;
    const threshold = cfg?.threshold as number | undefined;
    const chips: string[] = [];
    if (strategy) chips.push(`Strategy: ${formatLabel(strategy)}`);
    if (threshold != null) chips.push(`Threshold: $${threshold}`);
    return chips;
  }

  if (type === "OFFER_TEST") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const offerType = cfg?.offerType as string | undefined;
    const placements = cfg?.placements as unknown[] | undefined;
    const chips: string[] = [];
    if (offerType) chips.push(`Offer Type: ${formatLabel(offerType)}`);
    if (Array.isArray(placements)) chips.push(`Placements: ${placements.length}`);
    return chips;
  }

  if (type === "CHECKOUT_TEST") {
    const cfg = experiment.settings as Record<string, unknown> | null | undefined;
    const blockType = cfg?.blockType as string | undefined;
    const placement = cfg?.placement as string | undefined;
    const chips: string[] = [];
    if (blockType) chips.push(`Block: ${formatLabel(blockType)}`);
    if (placement) chips.push(`Placement: ${formatLabel(placement)}`);
    return chips;
  }

  return [];
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEnforcement(s: string): string {
  if (s === "DISPLAY_ONLY") return "Display Only";
  if (s === "FUNCTION") return "Function (Enforced)";
  return formatLabel(s);
}

// ─────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-100 text-xs">
      <span style={{ color: accent }}>{icon}</span>
      <span className="text-neutral-400">{label}</span>
      <span className="font-semibold text-neutral-700">{value}</span>
    </div>
  );
}
