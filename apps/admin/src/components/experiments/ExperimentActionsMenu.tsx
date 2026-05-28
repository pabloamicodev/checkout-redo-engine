"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Play, Pause, Square, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionDef = {
  key: string;
  label: string;
  icon: React.ReactNode;
  endpoint: string;
  danger?: boolean;
  confirm?: { title: string; body: string; confirmLabel: string };
};

function getActions(status: string): ActionDef[] {
  const a: ActionDef[] = [];

  const canLaunch = ["DRAFT", "QA", "PREVIEW", "SCHEDULED", "PAUSED"].includes(status);
  const canPause = status === "RUNNING";
  const canStop = status === "RUNNING" || status === "PAUSED";
  const canArchive = status !== "ARCHIVED";

  if (canLaunch)
    a.push({
      key: "launch",
      label: status === "PAUSED" ? "Resume test" : "Launch test",
      icon: <Play className="w-3.5 h-3.5" />,
      endpoint: "launch",
    });

  if (canPause)
    a.push({
      key: "pause",
      label: "Pause test",
      icon: <Pause className="w-3.5 h-3.5" />,
      endpoint: "pause",
    });

  if (canStop)
    a.push({
      key: "complete",
      label: "Stop test",
      icon: <Square className="w-3.5 h-3.5 fill-current" />,
      endpoint: "complete",
      danger: true,
      confirm: {
        title: "Stop this test?",
        body: "The test will end and results will be preserved. You won't be able to restart it.",
        confirmLabel: "Stop test",
      },
    });

  if (canArchive)
    a.push({
      key: "archive",
      label: "Archive",
      icon: <Archive className="w-3.5 h-3.5" />,
      endpoint: "archive",
      danger: true,
      confirm: {
        title: "Archive this test?",
        body: "The test will be removed from your list. You can unarchive it from settings later.",
        confirmLabel: "Archive",
      },
    });

  a.push({
    key: "delete",
    label: "Delete",
    icon: <Trash2 className="w-3.5 h-3.5" />,
    endpoint: "delete",
    danger: true,
    confirm: {
      title: "Delete this test?",
      body: "This will permanently delete the test and all its data — visitors, assignments, and results. This cannot be undone.",
      confirmLabel: "Delete permanently",
    },
  });

  return a;
}

// ─── ExperimentActionsMenu ────────────────────────────────────────────────────

interface ExperimentActionsMenuProps {
  experimentId: string;
  status: string;
}

const ACTION_SUCCESS: Record<string, (isPaused: boolean) => string> = {
  launch:   (wasPaused) => wasPaused ? "Test resumed — visitor enrollments are active again." : "Test launched — visitors are being enrolled.",
  pause:    () => "Test paused — no new assignments will be made.",
  complete: () => "Test stopped and results preserved.",
  archive:  () => "Test archived.",
  delete:   () => "Test deleted permanently.",
};

export function ExperimentActionsMenu({ experimentId, status }: ExperimentActionsMenuProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ActionDef | null>(null);
  const router = useRouter();
  const dropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    function onResize() {
      // recompute position on resize
      if (open && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuStyle({ position: "absolute", left: rect.right - 180, top: rect.bottom + 6 });
      }
    }
    document.addEventListener("mousedown", handler);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  async function runAction(action: ActionDef) {
    setLoading(action.key);
    setOpen(false);
    try {
      const res = await fetch(`/api/experiments/${experimentId}/${action.endpoint}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      const msgFn = ACTION_SUCCESS[action.key];
      if (msgFn) toast.success(msgFn(status === "PAUSED"));
      if (action.key === "delete") {
        router.push("/experiments");
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${action.label.toLowerCase()}. Please try again.`);
    } finally {
      setLoading(null);
    }
  }

  function handleClick(action: ActionDef) {
    if (action.confirm) {
      setConfirmAction(action);
      setOpen(false);
    } else {
      runAction(action);
    }
  }

  const actions = getActions(status);
  if (actions.length === 0) return null;

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (loading) return;
            setOpen((o) => {
              const next = !o;
              if (next && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                // position menu so its right edge aligns with trigger's right edge, fallback min width 180
                const left = Math.max(8, rect.right - 180);
                const top = rect.bottom + 6;
                setMenuStyle({ position: "absolute", left, top, minWidth: 180 });
              }
              return next;
            });
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            loading
              ? "text-neutral-300 cursor-wait"
              : open
              ? "bg-neutral-100 text-neutral-700"
              : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          {loading ? (
            <span className="block w-4 h-4 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
          ) : (
            <MoreHorizontal className="w-4 h-4" />
          )}
        </button>

        {open &&
          menuStyle &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropRef}
              style={menuStyle}
              className="z-50 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden"
            >
              {actions.map((action, i) => (
                <button
                  key={action.key}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClick(action);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors text-left ${
                    i > 0 && actions[i - 1]?.danger !== action.danger
                      ? "border-t border-neutral-100"
                      : ""
                  } ${action.danger ? "text-rose-600 hover:bg-rose-50" : "text-neutral-700 hover:bg-neutral-50"}`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>

      {confirmAction?.confirm && (
        <ConfirmDialog
          title={confirmAction.confirm.title}
          body={confirmAction.confirm.body}
          confirmLabel={confirmAction.confirm.confirmLabel}
          onConfirm={() => {
            runAction(confirmAction);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 w-80 mx-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-1.5">{title}</h3>
        <p className="text-xs text-neutral-500 leading-relaxed mb-5">{body}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-xs font-medium text-neutral-700 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
