import { prisma } from "@/lib/prisma";
import { cacheDel } from "@/lib/redis";
import { generateSlug } from "@/lib/utils";
import type { CreateExperimentSchema, UpdateExperimentSchema } from "@/lib/zod-schemas";
import type { z } from "zod";
import { AuditLogService } from "./audit-log.service";
import { FunctionConfigService } from "./function-config.service";

type CreateExperimentInput = z.infer<typeof CreateExperimentSchema>;
type UpdateExperimentInput = z.infer<typeof UpdateExperimentSchema>;

export class ExperimentService {
  private auditLog: AuditLogService;
  private functionConfig: FunctionConfigService;

  constructor() {
    this.auditLog = new AuditLogService();
    this.functionConfig = new FunctionConfigService();
  }

  async list(shopId: string, filters?: {
    status?: string;
    type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, type, search, limit = 50, offset = 0 } = filters ?? {};

    const [experiments, total] = await prisma.$transaction([
      prisma.experiment.findMany({
        where: {
          shopId,
          ...(status ? { status: status as never } : {}),
          ...(type ? { type: type as never } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          variants: { orderBy: { isControl: "desc" } },
          _count: {
            select: { assignments: true, orderAttributions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.experiment.count({
        where: {
          shopId,
          ...(status ? { status: status as never } : {}),
          ...(type ? { type: type as never } : {}),
        },
      }),
    ]);

    return { experiments, total };
  }

  async get(shopId: string, id: string) {
    const experiment = await prisma.experiment.findFirst({
      where: { id, shopId },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        mutuallyExclusiveGroup: true,
        _count: {
          select: { assignments: true, orderAttributions: true, events: true },
        },
      },
    });

    if (!experiment) throw new Error("Experiment not found");
    return experiment;
  }

  async create(shopId: string, input: CreateExperimentInput, actorId?: string) {
    // Validate variant allocations sum to 100
    const totalAllocation = input.variants.reduce(
      (sum, v) => sum + v.allocationPercent,
      0
    );
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error(
        `Variant allocations must sum to 100%, got ${totalAllocation.toFixed(1)}%`
      );
    }

    // Ensure exactly one control
    const controlVariants = input.variants.filter((v) => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error("Exactly one variant must be marked as control");
    }

    const slug = await this.generateUniqueSlug(shopId, input.name);

    const experiment = await prisma.experiment.create({
      data: {
        shopId,
        name: input.name,
        slug,
        description: input.description,
        hypothesis: input.hypothesis,
        type: input.type,
        status: "DRAFT",
        primaryMetric: input.primaryMetric,
        secondaryMetrics: input.secondaryMetrics,
        trafficAllocation: input.trafficAllocation,
        assignmentStrategy: input.assignmentStrategy,
        mutuallyExclusiveGroupId: input.mutuallyExclusiveGroupId,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        targetingRules: input.targetingRules as never,
        goals: input.goals as never,
        settings: input.settings as never,
        priceConfig: input.priceConfig as never,
        discountConfig: input.discountConfig as never,
        shippingConfig: input.shippingConfig as never,
        contentConfig: input.contentConfig as never,
        splitUrlConfig: input.splitUrlConfig as never,
        variants: {
          create: input.variants.map((v) => ({
            shopId,
            key: v.key,
            name: v.name,
            description: v.description,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            modifications: v.modifications as never,
            priceOverrides: v.priceOverrides as never,
            discountConfig: v.discountConfig as never,
            redirectUrl: v.redirectUrl,
            checkoutBlockIds: v.checkoutBlockIds,
            offerIds: v.offerIds,
            settings: v.settings as never,
          })),
        },
      },
      include: {
        variants: true,
      },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: experiment.id,
      entityName: experiment.name,
      action: "created",
      after: { name: experiment.name, type: experiment.type, status: experiment.status },
    });

    await this.invalidateCache(shopId);

    return experiment;
  }

  async update(shopId: string, id: string, input: UpdateExperimentInput, actorId?: string) {
    const existing = await this.get(shopId, id);

    if (["RUNNING", "COMPLETED", "ARCHIVED"].includes(existing.status)) {
      // Allow limited updates to running experiments
      const allowedFields = ["name", "description", "endsAt", "settings", "goals"];
      const inputKeys = Object.keys(input);
      const disallowed = inputKeys.filter((k) => !allowedFields.includes(k));
      if (disallowed.length > 0) {
        throw new Error(
          `Cannot update ${disallowed.join(", ")} on a ${existing.status} experiment`
        );
      }
    }

    const updated = await prisma.experiment.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.hypothesis !== undefined ? { hypothesis: input.hypothesis } : {}),
        ...(input.primaryMetric !== undefined ? { primaryMetric: input.primaryMetric } : {}),
        ...(input.secondaryMetrics !== undefined ? { secondaryMetrics: input.secondaryMetrics } : {}),
        ...(input.trafficAllocation !== undefined ? { trafficAllocation: input.trafficAllocation } : {}),
        ...(input.assignmentStrategy !== undefined ? { assignmentStrategy: input.assignmentStrategy } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
        ...(input.targetingRules !== undefined ? { targetingRules: input.targetingRules as never } : {}),
        ...(input.goals !== undefined ? { goals: input.goals as never } : {}),
        ...(input.settings !== undefined ? { settings: input.settings as never } : {}),
      },
      include: { variants: true },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: id,
      entityName: updated.name,
      action: "updated",
      before: { status: existing.status },
      after: input,
    });

    await this.invalidateCache(shopId);

    return updated;
  }

  async launch(shopId: string, id: string, actorId?: string) {
    const experiment = await this.get(shopId, id);

    if (!["DRAFT", "QA", "PREVIEW", "PAUSED", "SCHEDULED"].includes(experiment.status)) {
      throw new Error(`Cannot launch experiment with status ${experiment.status}`);
    }

    if (experiment.variants.length < 2) {
      throw new Error("Experiment must have at least 2 variants to launch");
    }

    const updated = await prisma.experiment.update({
      where: { id },
      data: {
        status: "RUNNING",
        launchedAt: new Date(),
        pausedAt: null,
      },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: id,
      entityName: experiment.name,
      action: "launched",
    });

    await this.invalidateCache(shopId);

    // Register discount rules in Shopify Function metafield for discount tests
    if (experiment.type === "DISCOUNT_TEST") {
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { shopDomain: true } });
      if (shop) {
        const variants = experiment.variants.map((v) => ({
          key: v.key,
          isControl: v.isControl,
          discountConfig: v.discountConfig as Record<string, unknown> | null,
        }));
        this.functionConfig
          .registerDiscountExperiment(shop.shopDomain, { id, variants })
          .catch((err) => console.error("[ExperimentService] FunctionConfig register failed:", err));
      }
    }

    return updated;
  }

  async pause(shopId: string, id: string, actorId?: string) {
    const experiment = await this.get(shopId, id);

    if (experiment.status !== "RUNNING") {
      throw new Error("Only RUNNING experiments can be paused");
    }

    const updated = await prisma.experiment.update({
      where: { id },
      data: { status: "PAUSED", pausedAt: new Date() },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: id,
      entityName: experiment.name,
      action: "paused",
    });

    await this.invalidateCache(shopId);

    if (experiment.type === "DISCOUNT_TEST") {
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { shopDomain: true } });
      if (shop) {
        this.functionConfig
          .deregisterDiscountExperiment(shop.shopDomain, id)
          .catch((err) => console.error("[ExperimentService] FunctionConfig deregister failed:", err));
      }
    }

    return updated;
  }

  async complete(shopId: string, id: string, actorId?: string) {
    const experiment = await this.get(shopId, id);

    if (!["RUNNING", "PAUSED"].includes(experiment.status)) {
      throw new Error("Only RUNNING or PAUSED experiments can be completed");
    }

    const updated = await prisma.experiment.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: id,
      entityName: experiment.name,
      action: "completed",
    });

    await this.invalidateCache(shopId);

    if (experiment.type === "DISCOUNT_TEST") {
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { shopDomain: true } });
      if (shop) {
        this.functionConfig
          .deregisterDiscountExperiment(shop.shopDomain, id)
          .catch((err) => console.error("[ExperimentService] FunctionConfig deregister failed:", err));
      }
    }

    return updated;
  }

  async archive(shopId: string, id: string, actorId?: string) {
    const experiment = await this.get(shopId, id);

    const updated = await prisma.experiment.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: id,
      entityName: experiment.name,
      action: "archived",
    });

    await this.invalidateCache(shopId);

    if (experiment.type === "DISCOUNT_TEST") {
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { shopDomain: true } });
      if (shop) {
        this.functionConfig
          .deregisterDiscountExperiment(shop.shopDomain, id)
          .catch((err) => console.error("[ExperimentService] FunctionConfig deregister failed:", err));
      }
    }

    return updated;
  }

  async hardDelete(shopId: string, id: string, actorId?: string) {
    const experiment = await this.get(shopId, id);

    await prisma.experiment.delete({ where: { id } });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: id,
      entityName: experiment.name,
      action: "deleted",
    });

    await this.invalidateCache(shopId);
  }

  async duplicate(shopId: string, id: string, actorId?: string) {
    const source = await prisma.experiment.findFirst({
      where: { id, shopId },
      include: { variants: true },
    });

    if (!source) throw new Error("Experiment not found");

    const slug = await this.generateUniqueSlug(shopId, `${source.name} (Copy)`);

    const copy = await prisma.experiment.create({
      data: {
        shopId,
        name: `${source.name} (Copy)`,
        slug,
        description: source.description,
        hypothesis: source.hypothesis,
        type: source.type,
        status: "DRAFT",
        primaryMetric: source.primaryMetric,
        secondaryMetrics: source.secondaryMetrics,
        trafficAllocation: source.trafficAllocation,
        assignmentStrategy: source.assignmentStrategy,
        targetingRules: source.targetingRules as never,
        goals: source.goals as never,
        settings: source.settings as never,
        priceConfig: source.priceConfig as never,
        discountConfig: source.discountConfig as never,
        shippingConfig: source.shippingConfig as never,
        contentConfig: source.contentConfig as never,
        splitUrlConfig: source.splitUrlConfig as never,
        variants: {
          create: source.variants.map((v: (typeof source.variants)[number]) => ({
            shopId,
            key: v.key,
            name: v.name,
            description: v.description,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            modifications: v.modifications as never,
            priceOverrides: v.priceOverrides as never,
            discountConfig: v.discountConfig as never,
            redirectUrl: v.redirectUrl,
            checkoutBlockIds: v.checkoutBlockIds,
            offerIds: v.offerIds,
            settings: v.settings as never,
          })),
        },
      },
      include: { variants: true },
    });

    await this.auditLog.log({
      shopId,
      actorId,
      entityType: "experiment",
      entityId: copy.id,
      entityName: copy.name,
      action: "duplicated",
      before: { sourceId: id },
    });

    return copy;
  }

  private async generateUniqueSlug(shopId: string, name: string): Promise<string> {
    const base = generateSlug(name);
    let slug = base;
    let counter = 0;

    while (true) {
      const existing = await prisma.experiment.findUnique({
        where: { shopId_slug: { shopId, slug } },
      });
      if (!existing) break;
      counter++;
      slug = `${base}-${counter}`;
    }

    return slug;
  }

  private async invalidateCache(shopId: string): Promise<void> {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { shopDomain: true } });
    if (shop) await cacheDel(`runtime:config:${shop.shopDomain}`);
  }
}
