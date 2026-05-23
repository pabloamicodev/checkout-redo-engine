"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Archive, Loader2 } from "lucide-react";

interface Props {
  blockId: string;
  status: string;
}

export function CheckoutBlockActions({ blockId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callAction(action: "activate" | "pause" | "archive") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/checkout-blocks/${blockId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  const canActivate = status === "DRAFT" || status === "PAUSED";
  const canPause    = status === "ACTIVE";
  const canArchive  = status !== "ARCHIVED";

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</span>
      )}

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
    </div>
  );
}
