import { cn } from "@/lib/utils";

interface SampleSize {
  control: number;
  variant: number;
}

interface ConfidencePanelProps {
  pValue?: number;
  zScore?: number;
  bayesianProbability?: number;
  sampleSize?: SampleSize;
  minimumSampleSize?: number;
  className?: string;
}

function SignificanceIndicator({ pValue }: { pValue: number }) {
  if (pValue < 0.05) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="text-sm font-medium text-emerald-600">Significant</span>
      </div>
    );
  }
  if (pValue < 0.1) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-sm font-medium text-amber-600">Trending</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 flex-shrink-0" />
      <span className="text-sm font-medium text-neutral-500">Not yet significant</span>
    </div>
  );
}

function bayesianBarColor(probability: number): string {
  if (probability >= 0.8) return "bg-emerald-500";
  if (probability >= 0.5) return "bg-amber-400";
  return "bg-neutral-300";
}

export function ConfidencePanel({
  pValue,
  zScore,
  bayesianProbability,
  sampleSize,
  minimumSampleSize,
  className,
}: ConfidencePanelProps) {
  return (
    <div
      className={cn(
        "p-4 bg-white border border-neutral-200 rounded-xl space-y-4",
        className
      )}
    >
      <p className="text-sm font-medium text-neutral-700">Statistical Confidence</p>

      {/* Significance */}
      {pValue !== undefined && (
        <div className="space-y-1.5">
          <SignificanceIndicator pValue={pValue} />
          <p className="text-xs text-neutral-500">p = {pValue.toFixed(3)}</p>
          {zScore !== undefined && (
            <p className="text-xs text-neutral-500">z = {zScore.toFixed(3)}</p>
          )}
        </div>
      )}

      {/* Bayesian */}
      {bayesianProbability !== undefined && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500">
            P(Variant beats Control)
          </p>
          <p className="text-lg font-semibold text-neutral-900">
            {(bayesianProbability * 100).toFixed(1)}%
          </p>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                bayesianBarColor(bayesianProbability)
              )}
              style={{ width: `${Math.min(bayesianProbability * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Sample size */}
      {sampleSize && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500">Sample Sizes</p>
          <div className="flex gap-4 text-sm text-neutral-700">
            <span>
              Control:{" "}
              <span className="font-medium">{sampleSize.control.toLocaleString()}</span>
            </span>
            <span>
              Variant:{" "}
              <span className="font-medium">{sampleSize.variant.toLocaleString()}</span>
            </span>
          </div>
          {minimumSampleSize && (
            <div className="space-y-1">
              <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      ((sampleSize.control + sampleSize.variant) /
                        (minimumSampleSize * 2)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
              {sampleSize.control + sampleSize.variant <
                minimumSampleSize * 2 && (
                <p className="text-xs text-neutral-400">
                  {(
                    minimumSampleSize * 2 -
                    sampleSize.control -
                    sampleSize.variant
                  ).toLocaleString()}{" "}
                  more visitors needed
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
