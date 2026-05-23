"use client";

import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Zap, ArrowRight, Lock } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Human-readable description of what was blocked, e.g. "running experiments" */
  limitType?: string;
}

const UPGRADE_PERKS = [
  "Unlimited A/B price tests",
  "Unlimited shipping experiments",
  "Unlimited discount campaigns",
  "Unlimited personalization rules",
  "Priority support",
  "Advanced analytics & reporting",
];

export function UpgradePlanModal({ open, onClose, limitType = "items on your current plan" }: Props) {
  const router = useRouter();

  function handleUpgrade() {
    onClose();
    router.push("/billing");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title=""
    >
      {/* Hero */}
      <div className="flex flex-col items-center text-center px-2 pt-2 pb-4">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 flex items-center justify-center mb-3 shadow-sm">
          <Lock className="w-5 h-5 text-fuchsia-600" />
        </div>
        <h2 className="text-base font-semibold text-neutral-900 mb-1">Plan limit reached</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">
          You&apos;ve hit the limit for{" "}
          <span className="font-medium text-neutral-700">{limitType}</span>.{" "}
          Upgrade to unlock unlimited usage.
        </p>
      </div>

      {/* Perks */}
      <div className="rounded-xl bg-gradient-to-br from-fuchsia-50 to-purple-50 border border-fuchsia-100 px-4 py-3 mb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Zap className="w-3.5 h-3.5 text-fuchsia-500" />
          <span className="text-[11px] font-semibold text-fuchsia-700 uppercase tracking-wide">Pro plan includes</span>
        </div>
        <ul className="space-y-1.5">
          {UPGRADE_PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-xs text-neutral-700">
              <span className="w-4 h-4 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0">
                <span className="text-fuchsia-600 text-[10px] font-bold">✓</span>
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleUpgrade}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          View upgrade options
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 rounded-lg text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </Modal>
  );
}
