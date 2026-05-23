import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewPersonalizationForm } from "@/components/personalizations/NewPersonalizationForm";
import { OfferService } from "@/services/offer.service";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";

export const metadata = { title: "Create Personalization — MarginLab" };

const offerService = new OfferService();

export default async function NewPersonalizationPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  const { items: availableOffers } = shop
    ? await offerService.list(shop.id, { limit: 200 })
    : { items: [] };

  const eligibleOffers = availableOffers.filter(
    (o) => o.status === "ACTIVE" || o.status === "DRAFT"
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-neutral-100 bg-white">
        <Link href="/personalizations" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Personalizations
        </Link>
      </div>
      <NewPersonalizationForm
        availableOffers={eligibleOffers.map((o) => ({
          id: o.id,
          name: o.name,
          type: o.type,
          status: o.status,
        }))}
      />
    </div>
  );
}
