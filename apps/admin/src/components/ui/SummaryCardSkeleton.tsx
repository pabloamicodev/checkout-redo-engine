import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface SummaryCardSkeletonProps {
  count?: number;
  className?: string;
}

export function SummaryCardSkeleton({ count = 4, className }: SummaryCardSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-neutral-200 rounded-xl p-4 space-y-2"
        >
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-7 w-32 mt-1 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
