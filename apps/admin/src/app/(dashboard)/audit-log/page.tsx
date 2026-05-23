import { prisma } from "@/lib/prisma";
import { ClipboardList } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
const ACTION_COLORS: Record<string, string> = {
  created: "bg-brand-100 text-brand-700",
  launched: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-neutral-100 text-neutral-700",
  archived: "bg-neutral-100 text-neutral-500",
  updated: "bg-brand-100 text-brand-700",
  deleted: "bg-red-100 text-red-700",
  activated: "bg-emerald-100 text-emerald-700",
  duplicated: "bg-purple-100 text-purple-700",
};

async function getAuditLogs(shopDomain: string, page: number, entityType?: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!shop) return { logs: [], total: 0 };

  const PAGE_SIZE = 50;
  const skip = (page - 1) * PAGE_SIZE;
  const where = { shopId: shop.id, ...(entityType ? { entityType } : {}) };

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE_SIZE, skip }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const shopDomain = await getSessionShop();
  const { page: pageParam, type } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const { logs, total } = await getAuditLogs(shopDomain, page, type);
  type AuditLogRow = (typeof logs)[number];

  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const entityTypes = ["experiment", "variant", "offer", "checkoutBlock", "integration", "shop"];

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Audit Log</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{total.toLocaleString()} events</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 mb-4">
          <Link
            href="/audit-log"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              !type ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
            }`}
          >
            All
          </Link>
          {entityTypes.map((et) => (
            <Link
              key={et}
              href={`/audit-log?type=${et}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                type === et ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
              }`}
            >
              {et}
            </Link>
          ))}
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 py-16 text-center">
            <ClipboardList className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-700 mb-1">No audit events yet</p>
            <p className="text-xs text-neutral-400">All create, update, and status change actions will appear here.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Actor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: AuditLogRow) => (
                    <tr key={log.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${ACTION_COLORS[log.action] ?? "bg-neutral-100 text-neutral-700"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-neutral-800 font-medium capitalize">{log.entityType}</p>
                        {log.entityName && (
                          <p className="text-xs text-neutral-400 mt-0.5">{log.entityName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-500">
                        {log.actorEmail ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-neutral-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-neutral-600">
                <span className="text-xs text-neutral-400">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={`/audit-log?page=${page - 1}${type ? `&type=${type}` : ""}`}
                      className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Previous
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={`/audit-log?page=${page + 1}${type ? `&type=${type}` : ""}`}
                      className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
