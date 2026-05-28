"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export const SAVE_GROUPS_EVENT = "marginlab:save-groups";
export const SAVE_GROUPS_RESULT_EVENT = "marginlab:save-groups-result";

// Tabs that have actual editable content triggered by the Save button
const SAVEABLE_TABS = new Set(["groups"]);

interface Props {
  experimentId: string;
  currentTab: string;
}

export function ExperimentSaveButton({ experimentId, currentTab }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Listen for result from TestGroupsEditor
  useEffect(() => {
    function onResult(e: Event) {
      const { experimentId: eid, ok, error } = (e as CustomEvent<{ experimentId: string; ok: boolean; error?: string }>).detail;
      if (eid !== experimentId) return;
      setSaving(false);
      if (ok) {
        setSaved(true);
        toast.success("Test groups saved.");
        setTimeout(() => setSaved(false), 2000);
      } else {
        toast.error(error ?? "Could not save. Please try again.");
      }
    }
    window.addEventListener(SAVE_GROUPS_RESULT_EVENT, onResult);
    return () => window.removeEventListener(SAVE_GROUPS_RESULT_EVENT, onResult);
  }, [experimentId, toast]);

  const handleClick = useCallback(() => {
    if (currentTab === "groups") {
      setSaving(true);
      setSaved(false);
      window.dispatchEvent(
        new CustomEvent(SAVE_GROUPS_EVENT, { detail: { experimentId } })
      );
    } else {
      toast.info("This tab doesn't have unsaved settings.");
    }
  }, [currentTab, experimentId, toast]);

  const isSaveable = SAVEABLE_TABS.has(currentTab);

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-opacity disabled:opacity-70"
      style={{
        background: saved
          ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
          : isSaveable
          ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
          : "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)",
      }}
    >
      {saving ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving…
        </>
      ) : saved ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Saved
        </>
      ) : (
        "Save"
      )}
    </button>
  );
}
