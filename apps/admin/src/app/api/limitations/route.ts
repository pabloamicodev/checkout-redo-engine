/**
 * GET /api/limitations
 *
 * Returns merchant-facing limitation cards for a feature or the full platform list.
 *
 * Query params:
 *   ?feature=price         — returns limitations for that specific feature
 *   ?platform=true         — returns all platform-wide limitations
 *   ?minSeverity=warning   — filter by minimum severity (info | warning | critical)
 *
 * Auth: withShopAuth — only logged-in merchants see this data.
 *
 * This endpoint is intentionally read-only and lightweight.
 * The data is static and does not vary per shop.
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import {
  getLimitationsForFeature,
  getAllPlatformLimitations,
  filterBySeverity,
  type FeatureKey,
  type LimitationSeverity,
} from "@/lib/limitations";

const VALID_FEATURES = new Set<FeatureKey>([
  "content",
  "split_url",
  "offer",
  "checkout",
  "discount",
  "shipping",
  "price",
  "template",
  "theme",
  "personalization",
  "post_purchase",
  "analytics",
  "profit_analytics",
  "integrations",
]);

const VALID_SEVERITIES = new Set<LimitationSeverity>(["info", "warning", "critical"]);

export async function GET(request: NextRequest) {
  return withShopAuth(request, async () => {
    const { searchParams } = new URL(request.url);

    const featureParam = searchParams.get("feature");
    const platformParam = searchParams.get("platform");
    const minSeverityParam = searchParams.get("minSeverity") as LimitationSeverity | null;

    // Validate minSeverity param
    if (minSeverityParam && !VALID_SEVERITIES.has(minSeverityParam)) {
      return NextResponse.json(
        { error: `Invalid minSeverity. Must be one of: info, warning, critical` },
        { status: 400 }
      );
    }

    let limitations;

    if (featureParam) {
      if (!VALID_FEATURES.has(featureParam as FeatureKey)) {
        return NextResponse.json(
          {
            error: `Unknown feature. Valid features: ${[...VALID_FEATURES].join(", ")}`,
          },
          { status: 400 }
        );
      }
      limitations = getLimitationsForFeature(featureParam as FeatureKey);
    } else if (platformParam === "true") {
      limitations = getAllPlatformLimitations();
    } else {
      // Return all: platform + all features merged
      const all = getAllPlatformLimitations();
      for (const feature of VALID_FEATURES) {
        all.push(...getLimitationsForFeature(feature));
      }
      // Deduplicate by id
      const seen = new Set<string>();
      limitations = all.filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });
    }

    if (minSeverityParam) {
      limitations = filterBySeverity(limitations, minSeverityParam);
    }

    return NextResponse.json({ limitations });
  });
}
