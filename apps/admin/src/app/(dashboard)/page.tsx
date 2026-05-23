import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { getSessionShop } from "@/lib/session-shop";
import { CreateTestModal } from "@/components/experiments/CreateTestModal";
import { QuickLaunchPanel } from "@/components/dashboard/QuickLaunchPanel";
import { getTestTypeTheme } from "@/lib/design/testTypeTheme";
import { getStatusTheme } from "@/lib/design/statusTheme";
import {
  Plus,
  ArrowRight,
  TrendingUp,
  FlaskConical,
  DollarSign,
  Users,
  ChevronRight,
  Activity,
  Lightbulb,
} from "lucide-react";


export const dynamic = 'force-dynamic';

type DashboardExperiment = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>["shop"]["experiments"][number];
async function getDashboardData(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: {
      experiments: {
        where: { status: { not: "ARCHIVED" } },
        include: {
          variants: true,
          _count: { select: { assignments: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      },
    },
  });

  if (!shop) return null;

  const [runningCount, draftCount, totalRevenue, totalAssignments] = await Promise.all([
    prisma.experiment.count({ where: { shopId: shop.id, status: "RUNNING" } }),
    prisma.experiment.count({ where: { shopId: shop.id, status: "DRAFT" } }),
    prisma.orderAttribution.aggregate({
      where: { shopId: shop.id },
      _sum: { netRevenue: true },
    }),
    prisma.experimentAssignment.count({ where: { shopId: shop.id } }),
  ]);

  return {
    shop,
    stats: {
      runningCount,
      draftCount,
      totalRevenue: totalRevenue._sum.netRevenue ?? 0,
      totalAssignments,
    },
  };
}

function daysRunning(launchedAt: Date | null): string {
  if (!launchedAt) return "—";
  const days = Math.floor((Date.now() - new Date(launchedAt).getTime()) / 86400000);
  return `${days}d`;
}


export default async function DashboardPage() {
  const shopDomain = await getSessionShop();
  const data = await getDashboardData(shopDomain);

  if (!data) {
    return (
      <div className="flex-1 p-8">
        <p className="text-sm text-neutral-500">Shop not configured. Complete installation first.</p>
      </div>
    );
  }

  const { stats, shop } = data;
  const activeTests = shop.experiments.filter((e: DashboardExperiment) => e.status === "RUNNING");
  const otherTests = shop.experiments.filter((e: DashboardExperiment) => e.status !== "RUNNING");

  return (
    <div className="flex-1 overflow-auto" style={{ background: "#F8FAFC" }}>
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
              Good morning 👋
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">{shop.shopDomain}</p>
          </div>
          <CreateTestModal>
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-150 hover:opacity-90 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                boxShadow: "0 1px 3px rgb(99 102 241 / 0.3), 0 0 0 1px rgb(99 102 241 / 0.2)",
              }}
            >
              <Plus className="w-4 h-4" />
              New Test
            </button>
          </CreateTestModal>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Active Tests"
            value={stats.runningCount.toString()}
            icon={<Activity className="w-4 h-4" />}
            iconColor="#6366f1"
            iconBg="rgba(99,102,241,0.1)"
            subtext={`${stats.draftCount} in draft`}
          />
          <MetricCard
            label="Revenue Influenced"
            value={formatCurrency(stats.totalRevenue)}
            icon={<DollarSign className="w-4 h-4" />}
            iconColor="#10b981"
            iconBg="rgba(16,185,129,0.1)"
            subtext="All time"
          />
          <MetricCard
            label="Participants"
            value={stats.totalAssignments >= 1000
              ? `${(stats.totalAssignments / 1000).toFixed(1)}k`
              : stats.totalAssignments.toString()
            }
            icon={<Users className="w-4 h-4" />}
            iconColor="#0ea5e9"
            iconBg="rgba(14,165,233,0.1)"
            subtext="Total assigned"
          />
          <MetricCard
            label="Tests Completed"
            value={shop.experiments.filter((e: DashboardExperiment) => e.status === "COMPLETED").length.toString()}
            icon={<TrendingUp className="w-4 h-4" />}
            iconColor="#f59e0b"
            iconBg="rgba(245,158,11,0.1)"
            subtext="Insights gained"
          />
        </div>

        {/* Active tests + Quick create row */}
        <div className="grid grid-cols-3 gap-5">

          {/* Active tests panel — 2/3 width */}
          <div className="col-span-2 bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse-soft" />
                <span className="text-sm font-semibold text-neutral-800">Active tests</span>
                {stats.runningCount > 0 && (
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}
                  >
                    {stats.runningCount}
                  </span>
                )}
              </div>
              <Link
                href="/experiments"
                className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-brand-600 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {activeTests.length === 0 ? (
              <div className="py-14 text-center">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(99,102,241,0.06)" }}
                >
                  <FlaskConical className="w-5 h-5 text-brand-400" />
                </div>
                <p className="text-sm font-medium text-neutral-600 mb-1">No active tests</p>
                <p className="text-xs text-neutral-400 mb-4">Launch your first test to start optimizing</p>
                <CreateTestModal>
                  <button
                    className="px-4 py-2 text-xs font-semibold text-white rounded-lg"
                    style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
                  >
                    Create Test
                  </button>
                </CreateTestModal>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {(activeTests as DashboardExperiment[]).map((exp) => {
                  const typeTheme = getTestTypeTheme(exp.type);
                  return (
                    <Link
                      key={exp.id}
                      href={`/experiments/${exp.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-neutral-50 transition-colors group"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: typeTheme.dotHex }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-brand-600 transition-colors">
                          {exp.name}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {exp.variants.length} variants · {exp._count.assignments.toLocaleString()} participants
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-neutral-500">{daysRunning(exp.launchedAt)}</p>
                        <p className="text-[10px] text-neutral-300">running</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-200 group-hover:text-neutral-400 transition-colors shrink-0" />
                    </Link>
                  );
                })}

                {(otherTests.slice(0, 3) as DashboardExperiment[]).map((exp) => {
                  const statusTheme = getStatusTheme(exp.status);
                  return (
                    <Link
                      key={exp.id}
                      href={`/experiments/${exp.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-neutral-50 transition-colors group"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 opacity-40"
                        style={{ background: statusTheme.hex }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-500 truncate group-hover:text-neutral-700 transition-colors">
                          {exp.name}
                        </p>
                        <p className="text-xs text-neutral-300 mt-0.5">
                          {statusTheme.label}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-100 group-hover:text-neutral-300 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions panel — 1/3 width */}
          <QuickLaunchPanel />
        </div>

        {/* Get inspired callout */}
        <Link href="/get-inspired">
          <div
            className="flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-all duration-150 hover:opacity-95"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
              border: "1px solid #2d2d6b",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.2)" }}
              >
                <Lightbulb className="w-4.5 h-4.5 text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Need test ideas?</p>
                <p className="text-xs text-slate-400">Explore our curated library of high-impact experiments</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-300">
              Get inspired <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  iconColor,
  iconBg,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  subtext: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-neutral-900 tracking-tight">{value}</p>
      <p className="text-xs text-neutral-400 mt-1">{subtext}</p>
    </div>
  );
}
