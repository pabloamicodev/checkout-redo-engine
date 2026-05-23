import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";

export default async function PersonalizationAnalyticsPage({
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

  const personalization = await prisma.personalization.findFirst({
    where: { id, shopId: shop.id },
    select: { id: true },
  });
  if (!personalization) return notFound();

  // Analytics are shown on the detail page
  redirect(`/personalizations/${id}`);
}
