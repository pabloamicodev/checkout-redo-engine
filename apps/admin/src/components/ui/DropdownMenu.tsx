"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute top-full mt-1.5 z-50 min-w-[160px] bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden py-1",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  setOpen(false);
                }
              }}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors",
                item.variant === "danger"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-neutral-700 hover:bg-neutral-50",
                item.disabled && "opacity-40 cursor-not-allowed pointer-events-none",
                item.divider && "mt-1 pt-1 border-t border-neutral-100"
              )}
            >
              {item.icon && (
                <span className="w-4 h-4 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
