import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";
import { CheckoutBlockWizard } from "@/components/checkout-blocks/CheckoutBlockWizard";

export const metadata = { title: "Edit Checkout Block — MarginLab" };

export default async function EditCheckoutBlockPage({
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

  return (
    <CheckoutBlockWizard
      blockId={id}
      initialData={{
        name: block.name,
        type: block.type,
        content: (block.content as Record<string, unknown>) ?? {},
        styles: (block.styles as Record<string, unknown>) ?? {},
        position: block.position,
        targetingRules: (block.targetingRules as unknown[]) ?? [],
      }}
    />
  );
}
