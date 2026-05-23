import { prisma } from "@/lib/prisma";

export interface AuditLogInput {
  shopId: string;
  actorId?: string;
  actorEmail?: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  action: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogService {
  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          shopId: input.shopId,
          actorId: input.actorId ?? "system",
          actorEmail: input.actorEmail,
          entityType: input.entityType,
          entityId: input.entityId,
          entityName: input.entityName,
          action: input.action,
          before: input.before as never,
          after: input.after as never,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      // Audit log failures are non-fatal but should be monitored
      console.error("[AuditLog] Failed to write audit log:", error);
    }
  }

  async list(
    shopId: string,
    filters?: {
      entityType?: string;
      entityId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const { entityType, entityId, action, limit = 50, offset = 0 } = filters ?? {};

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: {
          shopId,
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(action ? { action } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({
        where: {
          shopId,
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(action ? { action } : {}),
        },
      }),
    ]);

    return { logs, total };
  }
}
