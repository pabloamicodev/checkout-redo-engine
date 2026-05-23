import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Settings, Share2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";
import { CheckoutBlockActions } from "@/components/checkout-blocks/CheckoutBlockActions";
import { getStatusTheme } from "@/lib/design/statusTheme";

export const metadata = { title: "Checkout Block — MarginLab" };

const BLOCK_TYPE_LABELS: Record<string, string> = {
  TRUST_BADGES:        "Trust Badges",
  SOCIAL_PROOF:        "Social Proof",
  GUARANTEE_MESSAGE:   "Guarantee Message",
  SHIPPING_MESSAGE:    "Shipping Message",
  PRODUCT_UPSELL:      "Product Upsell",
  FREE_SHIPPING_PROGRESS: "Free Shipping Progress",
  CUSTOM_CONTENT:      "Custom Content",
};

export default async function CheckoutBlockDetailPage({
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

  const block = await prisma.checkoutBlock.findFirst({
    where: { id, shopId: shop.id },
  });
  if (!block) return notFound();

  const st = getStatusTheme(block.status);
  const typeLabel = BLOCK_TYPE_LABELS[block.type] ?? block.type;
  const content = block.content as Record<string, unknown>;
  const styles  = block.styles  as Record<string, unknown>;
  const targeting = block.targetingRules as unknown[];

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      {/* Top utility bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Link href="/checkout-blocks" className="hover:text-neutral-600 transition-colors">
            Checkout Blocks
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-neutral-600 truncate max-w-sm">{block.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-4 pb-3 bg-white border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-neutral-900">{block.name}</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
              style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.hex }} />
              {st.label}
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            {typeLabel} · Position: <span className="font-medium">{block.position.replace(/_/g, " ").toLowerCase()}</span>
          </p>
        </div>
        <CheckoutBlockActions blockId={block.id} status={block.status} />
      </div>

      {/* Content grid */}
      <div className="max-w-5xl mx-auto px-6 pb-8 grid grid-cols-2 gap-6 mt-6">
        {/* Block content */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Content</h2>
          {Object.keys(content).length === 0 ? (
            <p className="text-xs text-neutral-400">No content configured.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {Object.entries(content).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-neutral-500 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-neutral-800 break-all">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Styles */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">Styles</h2>
          {Object.keys(styles).length === 0 ? (
            <p className="text-xs text-neutral-400">No custom styles.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {Object.entries(styles).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-neutral-500 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-neutral-800 font-mono text-xs">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Targeting rules */}
        <section className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 border-b border-neutral-100 pb-1">
            Targeting Rules
          </h2>
          {targeting.length === 0 ? (
            <p className="text-xs text-neutral-400">No targeting rules — block shows to all visitors.</p>
          ) : (
            <div className="space-y-2">
              {targeting.map((rule, i) => (
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
              <dt className="text-neutral-500 text-xs">Block ID</dt>
              <dd className="font-mono text-xs text-neutral-700 mt-0.5">{block.id}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Created</dt>
              <dd className="text-neutral-700 mt-0.5">{new Date(block.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Last updated</dt>
              <dd className="text-neutral-700 mt-0.5">{new Date(block.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
