import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRuntimeAuth } from "@/lib/api-middleware";

/**
 * Public runtime endpoint — called by the Checkout UI Extension.
 * Returns the active checkout block content for a given experiment assignment.
 *
 * No admin auth required — validated via shop domain header.
 *
 * GET /api/runtime/checkout-blocks
 *   ?experimentId=<id>
 *   &variantKey=<key>
 *   Header: X-Shop-Domain: shop.myshopify.com
 */
export async function GET(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain) => {
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get("experimentId");
    const variantKey = searchParams.get("variantKey");

    if (!experimentId || !variantKey) {
      return NextResponse.json(
        { error: "experimentId and variantKey are required" },
        { status: 400 }
      );
    }

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // Look up the experiment and find the variant's block content.
    // Checkout tests are stored in the generic Experiment model with type CHECKOUT_TEST.
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId, shopId: shop.id },
      select: {
        id: true,
        status: true,
        type: true,
        variants: {
          select: {
            key: true,
            settings: true,
            checkoutBlockIds: true,
          },
        },
      },
    });

    if (!experiment || experiment.type !== "CHECKOUT_TEST" || !["RUNNING", "PREVIEW", "QA"].includes(experiment.status)) {
      return NextResponse.json({ block: null });
    }

    // Find the variant matching variantKey
    const variant = experiment.variants.find((v: (typeof experiment.variants)[number]) => v.key === variantKey);
    if (!variant) {
      return NextResponse.json({ block: null });
    }

    let block: { type: string; content: Record<string, unknown> } | null = null;

    // Path A: variant references an existing CheckoutBlock record.
    // Status is intentionally NOT filtered — DRAFT blocks are allowed inside
    // a running test so merchants can validate before publishing to live theme.
    const blockIds = (variant.checkoutBlockIds ?? []) as string[];
    if (blockIds.length > 0) {
      const checkoutBlock = await prisma.checkoutBlock.findFirst({
        where: { id: blockIds[0], shopId: shop.id },
        select: { type: true, content: true },
      });
      if (checkoutBlock) {
        block = {
          type: checkoutBlock.type as string,
          content: (checkoutBlock.content ?? {}) as Record<string, unknown>,
        };
      }
    }

    // Path B: inline content stored directly in variant.settings (legacy / inline flow).
    if (!block) {
      const config = variant.settings as Record<string, unknown> | null;
      const checkoutBlockType = config?.checkoutBlockType as string | undefined;
      if (!checkoutBlockType) {
        return NextResponse.json({ block: null });
      }
      block = {
        type: checkoutBlockType,
        content: (config?.content ?? {}) as Record<string, unknown>,
      };
    }

    const response = NextResponse.json({ block });
    response.headers.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    response.headers.set("Vary", "X-Shop-Domain");
    return response;
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
    },
  });
}
