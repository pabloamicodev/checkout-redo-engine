import { NextRequest, NextResponse } from "next/server";
import { CartSyncSchema } from "@/lib/zod-schemas";
import { withRuntimeAuth, withRuntimeRateLimit } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { recordRuntimeSignal } from "@/lib/runtime-health";

export async function POST(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain, shopId) => {
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

    const { visitorId, sessionId, assignments } = parsed.data;

    // Shopify sometimes appends ?key=<hex> to cart tokens (e.g. draft-order carts).
    // Strip the query string before validation so only the base token is checked.
    const cartToken = parsed.data.cartToken.split("?")[0] ?? "";

    // GUARD: cartToken must match Shopify's token format (alphanumeric + hyphens, ≤64 chars).
    // Prevents arbitrary strings being stored for order attribution.
    if (!/^[a-zA-Z0-9_\-]{1,64}$/.test(cartToken)) {
      return NextResponse.json({ error: "Invalid cart token format" }, { status: 400 });
    }

    return withRuntimeRateLimit(
      `runtime_cart_sync:${visitorId}`,
      "runtime_cart_sync",
      async () => {
        const experimentIds = assignments.map((a) => a.experimentId);
        const variantIds = assignments.map((a) => a.variantId);

        // GUARD: verify ownership — only update assignments that actually belong to
        // this visitor for this shop. Prevents a spoofed visitorId from touching
        // another visitor's attribution data via a known experimentId/variantId pair.
        const existing = await prisma.experimentAssignment.findMany({
          where: {
            shopId: shopId,
            visitorId,
            experimentId: { in: experimentIds },
            variantId: { in: variantIds },
          },
          select: { experimentId: true, variantId: true },
        });

        if (existing.length === 0) {
          // No verified assignments — nothing to update. Return ok to not leak info.
          return NextResponse.json({ ok: true }, { status: 200 });
        }

        // Build an allowed set to skip any unverified experimentId/variantId pairs
        const allowedPairs = new Set(
          existing.map((r: { experimentId: string; variantId: string }) => `${r.experimentId}:${r.variantId}`)
        );

        // Update all assignments with this cart token for attribution
        for (const assignment of assignments) {
          if (!allowedPairs.has(`${assignment.experimentId}:${assignment.variantId}`)) continue;

          await prisma.experimentAssignment.updateMany({
            where: {
              shopId: shopId,
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
