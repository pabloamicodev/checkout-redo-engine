import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, FlaskConical, ArrowRight } from "lucide-react";
import { getSessionShop } from "@/lib/session-shop";
import { CreateTestModal } from "@/components/experiments/CreateTestModal";
import { getStatusTheme } from "@/lib/design/statusTheme";
import { getTestTypeTheme } from "@/lib/design/testTypeTheme";


export const dynamic = 'force-dynamic';
const TYPE_LABELS: Record<string, string> = {
  PRICE_TEST: "Pricing+",
  DISCOUNT_TEST: "Discount",
  SHIPPING_TEST: "Shipping+",
  OFFER_TEST: "Offer",
  COMBINATION_TEST: "Combination",
  CONTENT_TEST: "Content",
  SPLIT_URL: "Split URL",
  SPLIT_URL_TEST: "Split URL",
  TEMPLATE_TEST: "Template",
  THEME_TEST: "Theme",
  CHECKOUT_TEST: "Checkout",
  PERSONALIZATION_TEST: "Personalization",
  JAVASCRIPT_API_TEST: "JS API",
};

async function getExperiments(shopDomain: string, status?: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!shop) return { experiments: [], total: 0 };

  const statusFilter = status && status !== "all" ? { status: status as never } : {};

  const [experiments, total] = await prisma.$transaction([
    prisma.experiment.findMany({
      where: {
        shopId: shop.id,
        ...statusFilter,
        status: { not: "ARCHIVED" },
      },
      include: {
        variants: { select: { id: true } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.experiment.count({
      where: { shopId: shop.id, status: { not: "ARCHIVED" } },
    }),
  ]);

  return { experiments, total };
}

function daysRunning(launchedAt: Date | null): string {
  if (!launchedAt) return "—";
  const days = Math.floor((Date.now() - new Date(launchedAt).getTime()) / 86400000);
  return `${days}d`;
}

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const shopDomain = await getSessionShop();
  const { status } = await searchParams;
  const { experiments, total } = await getExperiments(shopDomain, status);
  type ExperimentRow = (typeof experiments)[number];

  const statusFilters = [
    { label: "All", value: "all" },
    { label: "Active", value: "RUNNING" },
    { label: "Draft", value: "DRAFT" },
    { label: "Paused", value: "PAUSED" },
    { label: "Ended", value: "COMPLETED" },
  ];

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Tests</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{total} total</p>
          </div>
          <CreateTestModal>
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
            >
              <Plus className="w-4 h-4" />
              New Test
            </button>
          </CreateTestModal>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4">
          {statusFilters.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/experiments" : `/experiments?status=${f.value}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                (status ?? "all") === f.value
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {experiments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <FlaskConical className="w-5 h-5 text-brand-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700 mb-1">No tests yet</p>
              <p className="text-xs text-neutral-400 mb-4">
                Create your first A/B test to start optimizing your store
              </p>
              <CreateTestModal>
                <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}>
                  Create Test
                </Button>
              </CreateTestModal>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Visitors</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Start</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Runtime</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp: ExperimentRow) => {
                  const statusTheme = getStatusTheme(exp.status);
                  const typeTheme = getTestTypeTheme(exp.type);
                  return (
                    <tr key={exp.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeTheme.dotHex }} />
                          <Link href={`/experiments/${exp.id}`} className="font-medium text-neutral-800 hover:text-brand-600 transition-colors">
                            {exp.name}
                          </Link>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5 pl-4">{exp.variants.length} variants</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full border font-medium"
                          style={{
                            background: `${typeTheme.hex}10`,
                            color: typeTheme.hex,
                            borderColor: `${typeTheme.hex}25`,
                          }}
                        >
                          {TYPE_LABELS[exp.type] ?? exp.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-600 tabular-nums text-xs">
                        {exp._count.assignments.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-600 tabular-nums text-xs">
                        {exp._count.orderAttributions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-400 text-xs">
                        {exp.launchedAt
                          ? new Date(exp.launchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-400 text-xs">
                        {daysRunning(exp.launchedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: statusTheme.hex }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusTheme.hex }} />
                          {statusTheme.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/experiments/${exp.id}`}>
                          <button className="p-1 text-neutral-300 hover:text-neutral-600 rounded transition-colors opacity-0 group-hover:opacity-100">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
