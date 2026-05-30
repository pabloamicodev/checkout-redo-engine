"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Archive, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  blockId: string;
  status: string;
}

const BLOCK_MSGS: Record<"activate" | "pause" | "archive", string> = {
  activate: "Checkout block activated — it is now live.",
  pause:    "Checkout block paused — it will no longer be shown.",
  archive:  "Checkout block archived.",
};

export function CheckoutBlockActions({ blockId, status }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function callAction(action: "activate" | "pause" | "archive") {
    setLoading(action);
    try {
      const res = await fetch(`/api/checkout-blocks/${blockId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      toast.success(BLOCK_MSGS[action]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${action} block. Please try again.`);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this checkout block permanently? This cannot be undone.")) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/checkout-blocks/${blockId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const d = (await res.json()).catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      toast.success("Checkout block deleted.");
      router.push("/checkout-blocks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete block. Please try again.");
      setLoading(null);
    }
  }

  const canActivate = status === "DRAFT" || status === "PAUSED";
  const canPause    = status === "ACTIVE";
  const canArchive  = status !== "ARCHIVED";

  return (
    <div className="flex items-center gap-2">
      {canActivate && (
        <button
          onClick={() => callAction("activate")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
        >
          {loading === "activate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Activate
        </button>
      )}

      {canPause && (
        <button
          onClick={() => callAction("pause")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-60"
        >
          {loading === "pause" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
          Pause
        </button>
      )}

      {canArchive && (
        <button
          onClick={() => callAction("archive")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading === "archive" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
          Archive
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60"
      >
        {loading === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete
      </button>
    </div>
  );
}
