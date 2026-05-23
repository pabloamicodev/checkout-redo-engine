"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Save, Check, Paintbrush, Type, Layout } from "lucide-react";

interface GlobalStyles {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  buttonStyle?: "rounded" | "pill" | "square";
  badgePosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  trustBadgeLayout?: "horizontal" | "vertical" | "grid";
  customCss?: string;
}

function Row({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-neutral-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function GlobalStylesPage() {
  const [styles, setStyles] = useState<GlobalStyles>({
    primaryColor: "#5c3dde",
    secondaryColor: "#f59e0b",
    fontFamily: "inherit",
    borderRadius: "8",
    buttonStyle: "rounded",
    badgePosition: "top-right",
    trustBadgeLayout: "horizontal",
    customCss: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/styles")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GlobalStyles | null) => { if (data) setStyles((s) => ({ ...s, ...data })); })
      .catch(() => null);
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(styles),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  function set<K extends keyof GlobalStyles>(key: K, value: GlobalStyles[K]) {
    setStyles((s) => ({ ...s, [key]: value }));
  }

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Settings</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Default visual settings applied to all checkout blocks and widget extensions</p>
          </div>
          <Button
            size="sm"
            icon={saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            loading={saving}
            onClick={save}
            variant={saved ? "secondary" : "primary"}
          >
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </div>

        {/* Section nav */}
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
          <Link href="/settings" className="px-4 py-1.5 rounded-md text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors">General</Link>
          <span className="px-4 py-1.5 rounded-md text-xs font-medium bg-white text-neutral-900 shadow-sm">Style guide</span>
        </div>

        <div className="space-y-6">
        {/* Colors */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-neutral-400" />
              <CardTitle>Colors</CardTitle>
            </div>
          </CardHeader>

          <Row label="Primary Color" description="Used for buttons, badges, and accent elements">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-8 rounded cursor-pointer border border-neutral-200"
                value={styles.primaryColor ?? "#5c3dde"}
                onChange={(e) => set("primaryColor", e.target.value)}
              />
              <input
                type="text"
                className="w-28 text-sm font-mono border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={styles.primaryColor ?? ""}
                onChange={(e) => set("primaryColor", e.target.value)}
                placeholder="#5c3dde"
              />
            </div>
          </Row>

          <Row label="Secondary Color" description="Used for highlights and complementary accents">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-8 rounded cursor-pointer border border-neutral-200"
                value={styles.secondaryColor ?? "#f59e0b"}
                onChange={(e) => set("secondaryColor", e.target.value)}
              />
              <input
                type="text"
                className="w-28 text-sm font-mono border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={styles.secondaryColor ?? ""}
                onChange={(e) => set("secondaryColor", e.target.value)}
                placeholder="#f59e0b"
              />
            </div>
          </Row>
        </Card>

        {/* Typography & Shape */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-neutral-400" />
              <CardTitle>Typography & Shape</CardTitle>
            </div>
          </CardHeader>

          <Row label="Font Family" description="Override the store font for MarginLab widgets">
            <select
              className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={styles.fontFamily ?? "inherit"}
              onChange={(e) => set("fontFamily", e.target.value)}
            >
              <option value="inherit">Inherit from theme</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="'Helvetica Neue', sans-serif">Helvetica Neue</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Courier New', monospace">Courier New</option>
            </select>
          </Row>

          <Row label="Border Radius" description="Corner radius applied to buttons and cards (px)">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                className="w-24"
                value={parseInt(styles.borderRadius ?? "8") || 0}
                onChange={(e) => set("borderRadius", e.target.value)}
              />
              <span className="text-sm text-neutral-600 w-8">{styles.borderRadius ?? "8"}px</span>
            </div>
          </Row>

          <Row label="Button Style" description="Default button shape for widget CTAs">
            <div className="flex gap-1">
              {(["rounded", "pill", "square"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => set("buttonStyle", style)}
                  className={`px-3 py-1.5 text-xs font-medium border transition-colors capitalize ${
                    styles.buttonStyle === style
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                  }`}
                  style={{
                    borderRadius: style === "rounded" ? "6px" : style === "pill" ? "999px" : "2px",
                  }}
                >
                  {style}
                </button>
              ))}
            </div>
          </Row>
        </Card>

        {/* Layout */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4 text-neutral-400" />
              <CardTitle>Widget Layout</CardTitle>
            </div>
          </CardHeader>

          <Row label="Badge Position" description="Default position for product badges and labels">
            <select
              className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={styles.badgePosition ?? "top-right"}
              onChange={(e) => set("badgePosition", e.target.value as GlobalStyles["badgePosition"])}
            >
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </select>
          </Row>

          <Row label="Trust Badge Layout" description="How trust badge icons are arranged in checkout blocks">
            <div className="flex gap-1">
              {(["horizontal", "vertical", "grid"] as const).map((layout) => (
                <button
                  key={layout}
                  onClick={() => set("trustBadgeLayout", layout)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors capitalize ${
                    styles.trustBadgeLayout === layout
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  {layout}
                </button>
              ))}
            </div>
          </Row>
        </Card>

        {/* Custom CSS */}
        <Card>
          <CardHeader><CardTitle>Custom CSS</CardTitle></CardHeader>
          <div className="pt-1 pb-4">
            <p className="text-xs text-neutral-500 mb-3">
              Advanced: inject custom CSS into all MarginLab widget extensions. Applies after default styles.
            </p>
            <textarea
              rows={8}
              className="w-full text-sm font-mono border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
              placeholder="/* e.g. .marginlab-badge { font-size: 11px; } */"
              value={styles.customCss ?? ""}
              onChange={(e) => set("customCss", e.target.value)}
            />
          </div>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <div className="py-4 flex items-center gap-4 flex-wrap">
            <button
              className="px-4 py-2 text-sm font-medium text-white"
              style={{
                background: styles.primaryColor ?? "#5c3dde",
                borderRadius: `${parseInt(styles.borderRadius ?? "8") || 0}px`,
                fontFamily: styles.fontFamily === "inherit" ? undefined : styles.fontFamily,
              }}
            >
              Primary Button
            </button>
            <button
              className="px-4 py-2 text-sm font-medium border"
              style={{
                color: styles.primaryColor ?? "#5c3dde",
                borderColor: styles.primaryColor ?? "#5c3dde",
                borderRadius: `${parseInt(styles.borderRadius ?? "8") || 0}px`,
                fontFamily: styles.fontFamily === "inherit" ? undefined : styles.fontFamily,
              }}
            >
              Outline Button
            </button>
            <span
              className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{
                background: styles.secondaryColor ?? "#f59e0b",
                borderRadius: `${Math.min(parseInt(styles.borderRadius ?? "8") || 0, 12)}px`,
              }}
            >
              Badge
            </span>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}
