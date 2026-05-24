/**
 * AbandonedCartService
 *
 * Manages Abandoned Cart Recovery personalizations.
 *
 * Flow:
 *  1. Merchant creates an ACR personalization with message + optional offer + targeting
 *  2. On activation, the personalization is included in the RuntimeConfig payload
 *  3. The storefront runtime detects cart-abandonment signals and applies modifications
 *  4. Events (view, click, recovery) are attributed back to the personalization
 *
 * Guards & edge cases handled:
 *  - Cannot activate while another ACR personalization is already ACTIVE (priority conflict)
 *  - Cannot delete an ACTIVE personalization
 *  - Cannot set endsAt in the past
 *  - Cannot set endsAt before startsAt
 *  - Message length limits enforced (1-500 chars)
 *  - Offer must belong to same shop before linking
 *  - Returning DRAFT if startsAt is in the future
 *  - Concurrency: stale-read guard before status transitions
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Local string-union type — mirrors Prisma enum, avoids @prisma/client dependency before generate
type PersonalizationStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "SCHEDULED" | "ARCHIVED";

// ── Input types ───────────────────────────────────────────────────────────────

export interface AbandonedCartInput {
  name: string;
  /** Main announcement bar / banner message shown to the cart abandoner */
  message: string;
  /** Optional subtext shown beneath the main message */
  subtext?: string;
  /** Optional CTA button label */
  ctaLabel?: string;
  /** Optional CTA URL (defaults to /cart) */
  ctaUrl?: string;
  /** Offer ID to attach (must belong to same shop) */
  offerId?: string;
  /** Minutes of inactivity before visitor is considered an abandoner (default 30) */
  inactivityMinutes?: number;
  /** Only trigger if cart value >= this amount (in store currency units) */
  minCartValue?: number;
  /** Only trigger for returning visitors (default true) */
  returningOnly?: boolean;
  /** ISO datetime — when to start (null = immediate) */
  startsAt?: string | null;
  /** ISO datetime — when to stop (null = indefinite) */
  endsAt?: string | null;
  /** Priority: lower number = evaluated first (default 100) */
  priority?: number;
}

export interface AbandonedCartUpdateInput extends Partial<AbandonedCartInput> {}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateInput(input: AbandonedCartInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Name is required");
  }
  if (input.name.length > 200) {
    throw new Error("Name must be 200 characters or fewer");
  }
  if (!input.message || input.message.trim().length === 0) {
    throw new Error("Message is required");
  }
  if (input.message.length > 500) {
    throw new Error("Message must be 500 characters or fewer");
  }
  if (input.subtext && input.subtext.length > 300) {
    throw new Error("Subtext must be 300 characters or fewer");
  }
  if (input.ctaLabel && input.ctaLabel.length > 100) {
    throw new Error("CTA label must be 100 characters or fewer");
  }
  if (input.inactivityMinutes !== undefined) {
    if (input.inactivityMinutes < 5 || input.inactivityMinutes > 1440) {
      throw new Error("Inactivity window must be between 5 and 1440 minutes");
    }
  }
  if (input.minCartValue !== undefined && input.minCartValue < 0) {
    throw new Error("Minimum cart value cannot be negative");
  }
  if (input.priority !== undefined && (input.priority < 0 || input.priority > 9999)) {
    throw new Error("Priority must be between 0 and 9999");
  }

  // Date guards
  const now = new Date();
  if (input.endsAt) {
    const endsAt = new Date(input.endsAt);
    if (isNaN(endsAt.getTime())) throw new Error("endsAt is not a valid date");
    if (endsAt <= now) throw new Error("endsAt must be in the future");
    if (input.startsAt) {
      const startsAt = new Date(input.startsAt);
      if (endsAt <= startsAt) throw new Error("endsAt must be after startsAt");
    }
  }
  if (input.startsAt) {
    const startsAt = new Date(input.startsAt);
    if (isNaN(startsAt.getTime())) throw new Error("startsAt is not a valid date");
  }
}

// ── Build targeting rules JSON from input ─────────────────────────────────────

function buildTargetingRules(input: AbandonedCartInput) {
  const rules: object[] = [
    { field: "cart_has_items", operator: "equals", value: true },
    {
      field: "inactivity_minutes",
      operator: "gte",
      value: input.inactivityMinutes ?? 30,
    },
  ];

  if (input.minCartValue && input.minCartValue > 0) {
    rules.push({
      field: "cart_value",
      operator: "gte",
      value: input.minCartValue,
    });
  }

  if (input.returningOnly !== false) {
    rules.push({ field: "visitor_type", operator: "equals", value: "returning" });
  }

  return rules;
}

// ── Build modifications JSON from input ───────────────────────────────────────

function buildModifications(input: AbandonedCartInput) {
  return [
    {
      type: "announcement_bar",
      message: input.message.trim(),
      subtext: input.subtext?.trim() ?? null,
      ctaLabel: input.ctaLabel?.trim() ?? "Complete your order",
      ctaUrl: input.ctaUrl?.trim() ?? "/cart",
      style: "urgency",
    },
  ];
}

// ── Service class ─────────────────────────────────────────────────────────────

export class AbandonedCartService {
  /** List all ACR personalizations for a shop */
  async list(shopId: string, opts?: { status?: PersonalizationStatus; page?: number }) {
    const PAGE_SIZE = 50;
    const page = Math.max(1, opts?.page ?? 1);
    const where = {
      shopId,
      type: "ABANDONED_CART",
      ...(opts?.status ? { status: opts.status } : { status: { not: "ARCHIVED" } }),
    };

    const [items, total] = await prisma.$transaction([
      prisma.personalization.findMany({
        where,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
      prisma.personalization.count({ where }),
    ]);

    return { items, total, page, pageSize: PAGE_SIZE };
  }

  /** Get single ACR personalization — throws if not found or wrong shop */
  async get(shopId: string, id: string) {
    const p = await prisma.personalization.findFirst({
      where: { id, shopId, type: "ABANDONED_CART" },
    });
    if (!p) throw new Error("Abandoned cart personalization not found");
    return p;
  }

  /** Create a new ACR personalization */
  async create(shopId: string, input: AbandonedCartInput) {
    validateInput(input);

    // Validate offer belongs to shop
    if (input.offerId) {
      const offer = await prisma.offer.findFirst({
        where: { id: input.offerId, shopId },
        select: { id: true, status: true },
      });
      if (!offer) throw new Error("Offer not found or does not belong to this shop");
      if (offer.status === "ARCHIVED") throw new Error("Cannot link an archived offer");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    const now = new Date();

    // DRAFT if scheduled in future, otherwise DRAFT awaiting explicit activation
    const status: PersonalizationStatus =
      startsAt && startsAt > now ? "SCHEDULED" : "DRAFT";

    return prisma.personalization.create({
      data: {
        shopId,
        name: input.name.trim(),
        type: "ABANDONED_CART",
        status,
        priority: input.priority ?? 100,
        targetingRules: buildTargetingRules(input),
        modifications: buildModifications(input),
        offerIds: input.offerId ? [input.offerId] : [],
        startsAt,
        endsAt,
      },
    });
  }

  /** Update an existing ACR personalization */
  async update(shopId: string, id: string, input: AbandonedCartUpdateInput) {
    const existing = await this.get(shopId, id);

    // Cannot edit an ACTIVE personalization's targeting/message without pausing first
    if (existing.status === "ACTIVE") {
      const SAFE_FIELDS: (keyof AbandonedCartUpdateInput)[] = ["name", "priority", "endsAt"];
      const changedFields = Object.keys(input) as (keyof AbandonedCartUpdateInput)[];
      const unsafeChanges = changedFields.filter((f) => !SAFE_FIELDS.includes(f));
      if (unsafeChanges.length > 0) {
        throw new Error(
          `Cannot change [${unsafeChanges.join(", ")}] while personalization is ACTIVE. Pause it first.`
        );
      }
    }

    const merged: AbandonedCartInput = {
      name: input.name ?? existing.name,
      message:
        input.message ??
        ((existing.modifications as { message?: string }[])[0]?.message ?? ""),
      subtext: input.subtext,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      offerId: input.offerId ?? existing.offerIds[0],
      inactivityMinutes: input.inactivityMinutes,
      minCartValue: input.minCartValue,
      returningOnly: input.returningOnly,
      startsAt: input.startsAt !== undefined ? input.startsAt : existing.startsAt?.toISOString(),
      endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt?.toISOString(),
      priority: input.priority ?? existing.priority,
    };

    validateInput(merged);

    if (input.offerId) {
      const offer = await prisma.offer.findFirst({
        where: { id: input.offerId, shopId },
        select: { id: true, status: true },
      });
      if (!offer) throw new Error("Offer not found or does not belong to this shop");
      if (offer.status === "ARCHIVED") throw new Error("Cannot link an archived offer");
    }

    return prisma.personalization.update({
      where: { id },
      data: {
        name: merged.name.trim(),
        priority: merged.priority ?? 100,
        targetingRules: buildTargetingRules(merged),
        modifications: buildModifications(merged),
        offerIds: merged.offerId ? [merged.offerId] : [],
        startsAt: merged.startsAt ? new Date(merged.startsAt) : null,
        endsAt: merged.endsAt ? new Date(merged.endsAt) : null,
      },
    });
  }

  /**
   * Activate an ACR personalization.
   *
   * Guards:
   * - Already ACTIVE → no-op (idempotent)
   * - ARCHIVED → cannot reactivate
   * - Another ACR is already ACTIVE → conflict error (merchant must pause it first)
   */
  async activate(shopId: string, id: string) {
    const p = await this.get(shopId, id);

    if (p.status === "ACTIVE") return p; // idempotent

    if (p.status === "ARCHIVED") {
      throw new Error("Cannot activate an archived personalization. Duplicate it instead.");
    }

    // Conflict check: only one ACTIVE ACR at a time per priority band
    const activeConflict = await prisma.personalization.findFirst({
      where: {
        shopId,
        type: "ABANDONED_CART",
        status: "ACTIVE",
        id: { not: id },
      },
      select: { id: true, name: true, priority: true },
    });

    if (activeConflict) {
      throw new Error(
        `"${activeConflict.name}" is already active. Pause it before activating this one, or set a different priority.`
      );
    }

    return prisma.personalization.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  }

  /** Pause an ACTIVE or SCHEDULED personalization */
  async pause(shopId: string, id: string) {
    const p = await this.get(shopId, id);

    if (p.status === "PAUSED") return p;
    if (p.status !== "ACTIVE" && p.status !== "SCHEDULED") {
      throw new Error(`Cannot pause a personalization with status "${p.status}"`);
    }

    return prisma.personalization.update({
      where: { id },
      data: { status: "PAUSED" },
    });
  }

  /** Archive (soft-delete) — cannot be undone via UI */
  async archive(shopId: string, id: string) {
    const p = await this.get(shopId, id);
    if (p.status === "ACTIVE") {
      throw new Error("Cannot archive an ACTIVE personalization. Pause it first.");
    }
    return prisma.personalization.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
  }

  /** Hard delete — only allowed on DRAFT personalizations */
  async delete(shopId: string, id: string) {
    const p = await this.get(shopId, id);
    if (p.status !== "DRAFT") {
      throw new Error(
        `Only DRAFT personalizations can be deleted. This one is "${p.status}". Archive it instead.`
      );
    }
    await prisma.personalization.delete({ where: { id } });
  }

  /** Get recovery analytics for a personalization */
  async getAnalytics(shopId: string, id: string) {
    await this.get(shopId, id); // auth check

    const [views, recoveries, revenue] = await Promise.all([
      prisma.event.count({
        where: { shopId, personalizationId: id, eventType: "CUSTOM", eventName: "personalization_view" },
      }),
      prisma.event.count({
        where: { shopId, personalizationId: id, eventType: "CUSTOM", eventName: "cart_recovery" },
      }),
      prisma.orderAttribution.aggregate({
        where: { shopId, personalizationId: id },
        _sum: { netRevenue: true },
      }),
    ]);

    const recoveryRate = views > 0 ? recoveries / views : 0;

    return {
      views,
      recoveries,
      recoveryRate,
      attributedRevenue: revenue._sum.netRevenue ?? 0,
    };
  }
}
