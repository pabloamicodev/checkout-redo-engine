"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, debounce, formatNumber } from "@/lib/utils";
import type { CogsListItem, CogsCoverage } from "@/services/cogs.service";

interface Props {
  initialItems: CogsListItem[];
  initialTotal: number;
  initialCoverage: CogsCoverage;
  currencyCode: string;
}

type StatusMsg = { type: "success" | "error" | "warning"; text: string } | null;

const PAGE_SIZE = 50;

export function CogsClient({
  initialItems,
  initialTotal,
  initialCoverage,
  currencyCode,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [coverage, setCoverage] = useState(initialCoverage);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState("");

  // Add manual entry state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVariantId, setNewVariantId] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newCurrency, setNewCurrency] = useState(currencyCode);

  // Operation states
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState<{ rowCount: number; file: File } | null>(null);
  const [overwriteManual, setOverwriteManual] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMsg>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (msg: StatusMsg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const fetchPage = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
        ...(q ? { search: q } : {}),
      });
      const res = await fetch(`/api/settings/cogs?${params}`);
      if (!res.ok) return;
      const data = await res.json() as {
        items: CogsListItem[];
        total: number;
        coverage: CogsCoverage;
      };
      setItems(data.items);
      setTotal(data.total);
      setCoverage(data.coverage);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((q: string) => {
      setPage(1);
      fetchPage(1, q);
    }, 400),
    [fetchPage]
  );

  const handleSearchChange = (q: string) => {
    setSearch(q);
    debouncedSearch(q);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchPage(p, search);
  };

  // ── Inline edit ──────────────────────────────────────────────────────────

  const startEdit = (item: CogsListItem) => {
    setEditingId(item.id);
    setEditCost(String(item.cost));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCost("");
  };

  const saveEdit = async (id: string) => {
    const cost = parseFloat(editCost);
    if (!Number.isFinite(cost) || cost <= 0) {
      showStatus({ type: "error", text: "Cost must be a positive number" });
      return;
    }
    try {
      const res = await fetch(`/api/settings/cogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        showStatus({ type: "error", text: err.error });
        return;
      }
      showStatus({ type: "success", text: "Cost updated" });
      cancelEdit();
      fetchPage(page, search);
    } catch {
      showStatus({ type: "error", text: "Failed to save" });
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, sku: string | null) => {
    if (!confirm(`Delete cost for ${sku ?? id}?`)) return;
    try {
      await fetch(`/api/settings/cogs/${id}`, { method: "DELETE" });
      fetchPage(page, search);
    } catch {
      showStatus({ type: "error", text: "Failed to delete" });
    }
  };

  // ── Manual add ───────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const cost = parseFloat(newCost);
    if (!newVariantId.trim()) {
      showStatus({ type: "error", text: "Variant ID is required" });
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      showStatus({ type: "error", text: "Cost must be a positive number" });
      return;
    }
    try {
      const res = await fetch("/api/settings/cogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: newVariantId.trim(),
          cost,
          sku: newSku.trim() || undefined,
          currencyCode: newCurrency.trim() || currencyCode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        showStatus({ type: "error", text: err.error });
        return;
      }
      showStatus({ type: "success", text: "Cost added" });
      setShowAddForm(false);
      setNewVariantId("");
      setNewSku("");
      setNewCost("");
      fetchPage(1, search);
    } catch {
      showStatus({ type: "error", text: "Failed to add" });
    }
  };

  // ── Shopify sync ─────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/settings/cogs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwriteManual }),
      });
      const data = await res.json() as { synced: number; skipped: number; errors: number; message?: string };
      if (res.ok) {
        showStatus({
          type: data.errors > 0 ? "warning" : "success",
          text: `Synced ${data.synced} variants (${data.skipped} skipped, ${data.errors} errors)`,
        });
        fetchPage(1, search);
      } else {
        showStatus({ type: "error", text: "Sync failed. Check Shopify scopes." });
      }
    } finally {
      setSyncing(false);
    }
  };

  // ── CSV import ───────────────────────────────────────────────────────────

  const doImport = async (file: File, force = false) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("overwriteManual", String(overwriteManual));
      fd.append("force", String(force));

      const res = await fetch("/api/settings/cogs/import", { method: "POST", body: fd });
      const data = await res.json() as {
        requiresConfirmation?: boolean;
        rowCount?: number;
        imported?: number;
        skipped?: number;
        errors?: string[];
      };

      if (res.status === 202 && data.requiresConfirmation) {
        setConfirmImport({ rowCount: data.rowCount!, file });
        return;
      }

      const errCount = data.errors?.length ?? 0;
      if (errCount > 0) {
        showStatus({
          type: "warning",
          text: `Imported ${data.imported}, skipped ${data.skipped}. ${errCount} error(s): ${data.errors![0]}`,
        });
      } else {
        showStatus({
          type: "success",
          text: `Imported ${data.imported} variants (${data.skipped} skipped)`,
        });
      }
      setConfirmImport(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchPage(1, search);
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await doImport(file, false);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* ── Status message ── */}
      {statusMsg && (
        <div
          className={`flex items-start gap-3 p-3 rounded-xl text-sm ${
            statusMsg.type === "success"
              ? "bg-success-50 border border-success-200 text-success-800"
              : statusMsg.type === "warning"
              ? "bg-warning-50 border border-warning-200 text-warning-800"
              : "bg-danger-50 border border-danger-200 text-danger-800"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ── Coverage meter ── */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              COGS Coverage (last 30 days)
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {coverage.ordersWithCogs} of {coverage.ordersLast30Days} attributed orders had COGS data ·{" "}
              {formatNumber(coverage.totalProductCosts)} variants configured
            </p>
          </div>
          <span
            className={`text-2xl font-bold tabular-nums ${
              coverage.belowWarningThreshold ? "text-warning-600" : "text-success-600"
            }`}
          >
            {coverage.coveragePct}%
          </span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              coverage.belowWarningThreshold ? "bg-warning-500" : "bg-success-500"
            }`}
            style={{ width: `${coverage.coveragePct}%` }}
          />
        </div>
        {coverage.belowWarningThreshold && (
          <p className="text-xs text-warning-700 mt-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Coverage below 80% — profit analytics may be inaccurate. Import or sync more costs.
          </p>
        )}
      </div>

      {/* ── Actions row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search SKU or variant ID…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 min-w-48 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteManual}
              onChange={(e) => setOverwriteManual(e.target.checked)}
              className="rounded"
            />
            Overwrite manual
          </label>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from Shopify"}
        </button>

        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          {importing ? "Importing…" : "Upload CSV"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            disabled={importing}
            onChange={handleFileChange}
          />
        </label>

        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add manually
        </button>
      </div>

      {/* ── CSV download template ── */}
      <p className="text-xs text-neutral-400">
        CSV template:{" "}
        <a
          href="data:text/csv;charset=utf-8,variant_id%2Csku%2Ccost%2Ccurrency%0Agid%3A%2F%2Fshopify%2FProductVariant%2F123%2CSKU-001%2C9.99%2CUSD"
          download="cogs_template.csv"
          className="text-brand-600 hover:underline"
        >
          download template
        </a>
        {" "}· Required columns: <code className="font-mono">variant_id</code>,{" "}
        <code className="font-mono">cost</code> · Optional:{" "}
        <code className="font-mono">sku</code>, <code className="font-mono">currency</code>
      </p>

      {/* ── Bulk confirm dialog ── */}
      {confirmImport && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-800">Large CSV detected</p>
            <p className="text-xs text-warning-700 mt-1">
              This file contains <strong>{confirmImport.rowCount.toLocaleString()}</strong> rows.
              Continue importing?
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => doImport(confirmImport.file, true)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-warning-600 rounded-lg hover:bg-warning-700"
              >
                Yes, import all
              </button>
              <button
                onClick={() => setConfirmImport(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual add form ── */}
      {showAddForm && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-900 mb-3">Add cost manually</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Variant ID *
              </label>
              <input
                type="text"
                value={newVariantId}
                onChange={(e) => setNewVariantId(e.target.value)}
                placeholder="gid://shopify/... or numeric"
                className="w-full text-xs border border-neutral-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">SKU</label>
              <input
                type="text"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                placeholder="optional"
                className="w-full text-xs border border-neutral-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Cost *
              </label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="9.99"
                className="w-full text-xs border border-neutral-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Currency
              </label>
              <input
                type="text"
                maxLength={3}
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                className="w-full text-xs border border-neutral-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
            >
              Save
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Cost table ── */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">
            {total.toLocaleString()} variant{total !== 1 ? "s" : ""} configured
          </p>
          {loading && (
            <span className="text-xs text-neutral-400 animate-pulse">Loading…</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            {search ? "No results for this search" : "No costs configured yet"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">
                      Variant ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">
                      Source
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {items.map((item) => {
                    const isEditing = editingId === item.id;
                    const shortId = item.shopifyVariantId
                      .replace("gid://shopify/ProductVariant/", "")
                      .slice(0, 16);
                    return (
                      <tr key={item.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 font-mono text-xs text-neutral-500">
                          {shortId}
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-600">
                          {item.sku ?? <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-neutral-900">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(item.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              className="w-24 text-right text-xs border border-brand-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          ) : (
                            formatCurrency(item.cost, item.currencyCode)
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                              item.source === "MANUAL"
                                ? "bg-brand-50 text-brand-700"
                                : item.source === "SHOPIFY_API"
                                ? "bg-success-50 text-success-700"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {item.source === "SHOPIFY_API"
                              ? "Shopify"
                              : item.source === "CSV_IMPORT"
                              ? "CSV"
                              : "Manual"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(item.id)}
                                  className="p-1 rounded text-success-600 hover:bg-success-50"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 rounded text-neutral-500 hover:bg-neutral-100"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(item)}
                                  className="p-1 rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                                  title="Edit cost"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id, item.sku)}
                                  className="p-1 rounded text-neutral-400 hover:bg-danger-50 hover:text-danger-600"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <span>
                  Page {page} of {totalPages} · {total.toLocaleString()} total
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded hover:bg-neutral-100 disabled:opacity-40"
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
