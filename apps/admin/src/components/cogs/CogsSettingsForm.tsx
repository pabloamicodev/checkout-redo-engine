"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  initialShippingCost: number;
  initialTransactionFee: number;
}

export function CogsSettingsForm({ initialShippingCost, initialTransactionFee }: Props) {
  const toast = useToast();
  const [shippingCost, setShippingCost] = useState(initialShippingCost);
  const [transactionFee, setTransactionFee] = useState(initialTransactionFee);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedShippingCost: shippingCost,
          transactionFeePercent: transactionFee,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      toast.success("COGS settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">
          Estimated Shipping Cost (per order)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={shippingCost}
            onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">
          Transaction Fee %
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={transactionFee}
            onChange={(e) => setTransactionFee(parseFloat(e.target.value) || 0)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
          />
          <span className="text-neutral-500">%</span>
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between">
        <p className="text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-100">
          <strong className="text-neutral-700">Formula: </strong>
          Net Revenue − COGS − Shipping − Transaction Fee = Gross Profit
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
          ) : (
            "Save settings"
          )}
        </button>
      </div>
    </div>
  );
}
