import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

const CELL_WIDTHS = ["w-32", "w-24", "w-16", "w-20", "w-28", "w-14"];

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  const gridCols =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
      ? "grid-cols-2"
      : columns === 3
      ? "grid-cols-3"
      : columns === 4
      ? "grid-cols-4"
      : columns === 5
      ? "grid-cols-5"
      : columns === 6
      ? "grid-cols-6"
      : "grid-cols-4";

  return (
    <div
      className={cn(
        "divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden",
        className
      )}
    >
      {showHeader && (
        <div className={cn("bg-neutral-50 px-4 py-2.5 grid gap-4", gridCols)}>
          {Array.from({ length: columns }).map((_, ci) => (
            <Skeleton key={ci} className="h-3 w-24 rounded" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className={cn("bg-white px-4 py-3 grid gap-4", gridCols)}>
          {Array.from({ length: columns }).map((_, ci) => (
            <Skeleton
              key={ci}
              className={cn("h-3 rounded", CELL_WIDTHS[(ri + ci) % CELL_WIDTHS.length])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
