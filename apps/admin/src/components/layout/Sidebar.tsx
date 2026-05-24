"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  BarChart2,
  Lightbulb,
  FlaskConical,
  LayoutGrid,
  Zap,
  Plug,
  ChevronDown,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Settings,
  CreditCard,
  ScrollText,
  Calculator,
  GraduationCap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { CommandPalette } from "@/components/ui/CommandPalette";

function LogoIcon() {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{
        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        boxShadow: "0 0 12px -2px rgb(99 102 241 / 0.5)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 3V21M4 7.5L20 16.5M20 7.5L4 16.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
    </div>
  );
}

// Test type color dots for sidebar sub-items
const TEST_TYPE_DOTS: Record<string, string> = {
  "/content-tests": "#7c3aed",
  "/split-url-tests": "#0284c7",
  "/offer-tests": "#059669",
  "/checkout-tests": "#4f46e5",
  "/price-tests": "#e11d48",
  "/discount-tests": "#d97706",
  "/shipping-tests": "#0891b2",
  "/personalizations": "#c026d3",
};

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [testsOpen, setTestsOpen] = useState(true);
  const [personalizationsOpen, setPersonalizationsOpen] = useState(true);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setCmdPaletteOpen(true), []);
  const closePalette = useCallback(() => setCmdPaletteOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const isTestsActive =
    isActive("/experiments") ||
    isActive("/price-tests") ||
    isActive("/shipping-tests") ||
    isActive("/checkout-tests") ||
    isActive("/offer-tests") ||
    isActive("/content-tests") ||
    isActive("/split-url-tests") ||
    isActive("/discount-tests") ||
    isActive("/personalizations");

  const isPersonalizationsActive =
    isActive("/personalizations") ||
    isActive("/checkout-blocks");

  const sidebarStyle = {
    background: "#0F172A",
    borderRight: "1px solid #1E293B",
  };

  return (
    <>
    <aside
      className={cn(
        "shrink-0 flex flex-col h-dvh sticky top-0 overflow-y-auto overflow-x-hidden transition-all duration-200 scrollbar-thin",
        collapsed ? "w-12" : "w-64"
      )}
      style={sidebarStyle}
    >
      {/* Logo row */}
      <div
        className={cn(
          "flex items-center pt-4 pb-3 px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoIcon />
          {!collapsed && (
            <span
              className="text-sm font-semibold text-slate-100 truncate"
              style={{ letterSpacing: "-0.025em" }}
            >
              MarginLab
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md transition-colors shrink-0"
            style={{ color: "#475569" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-1 mb-2 p-1.5 rounded-md transition-colors"
          style={{ color: "#475569" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-3.5 h-3.5" />
        </button>
      )}

      {!collapsed && (
        <div className="px-3.5 pb-3">
          <p className="text-[10px] font-medium" style={{ color: "#475569" }}>
            Profit optimization platform
          </p>
        </div>
      )}

      {/* Quick find */}
      <div className="px-2.5 pb-2">
        {!collapsed ? (
          <button
            onClick={openPalette}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              background: "#162032",
              border: "1px solid #1E293B",
              color: "#475569",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.color = "#64748b";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1E293B";
              e.currentTarget.style.color = "#475569";
            }}
          >
            <span className="flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              Search tests, analytics…
            </span>
            <kbd className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: "#1E293B", color: "#334155" }}>
              ⌘K
            </kbd>
          </button>
        ) : (
          <button
            onClick={openPalette}
            className="w-7 h-7 mx-auto flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#475569" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Top nav */}
      <nav className="px-2 space-y-0.5">
        <SidebarNavItem href="/" label="Home" icon={Home} active={pathname === "/"} collapsed={collapsed} />
        <SidebarNavItem href="/analytics" label="Analytics" icon={BarChart2} active={isActive("/analytics")} collapsed={collapsed} />
        <SidebarNavItem href="/get-inspired" label="Get inspired" icon={Lightbulb} active={isActive("/get-inspired")} collapsed={collapsed} />
      </nav>

      {/* Divider + section label */}
      <SectionDivider label="Profit growth" collapsed={collapsed} />

      <nav className="px-2 space-y-0.5">
        {/* Tests — collapsible */}
        {collapsed ? (
          <SidebarNavItem
            href="/experiments"
            label="Tests"
            icon={FlaskConical}
            active={isTestsActive}
            collapsed={collapsed}
          />
        ) : (
          <div>
            <button
              onClick={() => setTestsOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-100"
              )}
              style={
                isTestsActive
                  ? { background: "#1E293B", color: "#F8FAFC", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)" }
                  : { color: "#94A3B8" }
              }
              onMouseEnter={(e) => {
                if (!isTestsActive) {
                  e.currentTarget.style.background = "#162032";
                  e.currentTarget.style.color = "#F8FAFC";
                }
              }}
              onMouseLeave={(e) => {
                if (!isTestsActive) {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#94A3B8";
                }
              }}
            >
              <FlaskConical
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: isTestsActive ? "#818cf8" : "#475569" }}
              />
              <span className="flex-1 text-left">Tests</span>
              <ChevronDown
                className={cn("w-3 h-3 transition-transform shrink-0", testsOpen && "rotate-180")}
                style={{ color: "#334155" }}
              />
            </button>

            {testsOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 pl-2.5" style={{ borderLeft: "1px solid #1E293B" }}>
                {[
                  { label: "All Tests", href: "/experiments" },
                  { label: "Content", href: "/content-tests" },
                  { label: "Split URL", href: "/split-url-tests" },
                  { label: "Pricing", href: "/price-tests" },
                  { label: "Shipping", href: "/shipping-tests" },
                  { label: "Checkout", href: "/checkout-tests" },
                  { label: "Offers", href: "/offer-tests" },
                  { label: "Discounts", href: "/discount-tests" },
                  { label: "Personalizations", href: "/personalizations" },
                ].map((item) => {
                  const active = isActive(item.href);
                  const dot = TEST_TYPE_DOTS[item.href];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-100"
                      style={
                        active
                          ? { color: "#F8FAFC", background: "#1E293B" }
                          : { color: "#64748b" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#CBD5E1";
                          e.currentTarget.style.background = "#162032";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#64748b";
                          e.currentTarget.style.background = "";
                        }
                      }}
                    >
                      {dot && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: dot, opacity: active ? 1 : 0.6 }}
                        />
                      )}
                      {item.label}
                    </Link>
                  );
                })}
                {[
                  { label: "Templates", href: "/template-tests", dot: "#64748b" },
                  { label: "Themes", href: "/theme-tests", dot: "#71717a" },
                ].map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-100"
                      style={
                        active
                          ? { color: "#F8FAFC", background: "#1E293B" }
                          : { color: "#64748b" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#CBD5E1";
                          e.currentTarget.style.background = "#162032";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#64748b";
                          e.currentTarget.style.background = "";
                        }
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: item.dot, opacity: active ? 1 : 0.6 }}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Personalizations */}
        {collapsed ? (
          <SidebarNavItem
            href="/personalizations"
            label="Personalizations"
            icon={LayoutGrid}
            active={isPersonalizationsActive}
            collapsed={collapsed}
          />
        ) : (
          <div>
            <button
              onClick={() => setPersonalizationsOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-100"
              style={
                isPersonalizationsActive
                  ? { background: "#1E293B", color: "#F8FAFC", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)" }
                  : { color: "#94A3B8" }
              }
              onMouseEnter={(e) => {
                if (!isPersonalizationsActive) {
                  e.currentTarget.style.background = "#162032";
                  e.currentTarget.style.color = "#F8FAFC";
                }
              }}
              onMouseLeave={(e) => {
                if (!isPersonalizationsActive) {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#94A3B8";
                }
              }}
            >
              <LayoutGrid
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: isPersonalizationsActive ? "#818cf8" : "#475569" }}
              />
              <span className="flex-1 text-left">Personalizations</span>
              <ChevronDown
                className={cn("w-3 h-3 transition-transform shrink-0", personalizationsOpen && "rotate-180")}
                style={{ color: "#334155" }}
              />
            </button>

            {personalizationsOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 pl-2.5" style={{ borderLeft: "1px solid #1E293B" }}>
                {[
                  { label: "Site content", href: "/personalizations" },
                  { label: "Abandoned Cart", href: "/personalizations/abandoned-cart" },
                  { label: "Checkout", href: "/checkout-blocks" },
                ].map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-100"
                      style={
                        active
                          ? { color: "#F8FAFC", background: "#1E293B" }
                          : { color: "#64748b" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#CBD5E1";
                          e.currentTarget.style.background = "#162032";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#64748b";
                          e.currentTarget.style.background = "";
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  href="/personalizations/post-purchase"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-100"
                  style={
                    isActive("/personalizations/post-purchase")
                      ? { color: "#F8FAFC", background: "#1E293B" }
                      : { color: "#64748b" }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive("/personalizations/post-purchase")) {
                      e.currentTarget.style.color = "#CBD5E1";
                      e.currentTarget.style.background = "#162032";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive("/personalizations/post-purchase")) {
                      e.currentTarget.style.color = "#64748b";
                      e.currentTarget.style.background = "";
                    }
                  }}
                >
                  Post-purchase
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Offers library */}
        <SidebarNavItem href="/offers-library" label="Offers library" icon={Zap} active={isActive("/offers-library")} collapsed={collapsed} />
      </nav>

      {/* Divider + section label */}
      <SectionDivider label="Store" collapsed={collapsed} />

      <nav className="px-2 space-y-0.5">
        <SidebarNavItem href="/custom-events" label="Events manager" icon={Sparkles} active={isActive("/custom-events")} collapsed={collapsed} />
        <SidebarNavItem href="/integrations" label="Integrations" icon={Plug} active={isActive("/integrations")} collapsed={collapsed} />
        <SidebarNavItem href="/cogs" label="COGS & Profit" icon={Calculator} active={isActive("/cogs")} collapsed={collapsed} />
        <SidebarNavItem href="/audit-log" label="Audit log" icon={ScrollText} active={isActive("/audit-log")} collapsed={collapsed} />
        <SidebarNavItem href="/billing" label="Billing" icon={CreditCard} active={isActive("/billing")} collapsed={collapsed} />
        <SidebarNavItem href="/settings" label="Settings" icon={Settings} active={isActive("/settings")} collapsed={collapsed} />
      </nav>

      <div className="flex-1" />

      {/* Onboarding guide link at bottom */}
      {!collapsed && (
        <div className="px-3 pb-4 pt-2">
          <a
            href="/onboarding"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-100"
            style={{ color: "#475569" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.background = "#162032";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#475569";
              e.currentTarget.style.background = "";
            }}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: "#334155" }} />
            Getting started guide
          </a>
        </div>
      )}
    </aside>
    <CommandPalette open={cmdPaletteOpen} onClose={closePalette} />
    </>
  );
}

function SectionDivider({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-3 mx-2.5" style={{ borderTop: "1px solid #1E293B" }} />;
  }
  return (
    <div className="px-3.5 pt-4 pb-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "#334155", letterSpacing: "0.1em" }}>
        {label}
      </p>
    </div>
  );
}

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all duration-100",
        collapsed ? "justify-center p-2 w-8 h-8 mx-auto" : "px-2.5 py-1.5"
      )}
      style={
        active
          ? { background: "#1E293B", color: "#F8FAFC", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)" }
          : { color: "#94A3B8" }
      }
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#162032";
          e.currentTarget.style.color = "#F8FAFC";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "";
          e.currentTarget.style.color = "#94A3B8";
        }
      }}
    >
      <Icon
        className={cn("shrink-0", collapsed ? "w-4 h-4" : "w-3.5 h-3.5")}
        style={{ color: active ? "#818cf8" : "#475569" }}
      />
      {!collapsed && label}
    </Link>
  );
}
