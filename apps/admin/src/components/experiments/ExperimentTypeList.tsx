"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, ExternalLink, ChevronLeft, ChevronRight, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { getStatusTheme } from "@/lib/design/statusTheme";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/experiments/ExperimentActionsMenu";

// ---------------------------------------------------------------------------
// Status action definitions
// ---------------------------------------------------------------------------
interface ActionDef {
  label: string;
  route: string; // POST /{apiPath}/{id}/{route}
  nextStatus: string;
  variant: "primary" | "ghost" | "danger";
  successMsg: (name: string) => string;
}

function getActions(status: string): ActionDef[] {
  switch (status) {
    case "DRAFT":
      return [{
        label: "Launch",
        route: "launch",
        nextStatus: "RUNNING",
        variant: "primary",
        successMsg: (name) => `"${name}" is now live — visitors are being enrolled.`,
      }];
    case "RUNNING":
      return [
        {
          label: "Pause",
          route: "pause",
          nextStatus: "PAUSED",
          variant: "ghost",
          successMsg: (name) => `"${name}" paused — no new assignments will be made.`,
        },
        {
          label: "Complete",
          route: "complete",
          nextStatus: "COMPLETED",
          variant: "ghost",
          successMsg: (name) => `"${name}" has been marked as complete.`,
        },
      ];
    case "PAUSED":
      return [
        {
          label: "Resume",
          route: "activate",
          nextStatus: "RUNNING",
          variant: "primary",
          successMsg: (name) => `"${name}" resumed — visitor enrollments are active again.`,
        },
        {
          label: "Complete",
          route: "complete",
          nextStatus: "COMPLETED",
          variant: "ghost",
          successMsg: (name) => `"${name}" has been marked as complete.`,
        },
      ];
    default:
      return [];
  }
}

export interface ExperimentRow {
  id: string;
  name: string;
  status: string;
  variantCount: number;
  updatedAt: string;
  launchedAt: string | null;
}

interface Props {
  initialItems: ExperimentRow[];
  initialTotal: number;
  apiPath: string;
  newPath: string;
  newLabel: string;
  detailBasePath?: string;
  pageSize?: number;
  accentHex?: string;
  typeLabel: string;
  typeDescription: string;
  typeEmptyTitle?: string;
  typeEmptyBody?: string;
}

const STATUS_FILTERS = ["All", "DRAFT", "RUNNING", "PAUSED", "COMPLETED", "ARCHIVED"];

export function ExperimentTypeList({
  initialItems,
  initialTotal,
  apiPath,
  newPath,
  newLabel,
  detailBasePath = "/experiments",
  pageSize = 50,
  accentHex = "#6366f1",
  typeLabel,
  typeDescription,
  typeEmptyTitle,
  typeEmptyBody,
}: Props) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const runningCount = items.filter((i) => i.status === "RUNNING").length;

  async function fetchPage(status: string, p: number) {
    const params = new URLSearchParams({ page: String(p), limit: String(pageSize) });
    if (status !== "All") params.set("status", status);
    const res = await fetch(`${apiPath}?${params}`);
    if (!res.ok) {
      toast.error("Failed to load tests. Check your connection and try again.");
      return;
    }
    const data = (await res.json()) as { items: ExperimentRow[]; total: number };
    setItems(data.items);
    setTotal(data.total);
  }

  function handleFilter(s: string) {
    setStatusFilter(s);
    setPage(1);
    startTransition(() => { fetchPage(s, 1); });
  }

  function handlePage(p: number) {
    setPage(p);
    startTransition(() => { fetchPage(statusFilter, p); });
  }

  async function doAction(id: string, action: ActionDef) {
    const expName = items.find((i) => i.id === id)?.name ?? "Test";
    setActionLoading((prev) => ({ ...prev, [id]: action.route }));
    try {
      const res = await fetch(`${apiPath}/${id}/${action.route}`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error || "Action failed");
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: action.nextStatus } : item))
      );
      toast.success(action.successMsg(expName));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Could not ${action.label.toLowerCase()} "${expName}": ${err.message}`
          : `Failed to ${action.label.toLowerCase()} test. Please try again.`
      );
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${apiPath}/${id}/delete`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error || "Delete failed");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      toast.success(`"${name}" was permanently deleted.`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Could not delete "${name}": ${err.message}`
          : `Failed to delete test. Please try again.`
      );
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
    <div className="px-6 py-6 space-y-5">
      {/* Page header with type accent */}
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${accentHex}10 0%, ${accentHex}06 100%)`, border: `1px solid ${accentHex}20` }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accentHex}18` }}
          >
            <FlaskConical className="w-5 h-5" style={{ color: accentHex }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-neutral-900">{typeLabel}</h1>
              {runningCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${accentHex}15`, color: accentHex }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentHex }} />
                  {runningCount} running
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">{typeDescription}</p>
          </div>
        </div>
        <Link href={newPath}>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}dd 100%)` }}
          >
            <Plus className="w-4 h-4" />
            {newLabel}
          </button>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 bg-neutral-100 rounded-lg p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleFilter(s)}
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
      <div className={cn("bg-white rounded-xl border border-neutral-200 overflow-x-auto transition-opacity", isPending ? "opacity-60" : "")}>
        {items.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `${accentHex}12` }}
            >
              <FlaskConical className="w-7 h-7" style={{ color: accentHex }} />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-sm font-semibold text-neutral-800">
                {typeEmptyTitle ?? `No ${typeLabel.toLowerCase()} yet`}
              </p>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                {typeEmptyBody ?? `Create your first ${typeLabel.toLowerCase().replace(/s$/, "")} to start optimizing.`}
              </p>
            </div>
            <Link href={newPath}>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 mt-1"
                style={{ background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}dd 100%)` }}
              >
                <Plus className="w-4 h-4" />
                {newLabel}
              </button>
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/70">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Variants</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((exp) => {
                  const st = getStatusTheme(exp.status);
                  const isRunning = exp.status === "RUNNING";
                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-neutral-50/60 transition-colors group relative"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {isRunning && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full"
                              style={{ background: accentHex }}
                            />
                          )}
                          <Link
                            href={`${detailBasePath}/${exp.id}`}
                            className="font-medium text-neutral-800 hover:text-neutral-900 transition-colors"
                          >
                            {exp.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                          style={{
                            background: `${st.hex}12`,
                            color: st.hex,
                            borderColor: `${st.hex}25`,
                          }}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", isRunning && "animate-pulse")} style={{ background: st.hex }} />
                          {exp.status.charAt(0) + exp.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs font-medium text-neutral-600">{exp.variantCount}</span>
                        <span className="text-xs text-neutral-400 ml-1">variant{exp.variantCount !== 1 ? "s" : ""}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-400">
                        {new Date(exp.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {/* Status action buttons */}
                          {getActions(exp.status).map((action) => {
                            const isLoading = actionLoading[exp.id] === action.route;
                            const anyLoading = !!actionLoading[exp.id];
                            return (
                              <button
                                key={action.route}
                                onClick={() => doAction(exp.id, action)}
                                disabled={anyLoading}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                  action.variant === "primary"
                                    ? "text-white shadow-sm"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                )}
                                style={
                                  action.variant === "primary"
                                    ? { background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}dd 100%)` }
                                    : undefined
                                }
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : null}
                                {action.label}
                              </button>
                            );
                          })}
                          {/* View link */}
                          <Link
                            href={`${detailBasePath}/${exp.id}`}
                            className="inline-flex items-center gap-1 text-xs text-neutral-300 group-hover:text-neutral-500 transition-colors"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                          {/* Delete button */}
                          <button
                            onClick={() => setDeleteTarget({ id: exp.id, name: exp.name })}
                            disabled={!!actionLoading[exp.id]}
                            className="inline-flex items-center p-1 rounded text-neutral-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete test"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 bg-neutral-50/40">
                <p className="text-xs text-neutral-500">{total} test{total !== 1 ? "s" : ""} total</p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => handlePage(page - 1)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-neutral-600 px-2 font-medium">{page} / {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => handlePage(page + 1)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
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

    {deleteTarget && (
      <ConfirmDialog
        title="Delete this test?"
        body={`This will permanently delete "${deleteTarget.name}" and all its data — visitors, assignments, and results. This cannot be undone.`}
        confirmLabel={deleteLoading ? "Deleting…" : "Delete permanently"}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    </>
  );
}
