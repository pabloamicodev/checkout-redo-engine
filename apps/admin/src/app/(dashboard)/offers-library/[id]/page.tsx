import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";
import { OfferActions } from "@/components/offers/OfferActions";
import { getStatusTheme } from "@/lib/design/statusTheme";

export const metadata = { title: "Offer — MarginLab" };

const TYPE_LABEL: Record<string, string> = {
  PERCENTAGE_DISCOUNT: "% Discount",
  FIXED_AMOUNT_DISCOUNT: "Fixed Amount",
  PRODUCT_DISCOUNT: "Product Discount",
  ORDER_DISCOUNT: "Order Discount",
  FREE_SHIPPING: "Free Shipping",
  FREE_GIFT: "Free Gift",
  VOLUME_DISCOUNT: "Volume Discount",
  QUANTITY_BREAK: "Quantity Break",
  BUY_X_GET_Y: "Buy X Get Y",
  UPSELL: "Upsell",
  CROSS_SELL: "Cross-sell",
};

export default async function OfferDetailPage({
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

  const offer = await prisma.offer.findFirst({
    where: { id, shopId: shop.id },
  });
  if (!offer) return notFound();

  const st = getStatusTheme(offer.status);
  const typeLabel = TYPE_LABEL[offer.type] ?? offer.type;
  const triggerRules = offer.triggerRules as unknown[];
  const discountRules = offer.discountRules as Record<string, unknown>;
  const displaySettings = offer.displaySettings as Record<string, unknown>;

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Link href="/offers-library" className="hover:text-neutral-600 transition-colors">
            Offers Library
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-neutral-600 truncate max-w-sm">{offer.name}</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-4 pb-3 bg-white border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-neutral-900">{offer.name}</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
              style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.hex }} />
              {st.label}
            </span>
          </div>
          <p className="text-xs text-neutral-500">{typeLabel}</p>
        </div>
        <OfferActions offerId={offer.id} status={offer.status} />
      </div>

      {/* Content grid */}
      <div className="max-w-5xl mx-auto px-6 pb-8 grid grid-cols-2 gap-6 mt-6">
        {/* Discount rules */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Discount Rules</h2>
          {Object.keys(discountRules).length === 0 ? (
            <p className="text-xs text-neutral-400">No discount rules configured.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {Object.entries(discountRules).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-36 shrink-0 text-neutral-500 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-neutral-800 break-all text-xs">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Display settings */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Display Settings</h2>
          {Object.keys(displaySettings).length === 0 ? (
            <p className="text-xs text-neutral-400">No display settings configured.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {Object.entries(displaySettings).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-36 shrink-0 text-neutral-500 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-neutral-800 break-all text-xs">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Trigger rules */}
        <section className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Trigger Rules</h2>
          {triggerRules.length === 0 ? (
            <p className="text-xs text-neutral-400">No trigger rules — offer shows to all eligible customers.</p>
          ) : (
            <div className="space-y-2">
              {triggerRules.map((rule, i) => (
                <div key={i} className="bg-neutral-50 rounded-lg px-3 py-2 text-xs font-mono text-neutral-700">
                  {JSON.stringify(rule)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Metadata */}
        <section className="col-span-2 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Details</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-neutral-500 text-xs">Offer ID</dt>
              <dd className="font-mono text-xs text-neutral-700 mt-0.5">{offer.id}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Created</dt>
              <dd className="text-neutral-700 mt-0.5">{new Date(offer.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Last updated</dt>
              <dd className="text-neutral-700 mt-0.5">{new Date(offer.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
