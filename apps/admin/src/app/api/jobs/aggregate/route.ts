import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { dailyMetricQueue } from "@/jobs/queue";
import type { AggregationJobData } from "@/jobs/queue";

// POST /api/jobs/aggregate
// Manual trigger for the daily-metric aggregation job (dev/debug use).
// GUARD: requires shop auth — cannot be called from the storefront.
export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const job = await dailyMetricQueue.add(
      "manual-aggregate",
      { shopId, triggerType: "manual" } satisfies AggregationJobData,
      {
        // Higher priority than scheduled hourly jobs
        priority: 1,
        jobId: `manual:${shopId}:${Date.now()}`,
      }
    );

    return NextResponse.json({ jobId: job.id, queued: true });
  });
}
