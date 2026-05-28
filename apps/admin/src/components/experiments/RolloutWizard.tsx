"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, X, Trophy, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Variant {
  id: string;
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  conversionRate?: number;
  relativeLift?: number;
}

interface Props {
  experimentId: string;
  experimentName: string;
  experimentType: string;
  variants: Variant[];
  suggestedWinnerId?: string;
  onClose: () => void;
  onSuccess: (result: { rolledOut: boolean; archived: boolean }) => void;
}

type Step = "select" | "confirm" | "done";

export function RolloutWizard({ experimentId, experimentName, experimentType, variants, suggestedWinnerId, onClose, onSuccess }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("select");
  const [winnerId, setWinnerId] = useState(suggestedWinnerId ?? "");
  const [action, setAction] = useState<"rollout" | "archive">("rollout");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const winner = variants.find((v) => v.id === winnerId);
  const isPriceTest = experimentType === "PRICE_TEST";
  const confirmWord = action === "rollout" ? "rollout" : "archive";
  const isConfirmed = confirmText.trim().toLowerCase() === confirmWord;
  const nonControl = variants.filter((v) => !v.isControl);

  async function handleExecute() {
    if (!isConfirmed) return;
    setLoading(true);
    setError(null);
    try {
      if (action === "rollout" && isPriceTest) {
        const res = await fetch(`/api/price-tests/${experimentId}/rollout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerVariantId: winnerId, confirmationToken: experimentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Rollout failed");
      } else {
        // For non-price tests: complete the experiment
        const res = await fetch(`/api/experiments/${experimentId}/complete`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Complete failed");
        }
      }

      if (action === "archive") {
        await fetch(`/api/experiments/${experimentId}/archive`, { method: "POST" });
      }

      const msg = action === "rollout"
        ? `"${experimentName}" winner rolled out — changes are now live.`
        : `"${experimentName}" archived with no changes applied.`;
      toast.success(msg);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
      toast.error(err instanceof Error ? err.message : "Operation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">
            {step === "done" ? "All done!" : "Wrap up experiment"}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: Select */}
        {step === "select" && (
          <div className="px-6 py-5 space-y-5">
            <p className="text-sm text-neutral-600">
              You're wrapping up <span className="font-medium">{experimentName}</span>. Choose what to do with the results.
            </p>

            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${action === "rollout" ? "border-brand-500 bg-brand-50" : "border-neutral-200 hover:bg-neutral-50"}`}>
                <input type="radio" name="action" value="rollout" checked={action === "rollout"}
                  onChange={() => setAction("rollout")} className="mt-0.5 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Roll out a winner</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isPriceTest
                      ? "Apply the winning variant's prices permanently to Shopify."
                      : "Complete the experiment and record the winning variant."}
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${action === "archive" ? "border-neutral-500 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"}`}>
                <input type="radio" name="action" value="archive" checked={action === "archive"}
                  onChange={() => setAction("archive")} className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Archive without a winner</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Mark the experiment as archived. No changes are applied to the store.</p>
                </div>
              </label>
            </div>

            {action === "rollout" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">Select winning variant</label>
                <div className="space-y-2">
                  {nonControl.map((v) => (
                    <label key={v.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors ${winnerId === v.id ? "border-brand-500" : "border-neutral-200"}`}>
                      <div className="flex items-center gap-3">
                        <input type="radio" name="winner" value={v.id} checked={winnerId === v.id}
                          onChange={() => setWinnerId(v.id)} className="text-brand-600" />
                        <div>
                          <span className="text-sm font-medium text-neutral-800">{v.name}</span>
                          {suggestedWinnerId === v.id && (
                            <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              Suggested winner
                            </span>
                          )}
                        </div>
                      </div>
                      {v.relativeLift !== undefined && (
                        <span className={`text-xs font-medium ${v.relativeLift >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {v.relativeLift >= 0 ? "+" : ""}{(v.relativeLift * 100).toFixed(1)}%
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setStep("confirm")}
                disabled={action === "rollout" && !winnerId}>
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="px-6 py-5 space-y-5">
            {isPriceTest && action === "rollout" && (
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This will permanently update Shopify product prices to the winning variant. Rollback is available for 30 days.
                </p>
              </div>
            )}

            <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-neutral-500">Action</span><span className="font-medium capitalize">{action === "rollout" ? "Roll out winner" : "Archive"}</span></div>
              {action === "rollout" && winner && (
                <div className="flex justify-between"><span className="text-neutral-500">Winner</span><span className="font-medium">{winner.name}</span></div>
              )}
              <div className="flex justify-between"><span className="text-neutral-500">Experiment</span><span className="font-medium truncate max-w-[60%]">{experimentName}</span></div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-700">
                Type <span className="font-mono text-brand-600">{confirmWord}</span> to confirm
              </label>
              <input type="text" className="input-base" value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)} placeholder={confirmWord} />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("select")} disabled={loading}>Back</Button>
              <Button size="sm" onClick={handleExecute} disabled={!isConfirmed || loading}
                className={action === "archive" ? "" : "bg-amber-600 hover:bg-amber-700 ml-auto"}>
                {loading ? "Processing…" : action === "rollout" ? "Roll Out Winner" : "Archive Experiment"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="px-6 py-8 text-center space-y-4">
            <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                {action === "rollout" ? "Winner rolled out!" : "Experiment archived"}
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                {action === "rollout"
                  ? `${winner?.name ?? "Variant"} has been applied.`
                  : "The experiment has been archived with no changes."}
              </p>
            </div>
            <Button size="sm" onClick={() => onSuccess({ rolledOut: action === "rollout", archived: action === "archive" })}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
