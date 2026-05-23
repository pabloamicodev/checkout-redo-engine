/**
 * GET  /api/settings/kill-switches  — read current kill switch state
 * PATCH /api/settings/kill-switches  — update one or more kill switches
 *
 * Kill switches are stored as prefixed keys in Shop.settings (JSON) to keep
 * the schema migration-free. All keys use the `ks_` prefix to avoid
 * collisions with other settings.
 *
 * Every PATCH is logged to AuditLog with before/after state so support can
 * trace who changed what and when.
 *
 * Kill switch values are served to the storefront via /api/runtime/config
 * under the `killSwitches` key. The storefront runtime reads these values
 * and disables the relevant features immediately on the next config fetch
 * (max 30s stale due to Cache-Control: max-age=30, stale-while-revalidate=60).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withShopAuth } from "@/lib/api-middleware";
import { RuntimeConfigService } from "@/services/runtime-config.service";

const runtimeConfig = new RuntimeConfigService();

const KS_KEYS = [
  "ks_globalDisabled",
  "ks_contentModificationsDisabled",
  "ks_priceDisplayDisabled",
  "ks_offerWidgetsDisabled",
  "ks_splitUrlRedirectsDisabled",
  "ks_debugOverlayDisabled",
] as const;

type KsKey = (typeof KS_KEYS)[number];

// Human-readable labels for AuditLog
const KS_LABELS: Record<KsKey, string> = {
  ks_globalDisabled: "Global runtime disable",
  ks_contentModificationsDisabled: "Content modifications",
  ks_priceDisplayDisabled: "Price display changes",
  ks_offerWidgetsDisabled: "Offer widgets",
  ks_splitUrlRedirectsDisabled: "Split URL redirects",
  ks_debugOverlayDisabled: "Debug overlay",
};

const PatchSchema = z
  .object({
    ks_globalDisabled: z.boolean().optional(),
    ks_contentModificationsDisabled: z.boolean().optional(),
    ks_priceDisplayDisabled: z.boolean().optional(),
    ks_offerWidgetsDisabled: z.boolean().optional(),
    ks_splitUrlRedirectsDisabled: z.boolean().optional(),
    ks_debugOverlayDisabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one kill switch key must be provided",
  });

function readKillSwitches(settings: Record<string, unknown>) {
  return {
    ks_globalDisabled: (settings.ks_globalDisabled as boolean) ?? false,
    ks_contentModificationsDisabled: (settings.ks_contentModificationsDisabled as boolean) ?? false,
    ks_priceDisplayDisabled: (settings.ks_priceDisplayDisabled as boolean) ?? false,
    ks_offerWidgetsDisabled: (settings.ks_offerWidgetsDisabled as boolean) ?? false,
    ks_splitUrlRedirectsDisabled: (settings.ks_splitUrlRedirectsDisabled as boolean) ?? false,
    ks_debugOverlayDisabled: (settings.ks_debugOverlayDisabled as boolean) ?? true,
  };
}

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId: string) => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true, settings: true },
    });
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const settings = (shop.settings ?? {}) as Record<string, unknown>;
    const killSwitches = readKillSwitches(settings);

    return NextResponse.json({ killSwitches });
  });
}

export async function PATCH(request: NextRequest) {
  return withShopAuth(request, async (shopId: string, actorId?: string) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true, settings: true },
    });
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const settings = (shop.settings ?? {}) as Record<string, unknown>;
    const before = readKillSwitches(settings);

    // Merge new values into settings
    const updatedSettings = { ...settings, ...parsed.data };

    await prisma.shop.update({
      where: { id: shopId },
      data: { settings: updatedSettings },
    });

    const after = readKillSwitches(updatedSettings as Record<string, unknown>);

    // Build human-readable description of what changed
    const changes = (Object.keys(parsed.data) as KsKey[])
      .filter((k) => parsed.data[k] !== before[k])
      .map((k) => `${KS_LABELS[k]}: ${before[k] ? "enabled" : "disabled"} → ${after[k] ? "enabled" : "disabled"}`)
      .join(", ");

    // Log to AuditLog — always, even if value didn't change (idempotent writes)
    await prisma.auditLog.create({
      data: {
        shopId,
        actorId: actorId ?? "unknown",
        entityType: "killSwitch",
        entityId: shopId,
        entityName: "Shop Kill Switches",
        action: "updated",
        before,
        after,
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
        userAgent: request.headers.get("user-agent") ?? null,
      },
    });

    // Invalidate the runtime config cache so changes take effect within max-age window
    await runtimeConfig.invalidate(shop.shopDomain);

    return NextResponse.json({
      killSwitches: after,
      changes: changes || "No values changed",
    });
  });
}
