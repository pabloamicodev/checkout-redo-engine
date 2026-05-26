import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CheckoutBlockService } from "@/services/checkout-block.service";
import { prisma } from "@/lib/prisma";
import { Plus, ExternalLink } from "lucide-react";
import { getSessionShop } from "@/lib/session-shop";
import { getStatusTheme } from "@/lib/design/statusTheme";


export const dynamic = 'force-dynamic';
const service = new CheckoutBlockService();

const TYPE_LABELS: Record<string, string> = {
  TRUST_BADGES: "Trust Badges",
  SOCIAL_PROOF: "Social Proof",
  GUARANTEE: "Guarantee",
  SHIPPING_MESSAGE: "Shipping Message",
  PAYMENT_ICONS: "Payment Icons",
  PRODUCT_UPSELL: "Product Upsell",
  CUSTOM_CONTENT: "Custom Content",
  IMAGE_WITH_TEXT: "Image + Text",
  URGENCY_MESSAGE: "Urgency Message",
  SECURITY_MESSAGE: "Security Message",
  FREE_SHIPPING_PROGRESS: "Free Shipping Progress",
};

const POSITION_LABELS: Record<string, string> = {
  AFTER_CONTACT: "After Contact",
  AFTER_SHIPPING: "After Shipping",
  BEFORE_PAYMENT: "Before Payment",
  AFTER_PAYMENT: "After Payment",
};

export default async function CheckoutBlocksPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  const { items, total } = shop
    ? await service.list(shop.id, { limit: 100 })
    : { items: [], total: 0 };
  type CheckoutBlockRow = (typeof items)[number];

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className=" mx-auto px-8 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Checkout Blocks</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Content blocks rendered inside the Shopify checkout extension</p>
          </div>
          <Link href="/checkout-blocks/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Block
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-neutral-800 mb-1">No checkout blocks yet</p>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-4 leading-relaxed">Add custom blocks — product upsells, progress bars, or custom content.</p>
              <Link href="/checkout-blocks/new">
                <Button size="sm">Create Checkout Block</Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((block: CheckoutBlockRow) => {
                  const st = getStatusTheme(block.status);
                  return (
                    <tr key={block.id} className="hover:bg-neutral-50/60 transition-colors group">
                      <td className="px-5 py-3.5 font-medium text-neutral-800">
                        <Link href={`/checkout-blocks/${block.id}`} className="hover:text-brand-600 transition-colors">
                          {block.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full">
                          {TYPE_LABELS[block.type] ?? block.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                          style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.hex }} />
                          {block.status.charAt(0) + block.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-500">
                        {POSITION_LABELS[block.position] ?? block.position}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-400">
                        {new Date(block.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {block.experimentId && (
                          <Link
                            href={`/experiments/${block.experimentId}`}
                            className="inline-flex items-center gap-1 text-xs text-neutral-300 group-hover:text-brand-600 transition-colors"
                          >
                            Experiment <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
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
