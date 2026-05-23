import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div className={cn("skeleton", className)} style={style} />
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-6 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="p-4 border-b border-neutral-100">
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="divide-y divide-neutral-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-1/5 ml-auto" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart({ bars = 4, height = 120 }: { bars?: number; height?: number }) {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${40 + (i % 3) * 20}%` }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-2" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonLineChart({ height = 120 }: { height?: number }) {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <div className="relative w-full overflow-hidden rounded" style={{ height }}>
        <Skeleton className="absolute inset-0" />
        <div className="absolute inset-0 flex items-end px-2 pb-2 gap-px">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-white/30 rounded-sm"
              style={{ height: `${30 + Math.abs(Math.sin(i * 0.8)) * 50}%` }}
            />
          ))}
        </div>
      </div>
      <Skeleton className="h-2 w-2/3" />
    </div>
  );
}

export function SkeletonWizardStep({ fields = 3 }: { fields?: number }) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="card p-5 space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
