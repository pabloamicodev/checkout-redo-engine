"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Square, Archive, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ExperimentActionsMenu";

interface ExperimentStatusActionsProps {
  experimentId: string;
  status: string;
}

type ActionKey = "launch" | "pause" | "complete" | "archive" | "delete";

const CONFIRM_CONFIG: Partial<Record<ActionKey, { title: string; body: string; confirmLabel: string }>> = {
  complete: {
    title: "Stop this test?",
    body: "The test will end and results will be preserved. You won't be able to restart it.",
    confirmLabel: "Stop test",
  },
  archive: {
    title: "Archive this test?",
    body: "The test will be removed from your list. You can unarchive it from settings later.",
    confirmLabel: "Archive",
  },
  delete: {
    title: "Delete this test?",
    body: "This will permanently delete the test and all its data — visitors, assignments, and results. This cannot be undone.",
    confirmLabel: "Delete permanently",
  },
};

export function ExperimentStatusActions({ experimentId, status }: ExperimentStatusActionsProps) {
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [confirmKey, setConfirmKey] = useState<ActionKey | null>(null);
  const router = useRouter();

  const canLaunch = ["DRAFT", "QA", "PREVIEW", "SCHEDULED", "PAUSED"].includes(status);
  const canPause = status === "RUNNING";
  const canStop = status === "RUNNING" || status === "PAUSED";
  const canArchive = status !== "ARCHIVED" && status !== "DRAFT";

  async function runAction(key: ActionKey) {
    setLoading(key);
    try {
      const res = await fetch(`/api/experiments/${experimentId}/${key}`, { method: "POST" });
      if (!res.ok) throw new Error();
      if (key === "delete") {
        router.push("/experiments");
      } else {
        router.refresh();
      }
    } catch {
      // TODO: toast
    } finally {
      setLoading(null);
    }
  }

  function handleClick(key: ActionKey) {
    if (CONFIRM_CONFIG[key]) {
      setConfirmKey(key);
    } else {
      runAction(key);
    }
  }

  const isLoading = (key: ActionKey) => loading === key;
  const spinner = (
    <span className="block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
  );

  // Delete is always available, so we always render

  return (
    <>
      <div className="flex items-center gap-2">
        {canLaunch && (
          <button
            onClick={() => handleClick("launch")}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-60 disabled:cursor-wait active:scale-95"
            style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
          >
            {isLoading("launch") ? spinner : <Play className="w-3.5 h-3.5" />}
            {status === "PAUSED" ? "Resume" : "Launch"}
          </button>
        )}

        {canPause && (
          <button
            onClick={() => handleClick("pause")}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-60 disabled:cursor-wait active:scale-95 text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100"
          >
            {isLoading("pause") ? spinner : <Pause className="w-3.5 h-3.5" />}
            Pause
          </button>
        )}

        {canStop && (
          <button
            onClick={() => handleClick("complete")}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-60 disabled:cursor-wait active:scale-95 text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100"
          >
            {isLoading("complete") ? spinner : <Square className="w-3.5 h-3.5 fill-current" />}
            Stop
          </button>
        )}

        {canArchive && (
          <button
            onClick={() => handleClick("archive")}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-60 disabled:cursor-wait active:scale-95 text-neutral-500 border-neutral-200 hover:bg-neutral-100"
          >
            {isLoading("archive") ? spinner : <Archive className="w-3.5 h-3.5" />}
            Archive
          </button>
        )}

        <button
          onClick={() => handleClick("delete")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-60 disabled:cursor-wait active:scale-95 text-rose-600 border-rose-200 hover:bg-rose-50"
        >
          {isLoading("delete") ? spinner : <Trash2 className="w-3.5 h-3.5" />}
          Delete
        </button>
      </div>

      {confirmKey && CONFIRM_CONFIG[confirmKey] && (
        <ConfirmDialog
          title={CONFIRM_CONFIG[confirmKey]!.title}
          body={CONFIRM_CONFIG[confirmKey]!.body}
          confirmLabel={CONFIRM_CONFIG[confirmKey]!.confirmLabel}
          onConfirm={() => {
            runAction(confirmKey);
            setConfirmKey(null);
          }}
          onCancel={() => setConfirmKey(null)}
        />
      )}
    </>
  );
}
