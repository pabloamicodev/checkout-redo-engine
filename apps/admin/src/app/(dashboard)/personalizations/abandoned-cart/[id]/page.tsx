import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { AbandonedCartService } from "@/services/abandoned-cart.service";
import { getSessionShop } from "@/lib/session-shop";
import { prisma } from "@/lib/prisma";
import { AbandonedCartItemActions } from "@/components/personalizations/AbandonedCartItemActions";
import { getStatusTheme } from "@/lib/design/statusTheme";

export const metadata = { title: "Abandoned Cart Recovery — MarginLab" };

const svc = new AbandonedCartService();

export default async function AbandonedCartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shopDomain = await getSessionShop();

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!shop) return notFound();

  let item: Awaited<ReturnType<typeof svc.get>>;
  let analytics: Awaited<ReturnType<typeof svc.getAnalytics>>;

  try {
    [item, analytics] = await Promise.all([
      svc.get(shop.id, id),
      svc.getAnalytics(shop.id, id),
    ]);
  } catch {
    return notFound();
  }

  const st = getStatusTheme(item.status);
  const modifications = item.modifications as Record<string, unknown>[];
  const targeting = item.targetingRules as Record<string, unknown>[];
  const mod = modifications[0] ?? {};

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Link href="/personalizations/abandoned-cart" className="hover:text-neutral-600 transition-colors">
            Abandoned Cart
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-neutral-600 truncate max-w-sm">{item.name}</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-4 pb-3 bg-white border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-neutral-400" />
            <h1 className="text-lg font-semibold text-neutral-900">{item.name}</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
              style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.hex }} />
              {st.label}
            </span>
          </div>
          <p className="text-xs text-neutral-500">Priority: {item.priority}</p>
        </div>
        <AbandonedCartItemActions itemId={item.id} status={item.status} />
      </div>

      {/* Analytics row */}
      <div className="px-6 py-3 grid grid-cols-4 gap-4 border-y border-neutral-100">
        {[
          { label: "Views", value: analytics.views.toLocaleString() },
          { label: "Recoveries", value: analytics.recoveries.toLocaleString() },
          { label: "Recovery Rate", value: `${(analytics.recoveryRate * 100).toFixed(1)}%` },
          { label: "Attributed Revenue", value: `$${(analytics.attributedRevenue as number).toFixed(2)}` },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-lg font-semibold text-neutral-900">{stat.value}</p>
            <p className="text-xs text-neutral-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-8 grid grid-cols-2 gap-6 mt-4">
        {/* Message config */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Recovery Message</h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Message", mod.message],
              ["Subtext", mod.subtext],
              ["CTA Label", mod.ctaLabel],
              ["CTA URL", mod.ctaUrl],
            ].filter(([, v]) => v != null && v !== "").map(([k, v]) => (
              <div key={String(k)} className="flex gap-3">
                <dt className="w-28 shrink-0 text-neutral-500">{String(k)}</dt>
                <dd className="text-neutral-800 text-xs">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Targeting */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Targeting Conditions</h2>
          {targeting.length === 0 ? (
            <p className="text-xs text-neutral-400">No targeting conditions.</p>
          ) : (
            <ul className="space-y-1.5">
              {targeting.map((rule, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 font-mono">{String(rule.field)}</span>
                  <span className="text-neutral-400">{String(rule.operator)}</span>
                  <span className="font-medium text-neutral-700">{String(rule.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Linked offers */}
        {item.offerIds.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Linked Offer</h2>
            <Link
              href={`/offers-library/${item.offerIds[0]}`}
              className="text-xs text-brand-600 hover:text-brand-800 font-mono"
            >
              {item.offerIds[0]}
            </Link>
          </section>
        )}

        {/* Schedule */}
        {(item.startsAt || item.endsAt) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Schedule</h2>
            <dl className="space-y-2 text-sm">
              {item.startsAt && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-neutral-500">Starts</dt>
                  <dd className="text-neutral-800 text-xs">{new Date(item.startsAt).toLocaleString()}</dd>
                </div>
              )}
              {item.endsAt && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-neutral-500">Ends</dt>
                  <dd className="text-neutral-800 text-xs">{new Date(item.endsAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Details */}
        <section className="col-span-2 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Details</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-neutral-500 text-xs">ID</dt>
              <dd className="font-mono text-xs text-neutral-700 mt-0.5">{item.id}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Created</dt>
              <dd className="text-neutral-700 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Last updated</dt>
              <dd className="text-neutral-700 mt-0.5">{new Date(item.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
