"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Play, Pause, CheckCircle2, Copy, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDestructiveModal } from "@/components/ui/Modal";

interface Props {
  experimentId: string;
  status: string;
  accentHex?: string;
  /** Base API path for action endpoints. Defaults to /api/experiments */
  apiBase?: string;
  /** Where to redirect after a successful delete. Defaults to the non-/api equivalent of apiBase. */
  listPath?: string;
}

const ACTION_LABELS: Record<string, string> = {
  launch: "Test launched",
  pause: "Test paused",
  complete: "Test completed",
  archive: "Test archived",
  duplicate: "Test duplicated",
  delete: "Test deleted permanently",
};

export function ExperimentActions({ experimentId, status, accentHex, apiBase = "/api/experiments", listPath }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  // Derive the list page path from apiBase if not explicitly provided
  // e.g. /api/checkout-tests → /checkout-tests, /api/experiments → /experiments
  const resolvedListPath = listPath ?? apiBase.replace(/^\/api\//, "/");

  // Guard modal state
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const canLaunch = ["DRAFT", "QA", "PREVIEW", "PAUSED", "SCHEDULED"].includes(status);
  const canPause = status === "RUNNING";
  const canComplete = ["RUNNING", "PAUSED"].includes(status);
  const canArchive = !["RUNNING"].includes(status);

  async function doAction(action: "launch" | "pause" | "complete" | "archive" | "duplicate" | "delete") {
    setLoading(action);
    try {
      const res = await fetch(`${apiBase}/${experimentId}/${action}`, { method: "POST" });
      const data = await res.json() as { error?: string; experiment?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast.success(ACTION_LABELS[action] ?? "Done");
      if (action === "delete") {
        router.push(resolvedListPath);
      } else if (action === "duplicate" && data.experiment) {
        router.push(`/experiments/${data.experiment.id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleCompleteConfirm() {
    setCompleteModalOpen(false);
    await doAction("complete");
  }

  async function handleArchiveConfirm() {
    setArchiveModalOpen(false);
    await doAction("archive");
  }

  async function handleDeleteConfirm() {
    setDeleteModalOpen(false);
    await doAction("delete");
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<Copy className="w-3.5 h-3.5" />}
          onClick={() => doAction("duplicate")}
          loading={loading === "duplicate"}
        >
          Duplicate
        </Button>

        {canArchive && status !== "DRAFT" && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Archive className="w-3.5 h-3.5" />}
            onClick={() => setArchiveModalOpen(true)}
            loading={loading === "archive"}
            disabled={loading !== null}
          >
            Archive
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
          onClick={() => setDeleteModalOpen(true)}
          loading={loading === "delete"}
          disabled={loading !== null}
          className="text-rose-500 hover:bg-rose-50"
        >
          Delete
        </Button>

        {canLaunch && (
          <button
            onClick={() => doAction("launch")}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={accentHex
              ? { background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}cc 100%)` }
              : { background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }
            }
          >
            {loading === "launch"
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
            Launch
          </button>
        )}
        {canPause && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Pause className="w-3.5 h-3.5" />}
            onClick={() => doAction("pause")}
            loading={loading === "pause"}
          >
            Pause
          </Button>
        )}
        {canComplete && (
          <Button
            size="sm"
            variant="secondary"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => setCompleteModalOpen(true)}
            loading={loading === "complete"}
            disabled={loading !== null}
          >
            Complete
          </Button>
        )}
      </div>

      {/* Complete guard modal */}
      <ConfirmDestructiveModal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        onConfirm={handleCompleteConfirm}
        title="Complete this test?"
        description="Completing the test stops data collection. You can still view results but cannot restart it."
        confirmLabel="Complete test"
        confirmVariant="warning"
        loading={loading === "complete"}
      />

      {/* Archive guard modal */}
      <ConfirmDestructiveModal
        open={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onConfirm={handleArchiveConfirm}
        title="Archive this test?"
        description="Archiving removes this test from active view. Results are preserved."
        confirmLabel="Archive test"
        confirmVariant="danger"
        loading={loading === "archive"}
      />

      {/* Delete guard modal */}
      <ConfirmDestructiveModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete this test?"
        description="This will permanently delete the test and all its data — visitors, assignments, and results. This cannot be undone."
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={loading === "delete"}
      />
    </>
  );
}
