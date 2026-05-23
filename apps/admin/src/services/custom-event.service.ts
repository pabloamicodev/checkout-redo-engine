import { prisma } from "@/lib/prisma";

export interface CreateCustomEventInput {
  name: string;
  displayName: string;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface UpdateCustomEventInput {
  displayName?: string;
  description?: string;
  schema?: Record<string, unknown>;
}

export class CustomEventService {
  async list(shopId: string) {
    const events = await prisma.customEvent.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
    });
    return { events };
  }

  async get(shopId: string, id: string) {
    const event = await prisma.customEvent.findFirst({ where: { id, shopId } });
    if (!event) throw new Error("Custom event not found");
    return event;
  }

  async create(shopId: string, input: CreateCustomEventInput) {
    if (!/^[a-z0-9_]+$/.test(input.name)) {
      throw new Error("name must be lowercase alphanumeric with underscores only");
    }
    const existing = await prisma.customEvent.findUnique({
      where: { shopId_name: { shopId, name: input.name } },
    });
    if (existing) throw new Error(`A custom event named "${input.name}" already exists`);

    return prisma.customEvent.create({
      data: {
        shopId,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        schema: (input.schema ?? {}) as never,
      },
    });
  }

  async update(shopId: string, id: string, input: UpdateCustomEventInput) {
    await this.get(shopId, id);
    return prisma.customEvent.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.schema !== undefined && { schema: input.schema as never }),
      },
    });
  }

  async delete(shopId: string, id: string) {
    await this.get(shopId, id);
    await prisma.customEvent.delete({ where: { id } });
  }
}
