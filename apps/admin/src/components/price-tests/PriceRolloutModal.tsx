"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Variant {
  id: string;
  key: string;
  name: string;
  isControl: boolean;
}

interface Props {
  experimentId: string;
  experimentName: string;
  variants: Variant[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PriceRolloutModal({ experimentId, experimentName, variants, onClose, onSuccess }: Props) {
  const toast = useToast();
  const [winnerVariantId, setWinnerVariantId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nonControl = variants.filter((v) => !v.isControl);
  const isConfirmed = confirmText.trim().toLowerCase() === "rollout";

  async function handleRollout() {
    if (!winnerVariantId || !isConfirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/price-tests/${experimentId}/rollout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerVariantId, confirmationToken: experimentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rollout failed");
      toast.success(`"${experimentName}" winner rolled out — Shopify prices have been updated.`);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rollout failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Roll Out Winner</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">This will permanently update Shopify product prices.</p>
              <p className="mt-1 text-amber-700">Prices for the winning variant will be applied to all products in this test. Rollback is available for 30 days.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">Select winning variant</label>
            <div className="space-y-2">
              {nonControl.map((v) => (
                <label key={v.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input
                    type="radio"
                    name="winner"
                    value={v.id}
                    checked={winnerVariantId === v.id}
                    onChange={() => setWinnerVariantId(v.id)}
                    className="text-brand-600"
                  />
                  <span className="text-sm font-medium text-neutral-800">{v.name}</span>
                  <span className="text-xs text-neutral-400 ml-auto">key: {v.key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              Type <span className="font-mono text-brand-600">rollout</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="rollout"
              className="input-base"
            />
          </div>

          <p className="text-xs text-neutral-500">
            Experiment: <span className="font-medium">{experimentName}</span>
          </p>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-neutral-100">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleRollout}
            disabled={!winnerVariantId || !isConfirmed || loading}
            className="ml-auto bg-amber-600 hover:bg-amber-700"
          >
            {loading ? "Rolling out…" : "Roll Out Winner"}
          </Button>
        </div>
      </div>
    </div>
  );
}
