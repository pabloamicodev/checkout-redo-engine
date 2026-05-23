import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface DetailTab {
  key: string;
  label: string;
}

interface DetailLayoutProps {
  breadcrumb: { href: string; label: string };
  /** Rendered inside the gradient header section (PageHeader, status pills, etc.) */
  header: ReactNode;
  tabs?: DetailTab[];
  activeTab?: string;
  /** Converts a tab key to its URL. If omitted, tabs are decorative only. */
  tabHref?: (key: string) => string;
  accentHex?: string;
  /** Background gradient from accentHex — set false to disable */
  gradientHeader?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Generic detail-page layout: breadcrumb → gradient header → tab bar → content.
 * Matches the visual language of ExperimentDetailShell but is type-agnostic.
 */
export function DetailLayout({
  breadcrumb,
  header,
  tabs,
  activeTab,
  tabHref,
  accentHex = "#6366f1",
  gradientHeader = true,
  children,
  className,
  contentClassName,
}: DetailLayoutProps) {
  return (
    <div className={cn("flex-1 overflow-auto bg-neutral-50", className)}>
      {/* Header */}
      <div
        className="px-6 pt-5 pb-0 border-b border-neutral-100"
        style={
          gradientHeader
            ? { background: `linear-gradient(160deg, ${accentHex}0d 0%, ${accentHex}05 60%, #fff 100%)` }
            : { background: "#fff" }
        }
      >
        {/* Breadcrumb */}
        <Link
          href={breadcrumb.href}
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-3 h-3" />
          {breadcrumb.label}
        </Link>

        {/* Caller-supplied header content */}
        {header}

        {/* Tab bar */}
        {tabs && tabs.length > 0 && (
          <nav className="flex gap-0 mt-5 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;
              const href = tabHref ? tabHref(tab.key) : undefined;
              const sharedCn = cn(
                "shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-current"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              );
              const sharedStyle = isActive
                ? { color: accentHex, borderColor: accentHex }
                : undefined;

              if (href) {
                return (
                  <Link key={tab.key} href={href} className={sharedCn} style={sharedStyle}>
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={sharedCn}
                  style={sharedStyle}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Tab content */}
      <div className={cn("p-6", contentClassName)}>{children}</div>
    </div>
  );
}
