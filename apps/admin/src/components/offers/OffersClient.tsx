"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getStatusTheme } from "@/lib/design/statusTheme";
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

interface Offer {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialItems: Offer[];
  initialTotal: number;
  pageSize: number;
}

const TYPE_LABEL: Record<string, string> = {
  PERCENTAGE_DISCOUNT: "% Discount",
  FIXED_AMOUNT_DISCOUNT: "Fixed Amount",
  PRODUCT_DISCOUNT: "Product Discount",
  ORDER_DISCOUNT: "Order Discount",
  FREE_SHIPPING: "Free Shipping",
  FREE_GIFT: "Free Gift",
  VOLUME_DISCOUNT: "Volume Discount",
  QUANTITY_BREAK: "Quantity Break",
  BUY_X_GET_Y: "Buy X Get Y",
  TIERED_PROGRESS_BAR: "Tiered Bar",
  CAMPAIGN_LINK_OFFER: "Campaign Link",
};

const STATUS_FILTERS = ["All", "DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

export function OffersClient({ initialItems, initialTotal, pageSize }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<Offer[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function fetchPage(status: string, p: number) {
    const params = new URLSearchParams({ page: String(p), limit: String(pageSize) });
    if (status !== "All") params.set("status", status);
    const res = await fetch(`/api/offers?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: Offer[]; total: number };
    setItems(data.items);
    setTotal(data.total);
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status);
    setPage(1);
    startTransition(() => {
      fetchPage(status, 1);
    });
  }

  function handlePageChange(p: number) {
    setPage(p);
    startTransition(() => {
      fetchPage(statusFilter, p);
    });
  }

  async function doAction(offerId: string, action: "activate" | "pause" | "archive") {
    setOpenMenuId(null);
    const res = await fetch(`/api/offers/${offerId}/${action}`, { method: "POST" });
    if (res.ok) {
      startTransition(() => {
        fetchPage(statusFilter, page);
      });
    }
  }

  function doDelete(offerId: string, offerName: string) {
    setOpenMenuId(null);
    setConfirmDelete({ id: offerId, name: offerName });
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const res = await fetch(`/api/offers/${confirmDelete.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (res.ok) startTransition(() => { fetchPage(statusFilter, page); });
  }

  return (
    <>
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Status tabs */}
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <Link href="/offers-library/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Offer
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-neutral-500">
              No offers found.{" "}
              <Link href="/offers-library/new" className="text-brand-600 hover:underline">
                Create your first offer →
              </Link>
            </p>
          </div>
        ) : (
          <>
            <table className={`w-full text-sm ${isPending ? "opacity-60" : ""}`}>
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((offer) => {
                  const st = getStatusTheme(offer.status);
                  return (
                  <tr key={offer.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/offers-library/${offer.id}`}
                        className="font-medium text-neutral-800 hover:text-brand-600 transition-colors"
                      >
                        {offer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full">
                        {TYPE_LABEL[offer.type] ?? offer.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.hex }} />
                        {offer.status.charAt(0) + offer.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-neutral-400">
                      {new Date(offer.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setOpenMenuId(openMenuId === offer.id ? null : offer.id)
                          }
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openMenuId === offer.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-20">
                              {offer.status === "DRAFT" || offer.status === "PAUSED" ? (
                                <button
                                  onClick={() => doAction(offer.id, "activate")}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                >
                                  <Play className="w-3.5 h-3.5 text-success-600" />
                                  Activate
                                </button>
                              ) : null}
                              {offer.status === "ACTIVE" ? (
                                <button
                                  onClick={() => doAction(offer.id, "pause")}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                >
                                  <Pause className="w-3.5 h-3.5 text-warning-600" />
                                  Pause
                                </button>
                              ) : null}
                              {offer.status !== "ARCHIVED" ? (
                                <button
                                  onClick={() => doAction(offer.id, "archive")}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                >
                                  <Archive className="w-3.5 h-3.5 text-neutral-400" />
                                  Archive
                                </button>
                              ) : null}
                              {offer.status !== "ACTIVE" ? (
                                <button
                                  onClick={() => doDelete(offer.id, offer.name)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-600 hover:bg-danger-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
                <p className="text-xs text-neutral-500">
                  {total} offer{total !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-neutral-600 px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
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

    {confirmDelete && (
      <ConfirmDialog
        title="Delete offer?"
        description={`"${confirmDelete.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    )}
    </>
  );
}
