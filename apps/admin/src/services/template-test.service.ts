import { ExperimentService } from "./experiment.service";
import { prisma } from "@/lib/prisma";

const experimentService = new ExperimentService();

export class TemplateTestService {
  async create(shopId: string, data: {
    name: string;
    hypothesis?: string;
    templateId?: string;
    variants: { name: string; isControl: boolean; allocation: number; settings?: Record<string, unknown> }[];
    targetingRules?: unknown[];
    trafficAllocation?: number;
  }) {
    // Guard: at least 2 variants
    if (!data.variants || data.variants.length < 2) {
      throw new Error("Template test requires at least 2 variants");
    }
    // Guard: exactly 1 control
    const controls = data.variants.filter(v => v.isControl);
    if (controls.length !== 1) {
      throw new Error("Template test requires exactly one control variant");
    }
    return experimentService.create(shopId, {
      name: data.name,
      type: "TEMPLATE_TEST",
      hypothesis: data.hypothesis,
      primaryMetric: "conversion_rate",
      secondaryMetrics: ["revenue_per_visitor", "average_order_value"],
      assignmentStrategy: "visitor",
      variants: data.variants.map((v, i) => ({
        key: v.isControl ? "control" : `variant_${String.fromCharCode(96 + i)}`,
        name: v.name,
        isControl: v.isControl,
        allocationPercent: v.allocation,
        settings: v.settings ?? {},
        modifications: [],
        priceOverrides: [],
        checkoutBlockIds: [],
        offerIds: [],
        redirectUrl: null,
      })),
      targetingRules: (data.targetingRules ?? []) as never[],
      trafficAllocation: data.trafficAllocation ?? 100,
      settings: { templateId: data.templateId },
      goals: [],
    });
  }

  async list(shopId: string, opts?: { limit?: number; offset?: number; status?: string }) {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;

    const where = {
      shopId,
      type: "TEMPLATE_TEST" as const,
      ...(opts?.status ? { status: opts.status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: {
          variants: {
            select: { id: true, key: true, name: true, isControl: true, allocationPercent: true },
            orderBy: { isControl: "desc" },
          },
          _count: { select: { assignments: true, orderAttributions: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total };
  }

  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "TEMPLATE_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        _count: { select: { assignments: true, orderAttributions: true } },
      },
    });
    if (!exp) throw new Error("Template test not found");
    return exp;
  }

  async activate(shopId: string, id: string) {
    // Guard: activation requires ≥ 2 variants (also enforced by experimentService.launch)
    const exp = await this.get(shopId, id);

    // Guard: no other RUNNING template test with the same templateId
    const templateId = (exp.settings as Record<string, unknown> | null)?.templateId as string | undefined;
    if (templateId) {
      const conflict = await prisma.experiment.findFirst({
        where: {
          shopId,
          type: "TEMPLATE_TEST",
          status: "RUNNING",
          id: { not: id },
          settings: { path: ["templateId"], equals: templateId },
        },
        select: { id: true, name: true },
      });
      if (conflict) {
        throw new Error(
          `Template "${templateId}" is already being tested in another running experiment ("${conflict.name}"). Pause that test before activating this one.`
        );
      }
    }

    return experimentService.launch(shopId, id);
  }

  async pause(shopId: string, id: string) {
    return experimentService.pause(shopId, id);
  }

  async archive(shopId: string, id: string) {
    return experimentService.archive(shopId, id);
  }

  async duplicate(shopId: string, id: string) {
    return experimentService.duplicate(shopId, id);
  }
}
