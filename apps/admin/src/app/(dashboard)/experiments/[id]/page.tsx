import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "@/services/analytics.service";
import { ExperimentTabs } from "@/components/experiments/ExperimentTabs";
import { getSessionShop } from "@/lib/session-shop";
import { ChevronRight, Settings, Share2, LogOut } from "lucide-react";

const analyticsService = new AnalyticsService();

async function getExperimentDetails(shopDomain: string, id: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, currencyCode: true },
  });
  if (!shop) return null;

  const experiment = await prisma.experiment.findFirst({
    where: { id, shopId: shop.id },
    include: {
      variants: { orderBy: { isControl: "desc" } },
      mutuallyExclusiveGroup: true,
      _count: { select: { assignments: true, orderAttributions: true, events: true } },
    },
  });

  if (!experiment) return null;

  const analytics = await analyticsService.getExperimentAnalytics(shop.id, id);
  return { experiment, analytics, currencyCode: shop.currencyCode };
}

const TABS = [
  { key: "groups", label: "Test Groups" },
  { key: "modifications", label: "Modifications" },
  { key: "targeting", label: "Targeting" },
  { key: "preview", label: "Preview" },
  { key: "analytics-config", label: "Configure Analytics" },
  { key: "results", label: "Results" },
];

export default async function ExperimentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "groups" } = await searchParams;
  const shopDomain = await getSessionShop();
  const data = await getExperimentDetails(shopDomain, id);

  if (!data) return notFound();

  const { experiment, analytics, currencyCode } = data;

  // Short display name for breadcrumb/title
  const displayName = experiment.name;

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      {/* Top utility bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-100 bg-white">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Link href="/experiments" className="hover:text-neutral-600 transition-colors">
            Tests
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-neutral-600 truncate max-w-sm">{displayName}</span>
        </div>

        {/* Top-right icon buttons */}
        <div className="flex items-center gap-1.5">
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title + Save row */}
      <div className="flex items-start justify-between px-6 pt-4 pb-2 bg-white">
        <h1 className="text-lg font-semibold text-neutral-900 leading-tight">
          {displayName}
        </h1>
        <button
          className="px-5 py-2 text-sm font-semibold text-white rounded-lg shrink-0 hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
        >
          Save
        </button>
      </div>

      {/* All Visitors badge */}
      <div className="px-6 pb-2 bg-white">
        <button className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors">
          All Visitors
        </button>
      </div>

      {/* Tab navigation */}
      <div className="px-6 bg-white border-b border-neutral-100">
        <nav className="flex items-center gap-0 -mb-px">
          {TABS.map((t) => {
            const label =
              t.key === "groups"
                ? `Test Groups (${experiment.variants.length})`
                : t.label;
            const active = tab === t.key;
            // Results is greyed/disabled when no data
            const noData = t.key === "results" && !analytics;
            return (
              <Link
                key={t.key}
                href={`/experiments/${id}?tab=${t.key}`}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-brand-600 text-brand-700 font-semibold"
                    : noData
                    ? "border-transparent text-neutral-300 cursor-default"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content — white bg */}
      <ExperimentTabs
        tab={tab}
        experiment={experiment}
        analytics={analytics}
        currencyCode={currencyCode}
      />
    </div>
  );
}
