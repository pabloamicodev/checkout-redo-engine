import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PostPurchaseWizard } from "@/components/personalizations/PostPurchaseWizard";
import { OfferService } from "@/services/offer.service";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
const offerService = new OfferService();

export const metadata = { title: "New Post-Purchase Personalization — MarginLab" };

export default async function NewPostPurchasePage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  const { items: availableOffers } = shop
    ? await offerService.list(shop.id, { limit: 200 })
    : { items: [] };

  type AvailableOffer = (typeof availableOffers)[number];
  const eligibleOffers = availableOffers.filter(
    (o: AvailableOffer) => o.status === "ACTIVE" || o.status === "DRAFT"
  );
  type EligibleOffer = (typeof eligibleOffers)[number];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-neutral-100 bg-white">
        <Link
          href="/personalizations/post-purchase"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Post-Purchase
        </Link>
      </div>
      <PostPurchaseWizard
        availableOffers={eligibleOffers.map((o: EligibleOffer) => ({
          id: o.id,
          name: o.name,
          type: o.type,
          status: o.status,
        }))}
      />
    </div>
  );
}
