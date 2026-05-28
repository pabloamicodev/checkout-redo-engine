"use client";

export const SAVE_GROUPS_EVENT = "marginlab:save-groups";

interface Props {
  experimentId: string;
  currentTab: string;
}

export function ExperimentSaveButton({ experimentId, currentTab }: Props) {
  function handleClick() {
    if (currentTab === "groups") {
      // Dispatch a custom event that TestGroupsEditor listens for
      window.dispatchEvent(
        new CustomEvent(SAVE_GROUPS_EVENT, { detail: { experimentId } })
      );
    }
  }

  return (
    <button
      onClick={handleClick}
      className="px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
      style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
    >
      Save
    </button>
  );
}
