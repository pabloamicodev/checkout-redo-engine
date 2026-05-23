"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Archive, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  personalizationId: string;
  status: string;
}

const ACTION_LABELS: Record<string, string> = {
  activate: "Personalization activated",
  pause: "Personalization paused",
  archive: "Personalization archived",
};

export function PersonalizationActions({ personalizationId, status }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function callAction(action: "activate" | "pause" | "archive") {
    setLoading(action);
    try {
      const res = await fetch(`/api/personalizations/${personalizationId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      toast.success(ACTION_LABELS[action] ?? "Done");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
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
          style={{ background: "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)" }}
        >
          {loading === "activate"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Play className="w-3.5 h-3.5" />}
          Activate
        </button>
      )}

      {canPause && (
        <button
          onClick={() => callAction("pause")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-60"
        >
          {loading === "pause"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Pause className="w-3.5 h-3.5" />}
          Pause
        </button>
      )}

      {canArchive && (
        <button
          onClick={() => callAction("archive")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading === "archive"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Archive className="w-3.5 h-3.5" />}
          Archive
        </button>
      )}
    </div>
  );
}
