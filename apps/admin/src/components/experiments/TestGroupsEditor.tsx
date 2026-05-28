"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, ArrowLeftRight, Plus, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SAVE_GROUPS_EVENT, SAVE_GROUPS_RESULT_EVENT } from "./ExperimentSaveButton";

interface Group {
  id: string;
  name: string;
  percent: number;
  isControl: boolean;
}

interface Props {
  initialVariants: { id: string; name: string; isControl: boolean; allocationPercent: number }[];
  experimentId?: string;
}

// Group colors: blue for control, green for first variant, then others
const GROUP_COLORS = [
  { border: "#6366f1", text: "#6366f1", track: "#6366f1", bg: "#eff6ff" },
  { border: "#0e9f6e", text: "#0e9f6e", track: "#0e9f6e", bg: "#ecfdf5" },
  { border: "#7c3aed", text: "#7c3aed", track: "#7c3aed", bg: "#f5f3ff" },
  { border: "#d97706", text: "#d97706", track: "#d97706", bg: "#fffbeb" },
  { border: "#dc2626", text: "#dc2626", track: "#dc2626", bg: "#fef2f2" },
];

export function TestGroupsEditor({ initialVariants, experimentId }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(() =>
    initialVariants.map((v) => ({
      id: v.id,
      name: v.name,
      percent: v.allocationPercent,
      isControl: v.isControl,
    }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const saveGroups = useCallback(async (dispatchResult = false) => {
    if (!experimentId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/experiments/${experimentId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants: groups.map((g) => ({
            id: g.id,
            name: g.name,
            allocationPercent: g.percent,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      setDirty(false);
      router.refresh();
      if (dispatchResult) {
        window.dispatchEvent(new CustomEvent(SAVE_GROUPS_RESULT_EVENT, { detail: { experimentId, ok: true } }));
      } else {
        toast.success("Test groups saved.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save groups. Please try again.";
      if (dispatchResult) {
        window.dispatchEvent(new CustomEvent(SAVE_GROUPS_RESULT_EVENT, { detail: { experimentId, ok: false, error: msg } }));
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [experimentId, groups, toast, router]);

  // Listen for the header Save button dispatching the save event
  useEffect(() => {
    function onSaveEvent(e: Event) {
      const detail = (e as CustomEvent<{ experimentId: string }>).detail;
      if (detail?.experimentId === experimentId) {
        saveGroups(true);
      }
    }
    window.addEventListener(SAVE_GROUPS_EVENT, onSaveEvent);
    return () => window.removeEventListener(SAVE_GROUPS_EVENT, onSaveEvent);
  }, [experimentId, saveGroups]);

  const startEdit = (g: Group) => {
    setEditingId(g.id);
    setEditName(g.name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      setGroupsAndDirty((gs) =>
        gs.map((g) => (g.id === editingId ? { ...g, name: editName.trim() } : g))
      );
    }
    setEditingId(null);
  };

  const addGroup = () => {
    if (groups.length >= 5) return;
    const newId = `new-${Date.now()}`;
    const evenShare = Math.floor(100 / (groups.length + 1));
    const remainder = 100 - evenShare * (groups.length + 1);
    setGroupsAndDirty((gs) => [
      ...gs.map((g, i): Group => ({
        id: g.id,
        name: g.name,
        isControl: g.isControl,
        percent: evenShare + (i === 0 ? remainder : 0),
      })),
      {
        id: newId,
        name: `New Group ${groups.length}`,
        percent: evenShare,
        isControl: false,
      },
    ]);
  };

  const removeGroup = (id: string) => {
    if (groups.length <= 2) return;
    const removed = groups.find((g) => g.id === id)!;
    const remaining = groups.filter((g) => g.id !== id);
    const share = Math.floor(removed.percent / remaining.length);
    const remainder = removed.percent - share * remaining.length;
    setGroupsAndDirty(() =>
      remaining.map((g, i) => ({
        ...g,
        percent: g.percent + share + (i === 0 ? remainder : 0),
      }))
    );
  };

  // Two-group slider handler
  const handleSlider = (value: number) => {
    if (groups.length !== 2) return;
    const g0 = groups[0];
    const g1 = groups[1];
    if (!g0 || !g1) return;
    const pct = Math.min(Math.max(value, 5), 95);
    setGroups([
      { ...g0, percent: pct },
      { ...g1, percent: 100 - pct },
    ]);
    setDirty(true);
  };

  const setGroupsAndDirty = (fn: (gs: Group[]) => Group[]) => {
    setGroups(fn);
    setDirty(true);
  };

  return (
    <div>
      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Test Groups</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Add up to 5 test groups,{" "}
            <span className="text-brand-600 cursor-pointer hover:underline">naming each one</span>
            , and allocate a percent of site traffic to each.
          </p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 transition-colors">
          Next step <span className="text-neutral-400">→</span>
        </button>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl overflow-hidden border border-neutral-100">
        <div className="px-8 py-10">
          {/* Circles row */}
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {groups.map((group, i) => {
              const color = GROUP_COLORS[i % GROUP_COLORS.length]!;
              const isEditing = editingId === group.id;
              return (
                <div key={group.id} className="relative flex flex-col items-center">
                  {/* Remove button (not on control) */}
                  {!group.isControl && (
                    <button
                      onClick={() => removeGroup(group.id)}
                      className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:border-neutral-400 transition-colors shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  {/* Circle */}
                  <div
                    className="w-36 h-36 rounded-full flex flex-col items-center justify-center relative"
                    style={{
                      border: `3px solid ${color.border}`,
                    }}
                  >
                    {/* Percentage */}
                    <span
                      className="text-4xl font-bold leading-none"
                      style={{ color: color.text }}
                    >
                      {group.percent}%
                    </span>

                    {/* Name + edit */}
                    <div className="flex items-center gap-1 mt-2">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                          className="text-xs text-center border-b outline-none w-24 bg-transparent"
                          style={{ color: color.text, borderColor: color.border }}
                        />
                      ) : (
                        <>
                          <span
                            className="text-xs font-medium text-center"
                            style={{ color: color.text }}
                          >
                            {group.name}
                          </span>
                          <button
                            onClick={() => startEdit(group)}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3 h-3" style={{ color: color.text }} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Swap icon for non-control */}
                    {!group.isControl && (
                      <button className="mt-1.5 opacity-40 hover:opacity-80 transition-opacity">
                        <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: color.text }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add group button */}
            {groups.length < 5 && (
              <button
                onClick={addGroup}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md hover:opacity-90 transition-opacity"
                style={{ background: "#6366f1" }}
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Two-group slider */}
          {groups.length === 2 && (() => {
            const g0 = groups[0]!;
            const g1 = groups[1]!;
            const c0 = GROUP_COLORS[0]!;
            const c1 = GROUP_COLORS[1]!;
            return (
              <div className="mt-8">
                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                  <div
                    className="absolute left-0 top-0 h-full rounded-l-full transition-all"
                    style={{ width: `${g0.percent}%`, background: c0.track }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full rounded-r-full transition-all"
                    style={{ width: `${g1.percent}%`, background: c1.track }}
                  />
                </div>
                <div className="relative -mt-3">
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={g0.percent}
                    onChange={(e) => handleSlider(Number(e.target.value))}
                    className="w-full appearance-none bg-transparent cursor-pointer"
                    style={{ height: "24px" }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs font-medium" style={{ color: c0.text }}>{g0.name}</span>
                  <span className="text-xs font-medium" style={{ color: c1.text }}>{g1.name}</span>
                </div>
              </div>
            );
          })()}

          {/* Multi-group bar (3+) */}
          {groups.length > 2 && (
            <div className="mt-8">
              <div className="flex rounded-full overflow-hidden h-2 gap-px">
                {groups.map((g, i) => (
                  <div
                    key={g.id}
                    className="transition-all"
                    style={{
                      width: `${g.percent}%`,
                      background: (GROUP_COLORS[i % GROUP_COLORS.length] ?? GROUP_COLORS[0]!).track,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {groups.map((g, i) => (
                  <span key={g.id} className="text-xs font-medium" style={{ color: (GROUP_COLORS[i % GROUP_COLORS.length] ?? GROUP_COLORS[0]!).text }}>
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save footer — only shown when there are unsaved changes */}
      {dirty && experimentId && (
        <div className="mt-4 flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-xs text-amber-700 font-medium">You have unsaved changes to the group allocation.</span>
          <button
            onClick={() => saveGroups(false)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save groups"}
          </button>
        </div>
      )}

      {/* Slider thumb style */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
      `}</style>
    </div>
  );
}
