import { prisma } from "@/lib/prisma";
import { ExperimentService } from "@/services/experiment.service";
import { generateSlug } from "@/lib/utils";

const experimentService = new ExperimentService();

export interface PersonalizationAction {
  type: string;
  selector?: string;
  content?: string;
  offerId?: string;
}

export interface PersonalizationVariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  actions?: PersonalizationAction[];
}

export interface CreatePersonalizationTestInput {
  name: string;
  hypothesis?: string;
  targetingRules?: unknown[];
  ruleOperator?: "AND" | "OR";
  trafficAllocation?: number;
  variants: PersonalizationVariantConfig[];
}

export interface UpdatePersonalizationTestInput {
  name?: string;
  hypothesis?: string;
}

export class PersonalizationTestService {
  async list(shopId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const page = Math.max(0, (opts.page ?? 1) - 1);
    const where = {
      shopId,
      type: "PERSONALIZATION_TEST" as const,
      ...(opts.status ? { status: opts.status as never } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * limit,
        take: limit,
        include: { variants: { select: { id: true } } },
      }),
      prisma.experiment.count({ where }),
    ]);
    return { items, total };
  }

  async get(shopId: string, id: string) {
    const exp = await prisma.experiment.findFirst({
      where: { id, shopId, type: "PERSONALIZATION_TEST" },
      include: {
        variants: { orderBy: { isControl: "desc" } },
        mutuallyExclusiveGroup: true,
        _count: { select: { assignments: true, orderAttributions: true, events: true } },
      },
    });
    if (!exp) throw new Error("Personalization test not found");
    return exp;
  }

  async create(shopId: string, input: CreatePersonalizationTestInput) {
    if (input.variants.length < 1) throw new Error("At least one variant is required");

    const totalAlloc = input.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.round(totalAlloc) !== 100) throw new Error("Variant allocations must sum to 100");

    const controlVariants = input.variants.filter((v) => v.isControl);
    if (controlVariants.length !== 1) throw new Error("Exactly one control variant required");

    const slug = await this.generateUniqueSlug(shopId, input.name);

    return prisma.experiment.create({
      data: {
        shopId,
        name: input.name,
        slug,
        hypothesis: input.hypothesis,
        type: "PERSONALIZATION_TEST",
        trafficAllocation: input.trafficAllocation ?? 100,
        targetingRules: (input.targetingRules ?? []) as never,
        variants: {
          create: input.variants.map((v) => ({
            shopId,
            key: v.key,
            name: v.name,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            modifications: (v.actions
              ? v.actions.map((a) => ({
                  type: a.type,
                  selector: a.selector,
                  content: a.content,
                  offerId: a.offerId,
                }))
              : []) as never,
          })),
        },
      },
      include: { variants: true },
    });
  }

  async update(shopId: string, id: string, input: UpdatePersonalizationTestInput) {
    await this.get(shopId, id);
    return prisma.experiment.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.hypothesis !== undefined && { hypothesis: input.hypothesis }),
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
    if (exp.status !== "RUNNING") throw new Error(`Cannot pause a test with status "${exp.status}"`);
    return experimentService.pause(shopId, id);
  }

  async archive(shopId: string, id: string) {
    await this.get(shopId, id);
    return prisma.experiment.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
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
}
