import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function Loading() {
  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="px-6 py-6 space-y-4">
        <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse" />
        <TableSkeleton rows={5} columns={5} />
      </div>
    </div>
  );
}
