"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";

interface NavLink {
  label: string;
  sublabel: string;
  href: string;
  icon: string;
}

const NAV_LINKS: NavLink[] = [
  { label: "Dashboard",            sublabel: "Overview & metrics",              href: "/",                          icon: "🏠" },
  { label: "Analytics",            sublabel: "Revenue, CVR, RPV by test",       href: "/analytics",                 icon: "📊" },
  { label: "Content Tests",        sublabel: "A/B test copy & images",          href: "/content-tests",             icon: "✦" },
  { label: "Split URL Tests",      sublabel: "Redirect visitors between pages", href: "/split-url-tests",           icon: "⇄" },
  { label: "Offer Tests",          sublabel: "Cart offers & incentives",         href: "/offer-tests",               icon: "◈" },
  { label: "Checkout Tests",       sublabel: "Checkout blocks & trust badges",  href: "/checkout-tests",            icon: "▣" },
  { label: "Price Tests",          sublabel: "A/B test product pricing",        href: "/price-tests",               icon: "◎" },
  { label: "Discount Tests",       sublabel: "A/B test discount mechanics",     href: "/discount-tests",            icon: "⊖" },
  { label: "Shipping Tests",       sublabel: "Free shipping thresholds",        href: "/shipping-tests",            icon: "◷" },
  { label: "Personalizations",     sublabel: "Targeted visitor experiences",    href: "/personalizations",          icon: "◉" },
  { label: "Abandoned Cart",       sublabel: "Re-engage cart abandoners",       href: "/personalizations/abandoned-cart", icon: "🛒" },
  { label: "Post-Purchase",        sublabel: "Post-purchase offers",            href: "/personalizations/post-purchase",  icon: "🎁" },
  { label: "Offers Library",       sublabel: "Browse & manage offers",          href: "/offers-library",            icon: "💎" },
  { label: "Checkout Blocks",      sublabel: "Manage checkout UI blocks",       href: "/checkout-blocks",           icon: "🧩" },
  { label: "Install Health",       sublabel: "Check extension status",          href: "/install-health",            icon: "🔧" },
  { label: "Get Inspired",         sublabel: "Templates & best practices",      href: "/get-inspired",              icon: "💡" },
  { label: "COGS",                 sublabel: "Cost of goods settings",          href: "/cogs",                      icon: "💰" },
  { label: "Settings",             sublabel: "App configuration",               href: "/settings",                  icon: "⚙️" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const filtered = query.trim()
    ? NAV_LINKS.filter(
        (l) =>
          l.label.toLowerCase().includes(query.toLowerCase()) ||
          l.sublabel.toLowerCase().includes(query.toLowerCase())
      )
    : NAV_LINKS;

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
      if (e.key === "Enter" && filtered[highlighted]) navigate(filtered[highlighted].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, highlighted, navigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, tests, analytics…"
            className="flex-1 text-sm text-neutral-900 placeholder-neutral-400 outline-none bg-transparent"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-400 border border-neutral-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">No results for "{query}"</p>
          ) : (
            filtered.map((link, i) => (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                onMouseEnter={() => setHighlighted(i)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ background: i === highlighted ? "rgb(249 250 251)" : undefined }}
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: i === highlighted ? "#f3f4f6" : "#f9fafb" }}>
                  {link.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{link.label}</p>
                  <p className="text-xs text-neutral-400 truncate">{link.sublabel}</p>
                </div>
                {i === highlighted && <ArrowRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-neutral-100 flex items-center gap-3 text-[10px] text-neutral-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
