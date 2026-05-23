/**
 * ContentTestService — creates and manages CONTENT_TEST experiments.
 *
 * A Content Test A/B tests on-site copy and visual changes — hero text, button
 * labels, banner copy, product descriptions — injected by the storefront runtime
 * without redirecting the visitor.
 *
 * Guards:
 *  - Control variant must have no modifications
 *  - Non-control variants must have at least one modification
 *  - Each modification must have a selector and at least one change (text, html, style, class)
 *  - Targeting rules, if provided, must have a valid type field
 *  - Traffic allocations must sum to 100
 *  - At least 2 variants required
 */

import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";

const experimentService = new ExperimentService();

export type ModificationType =
  | "replace_text"
  | "replace_image"
  | "hide_element"
  | "show_element"
  | "replace_link"
  | "inject_css"
  | "inject_js"
  | "html_insert";

/** @deprecated use ModificationType */
export type ModificationChangeType = "text" | "html" | "hide" | "style" | "addClass" | "removeClass" | "attr";

export interface ContentModification {
  id?: string;
  type: ModificationType;
  selector: string;
  // replace_text
  textValue?: string;
  // replace_image
  imageSrc?: string;
  // replace_link
  href?: string;
  // inject_css / inject_js
  code?: string;
  // html_insert
  html?: string;
  insertPosition?: "before" | "after" | "replace";
  /** Optional: target specific page paths (e.g. "/products/*") */
  pagePattern?: string;
}

export type TargetingRuleType =
  | "url_contains"
  | "url_matches"
  | "query_param"
  | "visitor_type"
  | "device"
  | "geo_country";

export interface TargetingRule {
  type: TargetingRuleType;
  value: string;
  operator?: "equals" | "contains" | "starts_with" | "not_equals";
}

export interface ContentVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  modifications?: ContentModification[];
}

export interface CreateContentTestInput {
  name: string;
  description?: string;
  hypothesis?: string;
  trafficAllocation: number;
  primaryMetric?: string;
  targetingRules?: TargetingRule[];
  variants: ContentVariantConfig[];
}

export interface UpdateContentTestInput {
  name?: string;
  description?: string;
  hypothesis?: string;
}

const VALID_MOD_TYPES = new Set<string>([
  "replace_text", "replace_image", "hide_element", "show_element",
  "replace_link", "inject_css", "inject_js", "html_insert",
]);

const VALID_TARGETING_TYPES = new Set<string>([
  "url_contains", "url_matches", "query_param", "visitor_type", "device", "geo_country",
]);

export class ContentTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);

    const where = {
      shopId,
      type: "CONTENT_TEST" as const,
      ...(opts.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: {
          variants: {
            select: {
              id: true,
              key: true,
              name: true,
              isControl: true,
              allocationPercent: true,
              modifications: true,
            },
            orderBy: { isControl: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total };
  }

  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "CONTENT_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Content test not found");
    return exp;
  }

  async create(shopId: string, input: CreateContentTestInput) {
    this.validate(input);

    return experimentService.create(shopId, {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      type: "CONTENT_TEST",
      primaryMetric: input.primaryMetric ?? "conversion_rate",
      secondaryMetrics: ["revenue_per_visitor", "average_order_value"],
      trafficAllocation: input.trafficAllocation,
      assignmentStrategy: "visitor",
      targetingRules: (input.targetingRules ?? []) as never[],
      goals: [],
      settings: {},
      variants: input.variants.map((v) => ({
        key: v.key,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocationPercent,
        modifications: (v.isControl ? [] : (v.modifications ?? [])) as never[],
        priceOverrides: [],
        checkoutBlockIds: [],
        offerIds: [],
        settings: {},
        redirectUrl: null,
      })),
    });
  }

  async addModification(
    shopId: string,
    experimentId: string,
    variantId: string,
    modification: ContentModification
  ) {
    // Verify the experiment belongs to this shop
    await this.get(shopId, experimentId);

    const variant = await prisma.experimentVariant.findFirst({
      where: { id: variantId, experimentId },
    });
    if (!variant) throw new Error("Variant not found");
    if (variant.isControl) throw new Error("Cannot add modifications to the control variant");

    // Validate the modification
    if (!modification.selector?.trim() &&
        modification.type !== "inject_css" &&
        modification.type !== "inject_js") {
      throw new Error("Selector is required");
    }
    if (!VALID_MOD_TYPES.has(modification.type)) {
      throw new Error(
        `Invalid modification type "${modification.type}". Must be one of: ${[...VALID_MOD_TYPES].join(", ")}`
      );
    }

    const existing = (variant.modifications ?? []) as unknown as ContentModification[];
    const updated = [...existing, modification];

    return prisma.experimentVariant.update({
      where: { id: variantId },
      data: { modifications: updated as never },
    });
  }

  async removeModification(
    shopId: string,
    experimentId: string,
    variantId: string,
    modificationId: number
  ) {
    // Verify the experiment belongs to this shop
    await this.get(shopId, experimentId);

    const variant = await prisma.experimentVariant.findFirst({
      where: { id: variantId, experimentId },
    });
    if (!variant) throw new Error("Variant not found");
    if (variant.isControl) throw new Error("Control variant has no modifications to remove");

    const existing = (variant.modifications ?? []) as unknown as ContentModification[];
    if (modificationId < 0 || modificationId >= existing.length) {
      throw new Error(`Modification index ${modificationId} is out of range`);
    }

    const updated = existing.filter((_, i) => i !== modificationId);

    return prisma.experimentVariant.update({
      where: { id: variantId },
      data: { modifications: updated as never },
    });
  }

  async update(shopId: string, id: string, input: UpdateContentTestInput) {
    await this.get(shopId, id);
    return prisma.experiment.update({
      where: { id },
      data: {
        ...(input.name        ? { name: input.name.trim() }               : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.hypothesis  !== undefined ? { hypothesis: input.hypothesis }  : {}),
      },
    });
  }

  async activate(shopId: string, id: string) {
    const exp = await this.get(shopId, id);
    if (exp.status === "RUNNING") return exp;
    if (exp.status === "COMPLETED" || exp.status === "ARCHIVED") {
      throw new Error(`Cannot activate a ${exp.status.toLowerCase()} test`);
    }
    return experimentService.launch(shopId, id);
  }

  async pause(shopId: string, id: string) {
    const exp = await this.get(shopId, id);
    if (exp.status === "PAUSED") return exp;
    if (exp.status !== "RUNNING") {
      throw new Error(`Cannot pause a test with status "${exp.status}"`);
    }
    return experimentService.pause(shopId, id);
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  private validate(input: CreateContentTestInput) {
    if (!input.name?.trim()) throw new Error("Name is required");

    if (input.variants.length < 2) {
      throw new Error("Content test requires at least 2 variants");
    }

    const controls = input.variants.filter((v) => v.isControl);
    if (controls.length !== 1) throw new Error("Exactly one control variant is required");

    const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(totalAlloc - 100) > 0.01) {
      throw new Error(`Variant allocations must sum to 100 (got ${totalAlloc.toFixed(1)})`);
    }

    const controlVariant = controls[0]!;
    if (controlVariant.modifications && controlVariant.modifications.length > 0) {
      throw new Error("Control variant must not have modifications — it shows the original content");
    }

    for (const v of input.variants.filter((v) => !v.isControl)) {
      if (!v.modifications || v.modifications.length === 0) {
        throw new Error(`Variant "${v.name}": must have at least one modification`);
      }

      for (let i = 0; i < v.modifications.length; i++) {
        const mod = v.modifications[i]!;

        const needsSelector = mod.type !== "inject_css" && mod.type !== "inject_js";
        if (needsSelector && !mod.selector?.trim()) {
          throw new Error(`Variant "${v.name}", modification ${i + 1}: selector is required`);
        }

        if (!VALID_MOD_TYPES.has(mod.type)) {
          throw new Error(
            `Variant "${v.name}", modification ${i + 1}: invalid type "${mod.type}". Must be one of: ${[...VALID_MOD_TYPES].join(", ")}`
          );
        }
      }
    }

    if (input.targetingRules) {
      for (let i = 0; i < input.targetingRules.length; i++) {
        const rule = input.targetingRules[i]!;
        if (!VALID_TARGETING_TYPES.has(rule.type)) {
          throw new Error(
            `Targeting rule ${i + 1}: invalid type "${rule.type}". Must be one of: ${[...VALID_TARGETING_TYPES].join(", ")}`
          );
        }
        if (!rule.value?.trim()) {
          throw new Error(`Targeting rule ${i + 1}: value is required`);
        }
      }
    }

    if (input.trafficAllocation < 1 || input.trafficAllocation > 100) {
      throw new Error("Traffic allocation must be between 1 and 100");
    }
  }
}
