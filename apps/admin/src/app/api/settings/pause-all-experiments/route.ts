import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const result = await prisma.experiment.updateMany({
      where: { shopId, status: "RUNNING" },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    return NextResponse.json({ ok: true, paused: result.count });
  });
}
