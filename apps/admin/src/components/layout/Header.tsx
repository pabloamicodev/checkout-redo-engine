"use client";

import { HelpCircle } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  noBorder?: boolean;
}

export function Header({ title, subtitle, actions, noBorder }: HeaderProps) {
  return (
    <header
      className={`bg-neutral-50 px-8 pt-8 pb-5 flex items-start justify-between shrink-0 ${
        !noBorder ? "border-b border-neutral-200" : ""
      }`}
    >
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-neutral-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        {actions}
        <button className="p-1.5 text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
