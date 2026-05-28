"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getStatusTheme } from "@/lib/design/statusTheme";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  Plus,
  Play,
  Pause,
  Archive,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ACCENT = "#c026d3";

export interface PostPurchaseItem {
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
  initialItems: PostPurchaseItem[];
}

const STATUS_FILTERS = ["All", "DRAFT", "ACTIVE", "SCHEDULED", "PAUSED", "ARCHIVED"] as const;
const PAGE_SIZE = 50;

export function PostPurchaseClient({ initialItems }: Props) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialItems.length);
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function fetchPage(status: string, p: number) {
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (status !== "All") params.set("status", status);
    const res = await fetch(`/api/personalizations/post-purchase?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: PostPurchaseItem[]; total: number };
    setItems(data.items);
    setTotal(data.total);
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status);
    setPage(1);
    startTransition(() => { void fetchPage(status, 1); });
  }

  function handlePageChange(p: number) {
    setPage(p);
    startTransition(() => { void fetchPage(statusFilter, p); });
  }

  const PP_MSGS: Record<"activate" | "pause" | "archive", string> = {
    activate: "Post-purchase upsell activated — it is now live.",
    pause:    "Post-purchase upsell paused — it will no longer be shown.",
    archive:  "Post-purchase upsell archived.",
  };

  async function doAction(id: string, action: "activate" | "pause" | "archive") {
    setOpenMenuId(null);
    const name = items.find((p) => p.id === id)?.name ?? "Post-purchase upsell";
    try {
      const res = await fetch(`/api/personalizations/post-purchase/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      toast.success(PP_MSGS[action]);
      startTransition(() => { void fetchPage(statusFilter, page); });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${action} "${name}". Please try again.`);
    }
  }

  function doDelete(id: string, name: string) {
    setOpenMenuId(null);
    setConfirmDelete({ id, name });
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const name = confirmDelete.name;
    const res = await fetch(`/api/personalizations/post-purchase/${confirmDelete.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (res.ok) {
      toast.success(`"${name}" deleted permanently.`);
      startTransition(() => { void fetchPage(statusFilter, page); });
    } else {
      toast.error(`Could not delete "${name}". Please try again.`);
    }
  }

  const activeCount = items.filter((i) => i.status === "ACTIVE").length;

  return (
    <>
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className=" mx-auto px-8 py-8">
        <div className="space-y-5">
          {/* Header */}
          <div
            className="rounded-2xl px-6 py-5 flex items-center justify-between"
            style={{ background: `linear-gradient(135deg, ${ACCENT}10 0%, ${ACCENT}06 100%)`, border: `1px solid ${ACCENT}20` }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                style={{ background: `${ACCENT}18`, color: ACCENT }}
              >
                ◎
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-neutral-900">Post-Purchase Personalizations</h1>
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
                <p className="text-xs text-neutral-500 mt-0.5">
                  Show targeted offers on the post-purchase page to specific visitor segments.
                </p>
              </div>
            </div>
            <Link href="/personalizations/post-purchase/new">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}dd 100%)` }}
              >
                <Plus className="w-4 h-4" />
                New Post-Purchase
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

          {/* Table */}
          <div className={cn("bg-white rounded-xl border border-neutral-200 overflow-hidden transition-opacity", isPending ? "opacity-60" : "")}>
            {items.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: `${ACCENT}12`, color: ACCENT }}
                >
                  ◎
                </div>
                <div className="text-center max-w-xs">
                  <p className="text-sm font-semibold text-neutral-800">No post-purchase personalizations yet</p>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Show targeted offers on the thank-you page to visitors based on their purchase, device, location, or customer tags.
                  </p>
                </div>
                <Link href="/personalizations/post-purchase/new">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 mt-1"
                    style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}dd 100%)` }}
                  >
                    <Plus className="w-4 h-4" />
                    New Post-Purchase
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
                              href={`/personalizations/post-purchase/${p.id}`}
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
                              <div className="relative">
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
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
                                          onClick={() => void doAction(p.id, "activate")}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                        >
                                          <Play className="w-3.5 h-3.5 text-emerald-600" />
                                          Activate
                                        </button>
                                      )}
                                      {(p.status === "ACTIVE" || p.status === "SCHEDULED") && (
                                        <button
                                          onClick={() => void doAction(p.id, "pause")}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                        >
                                          <Pause className="w-3.5 h-3.5 text-amber-600" />
                                          Pause
                                        </button>
                                      )}
                                      {p.status !== "ARCHIVED" && (
                                        <button
                                          onClick={() => void doAction(p.id, "archive")}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                        >
                                          <Archive className="w-3.5 h-3.5 text-neutral-400" />
                                          Archive
                                        </button>
                                      )}
                                      {p.status !== "ACTIVE" && (
                                        <button
                                          onClick={() => doDelete(p.id, p.name)}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
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
      </div>
    </div>

    {confirmDelete && (
      <ConfirmDialog
        title="Delete post-purchase personalization?"
        description={`"${confirmDelete.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    )}
    </>
  );
}
