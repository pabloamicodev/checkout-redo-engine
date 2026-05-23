import { cn } from "@/lib/utils";

interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  label?: string;
}

export function Separator({ orientation = "horizontal", className, label }: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <div
        className={cn("w-px bg-neutral-200 self-stretch shrink-0", className)}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (label) {
    return (
      <div className={cn("flex items-center gap-3 my-2", className)} role="separator">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 select-none">
          {label}
        </span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>
    );
  }

  return (
    <div
      className={cn("h-px w-full bg-neutral-200 my-2", className)}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}
