import { NextRequest, NextResponse } from "next/server";
import { CartSyncSchema } from "@/lib/zod-schemas";
import { withRuntimeAuth, withRuntimeRateLimit } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { recordRuntimeSignal } from "@/lib/runtime-health";

export async function POST(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain) => {
    const body = await request.json() as unknown;

    const parsed = CartSyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.shopDomain !== shopDomain) {
      return NextResponse.json({ error: "Shop domain mismatch" }, { status: 403 });
    }

    const { visitorId, sessionId, cartToken, assignments } = parsed.data;

    return withRuntimeRateLimit(
      `runtime_cart_sync:${visitorId}`,
      "runtime_cart_sync",
      async () => {
        const shop = await prisma.shop.findUnique({
          where: { shopDomain },
          select: { id: true },
        });

        if (!shop) {
          return NextResponse.json({ error: "Shop not found" }, { status: 404 });
        }

        // Update all assignments with this cart token for attribution
        for (const assignment of assignments) {
          await prisma.experimentAssignment.updateMany({
            where: {
              shopId: shop.id,
              experimentId: assignment.experimentId,
              variantId: assignment.variantId,
              visitorId,
            },
            data: {
              cartToken,
              ...(sessionId ? { sessionId } : {}),
              lastSeenAt: new Date(),
            },
          });
        }

        // Fire-and-forget: record that cart sync is flowing for this visitor
        recordRuntimeSignal(shopDomain, "cart_sync");

        return NextResponse.json({ ok: true }, { status: 200 });
      }
    );
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
    },
  });
}
