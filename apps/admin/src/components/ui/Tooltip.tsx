interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

const positionClasses: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <div className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 bg-neutral-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap ${positionClasses[side]}`}
      >
        {content}
      </span>
    </div>
  );
}
