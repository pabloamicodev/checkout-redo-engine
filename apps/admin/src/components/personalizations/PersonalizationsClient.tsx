"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getStatusTheme } from "@/lib/design/statusTheme";
import { cn } from "@/lib/utils";
import {
  Plus,
  Play,
  Pause,
  Archive,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Target,
} from "lucide-react";

const ACCENT = "#c026d3";

interface PersonalizationItem {
  id: string;
  name: string;
  status: string;
  priority: number;
  offerIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
}

interface Props {
  initialItems: PersonalizationItem[];
  initialTotal: number;
  pageSize: number;
}

const STATUS_FILTERS = ["All", "DRAFT", "ACTIVE", "SCHEDULED", "PAUSED", "ARCHIVED"] as const;

export function PersonalizationsClient({ initialItems, initialTotal, pageSize }: Props) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function fetchPage(status: string, p: number) {
    const params = new URLSearchParams({ page: String(p), limit: String(pageSize) });
    if (status !== "All") params.set("status", status);
    const res = await fetch(`/api/personalizations?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: PersonalizationItem[]; total: number };
    setItems(data.items);
    setTotal(data.total);
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status);
    setPage(1);
    startTransition(() => { fetchPage(status, 1); });
  }

  function handlePageChange(p: number) {
    setPage(p);
    startTransition(() => { fetchPage(statusFilter, p); });
  }

  async function doAction(id: string, action: "activate" | "pause" | "archive") {
    setOpenMenuId(null);
    const res = await fetch(`/api/personalizations/${id}/${action}`, { method: "POST" });
    if (res.ok) startTransition(() => { fetchPage(statusFilter, page); });
  }

  async function doDelete(id: string) {
    if (!confirm("Delete this personalization? This cannot be undone.")) return;
    setOpenMenuId(null);
    const res = await fetch(`/api/personalizations/${id}`, { method: "DELETE" });
    if (res.ok) startTransition(() => { fetchPage(statusFilter, page); });
  }

  const activeCount = items.filter((i) => i.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      {/* Type header */}
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${ACCENT}10 0%, ${ACCENT}06 100%)`, border: `1px solid ${ACCENT}20` }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ACCENT}18` }}>
            <Target className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-neutral-900">Personalizations</h1>
              {activeCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${ACCENT}15`, color: ACCENT }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">Show specific offers to targeted visitors without splitting traffic.</p>
          </div>
        </div>
        <Link href="/personalizations/new">
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}dd 100%)` }}
          >
            <Plus className="w-4 h-4" />
            New Personalization
          </button>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 bg-neutral-100 rounded-lg p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === s ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {isPending && (
          <div className="w-4 h-4 rounded-full border-2 border-neutral-200 border-t-neutral-400 animate-spin" />
        )}
      </div>

      <div className={cn("bg-white rounded-xl border border-neutral-200 overflow-hidden transition-opacity", isPending ? "opacity-60" : "")}>
        {items.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}12` }}>
              <Target className="w-7 h-7" style={{ color: ACCENT }} />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-sm font-semibold text-neutral-800">No personalizations yet</p>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Show the right offer to the right visitor based on device, location, or behavior.
              </p>
            </div>
            <Link href="/personalizations/new">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 mt-1"
                style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}dd 100%)` }}
              >
                <Plus className="w-4 h-4" />
                New Personalization
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/70">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Priority</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Offers</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Schedule</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((p) => {
                  const st = getStatusTheme(p.status);
                  return (
                  <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors group relative">
                    <td className="px-5 py-3.5">
                      {p.status === "ACTIVE" && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full" style={{ background: ACCENT }} />
                      )}
                      <Link
                        href={`/personalizations/${p.id}`}
                        className="font-medium text-neutral-800 hover:text-neutral-900 transition-colors"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", p.status === "ACTIVE" && "animate-pulse")} style={{ background: st.hex }} />
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="text-xs font-medium text-neutral-600">{p.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-neutral-600">{p.offerIds.length}</span>
                      <span className="text-xs text-neutral-400 ml-1">offer{p.offerIds.length !== 1 ? "s" : ""}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {p.startsAt ? (
                        <span>
                          {new Date(p.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {p.endsAt && ` → ${new Date(p.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </span>
                      ) : (
                        <span className="text-neutral-300">Always on</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/personalizations/${p.id}/analytics`}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                          title="Analytics"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Link>

                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenMenuId(openMenuId === p.id ? null : p.id)
                            }
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {openMenuId === p.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-20">
                                {(p.status === "DRAFT" || p.status === "PAUSED" || p.status === "SCHEDULED") && (
                                  <button
                                    onClick={() => doAction(p.id, "activate")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                  >
                                    <Play className="w-3.5 h-3.5 text-success-600" />
                                    Activate
                                  </button>
                                )}
                                {(p.status === "ACTIVE" || p.status === "SCHEDULED") && (
                                  <button
                                    onClick={() => doAction(p.id, "pause")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                  >
                                    <Pause className="w-3.5 h-3.5 text-warning-600" />
                                    Pause
                                  </button>
                                )}
                                {p.status !== "ARCHIVED" && (
                                  <button
                                    onClick={() => doAction(p.id, "archive")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-neutral-400" />
                                    Archive
                                  </button>
                                )}
                                {p.status !== "ACTIVE" && (
                                  <button
                                    onClick={() => doDelete(p.id)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-600 hover:bg-danger-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 bg-neutral-50/40">
                <p className="text-xs text-neutral-500">{total} personalization{total !== 1 ? "s" : ""} total</p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-neutral-600 px-2 font-medium">{page} / {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
