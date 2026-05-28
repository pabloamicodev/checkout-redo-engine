"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Archive, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  itemId: string;
  status: string;
}

const ACR_MSGS: Record<"activate" | "pause" | "archive", string> = {
  activate: "Recovery campaign activated — it is now live for eligible visitors.",
  pause:    "Recovery campaign paused — it will no longer trigger.",
  archive:  "Recovery campaign archived.",
};

export function AbandonedCartItemActions({ itemId, status }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function callAction(action: "activate" | "pause" | "archive") {
    setLoading(action);
    try {
      const res = await fetch(`/api/personalizations/abandoned-cart/${itemId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      toast.success(ACR_MSGS[action]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${action} recovery campaign. Please try again.`);
    } finally {
      setLoading(null);
    }
  }

  const canActivate = status === "DRAFT" || status === "PAUSED" || status === "SCHEDULED";
  const canPause    = status === "ACTIVE" || status === "SCHEDULED";
  const canArchive  = status !== "ARCHIVED" && status !== "ACTIVE";

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
    </div>
  );
}
