import { MetricCard } from "./MetricCard";
import { cn } from "@/lib/utils";
import React from "react";

type MetricCardProps = React.ComponentProps<typeof MetricCard>;

interface MetricGridProps {
  metrics: MetricCardProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnsClass: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2 md:grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

export function MetricGrid({ metrics, columns = 4, className }: MetricGridProps) {
  return (
    <div className={cn("grid gap-4", columnsClass[columns] ?? "grid-cols-2 md:grid-cols-4", className)}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}
