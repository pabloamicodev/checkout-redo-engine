"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Save, AlertTriangle, Check } from "lucide-react";

interface ShopSettings {
  defaultCurrency?: string;
  defaultTimezone?: string;
  estimatedShippingCost?: number;
  transactionFeePercent?: number;
  privacyConsentRequired?: boolean;
  debugModeEnabled?: boolean;
  antiFlickerEnabled?: boolean;
  antiFlickerTimeout?: number;
  notifyOnWinner?: boolean;
  notifyEmail?: string;
  assignmentStrategy?: string;
  defaultTrafficAllocation?: number;
}

interface ShopInfo {
  shopDomain: string;
  currencyCode: string;
  timezone: string;
  settings: ShopSettings;
}

function SettingRow({ label, description, children }: {
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

export default function SettingsPage() {
  const [info, setInfo] = useState<ShopInfo | null>(null);
  const [settings, setSettings] = useState<ShopSettings>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "experiments" | "privacy" | "danger">("general");

  useEffect(() => {
    fetch("/api/settings/general")
      .then((r) => r.json())
      .then((data: ShopInfo) => {
        setInfo(data);
        setSettings(data.settings ?? {});
      })
      .catch(console.error);
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const tabs = [
    { key: "general", label: "General" },
    { key: "experiments", label: "Experiments" },
    { key: "privacy", label: "Privacy & Compliance" },
    { key: "danger", label: "Danger Zone" },
  ] as const;

  function toggle(key: keyof ShopSettings) {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  function num(key: keyof ShopSettings, value: string) {
    setSettings((s) => ({ ...s, [key]: parseFloat(value) || 0 }));
  }

  function str(key: keyof ShopSettings, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Settings</h1>
            {info?.shopDomain && <p className="text-sm text-neutral-400 mt-0.5">{info.shopDomain}</p>}
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
          <span className="px-4 py-1.5 rounded-md text-xs font-medium bg-white text-neutral-900 shadow-sm">General</span>
          <Link href="/settings/styles" className="px-4 py-1.5 rounded-md text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors">Style guide</Link>
        </div>

        <div className="space-y-6">
        {/* Tab nav */}
        <div className="flex gap-1 border-b border-neutral-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* General */}
        {activeTab === "general" && (
          <Card>
            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>

            <SettingRow label="Currency" description="Default display currency for analytics">
              <select
                className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={settings.defaultCurrency ?? info?.currencyCode ?? "USD"}
                onChange={(e) => str("defaultCurrency", e.target.value)}
              >
                {["USD", "EUR", "GBP", "CAD", "AUD", "BRL", "MXN"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Timezone" description="Used for daily metric aggregation cutoff">
              <select
                className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={settings.defaultTimezone ?? info?.timezone ?? "UTC"}
                onChange={(e) => str("defaultTimezone", e.target.value)}
              >
                {[
                  "UTC", "America/New_York", "America/Chicago", "America/Denver",
                  "America/Los_Angeles", "America/Sao_Paulo", "Europe/London",
                  "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney",
                ].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              label="Estimated Shipping Cost"
              description="Used to calculate gross profit when no COGS shipping data available"
            >
              <div className="flex items-center gap-1">
                <span className="text-sm text-neutral-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-24 text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={settings.estimatedShippingCost ?? ""}
                  onChange={(e) => num("estimatedShippingCost", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </SettingRow>

            <SettingRow
              label="Transaction Fee %"
              description="Payment processor fee deducted from revenue in profit calculations"
            >
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  className="w-20 text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={settings.transactionFeePercent ?? ""}
                  onChange={(e) => num("transactionFeePercent", e.target.value)}
                  placeholder="2.9"
                />
                <span className="text-sm text-neutral-500">%</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Notify on winner"
              description="Email alert when a statistical winner is detected"
            >
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnWinner ?? false}
                    onChange={() => toggle("notifyOnWinner")}
                    className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-neutral-700">Enable</span>
                </label>
                {settings.notifyOnWinner && (
                  <input
                    type="email"
                    className="w-48 text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="you@example.com"
                    value={settings.notifyEmail ?? ""}
                    onChange={(e) => str("notifyEmail", e.target.value)}
                  />
                )}
              </div>
            </SettingRow>
          </Card>
        )}

        {/* Experiments */}
        {activeTab === "experiments" && (
          <Card>
            <CardHeader><CardTitle>Experiment Defaults</CardTitle></CardHeader>

            <SettingRow
              label="Default Assignment Strategy"
              description="How visitors are consistently assigned to variants"
            >
              <select
                className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={settings.assignmentStrategy ?? "visitor"}
                onChange={(e) => str("assignmentStrategy", e.target.value)}
              >
                <option value="visitor">Visitor (cookie-based)</option>
                <option value="session">Session</option>
                <option value="customer">Customer (requires login)</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Default Traffic Allocation"
              description="Percentage of total traffic included in experiments by default"
            >
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  className="w-20 text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={settings.defaultTrafficAllocation ?? 100}
                  onChange={(e) => num("defaultTrafficAllocation", e.target.value)}
                />
                <span className="text-sm text-neutral-500">%</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Anti-Flicker"
              description="Hide page content until variant is assigned to prevent visual flicker"
            >
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.antiFlickerEnabled ?? false}
                    onChange={() => toggle("antiFlickerEnabled")}
                    className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-neutral-700">Enable</span>
                </label>
                {settings.antiFlickerEnabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="100"
                      max="5000"
                      step="100"
                      className="w-24 text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={settings.antiFlickerTimeout ?? 1000}
                      onChange={(e) => num("antiFlickerTimeout", e.target.value)}
                    />
                    <span className="text-xs text-neutral-500">ms timeout</span>
                  </div>
                )}
              </div>
            </SettingRow>

            <SettingRow
              label="Debug Mode"
              description="Logs assignment decisions to browser console for QA"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.debugModeEnabled ?? false}
                  onChange={() => toggle("debugModeEnabled")}
                  className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-neutral-700">Enable</span>
              </label>
            </SettingRow>
          </Card>
        )}

        {/* Privacy */}
        {activeTab === "privacy" && (
          <Card>
            <CardHeader><CardTitle>Privacy & Compliance</CardTitle></CardHeader>

            <SettingRow
              label="Privacy Consent Required"
              description="Only track visitors who have given consent via Shopify's consent API"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.privacyConsentRequired ?? false}
                  onChange={() => toggle("privacyConsentRequired")}
                  className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-neutral-700">Require consent</span>
              </label>
            </SettingRow>

            <div className="pt-4 text-xs text-neutral-500 space-y-1">
              <p>MarginLab is GDPR compliant and responds to all Shopify data request webhooks.</p>
              <p>Visitor IDs are anonymous (no PII stored by default). Customer IDs are only linked when the customer is logged in.</p>
            </div>
          </Card>
        )}

        {/* Danger Zone */}
        {activeTab === "danger" && (
          <Card className="border-danger-200">
            <CardHeader>
              <div className="flex items-center gap-2 text-danger-700">
                <AlertTriangle className="w-4 h-4" />
                <CardTitle>Danger Zone</CardTitle>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 p-4 border border-danger-100 rounded-lg bg-danger-50">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Reset All Analytics</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Delete all events, assignments, and daily metrics. This cannot be undone.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm("Delete ALL analytics data? This cannot be undone.")) {
                      fetch("/api/settings/reset-analytics", { method: "POST" })
                        .then(() => alert("Analytics data deleted."))
                        .catch(console.error);
                    }
                  }}
                >
                  Reset
                </Button>
              </div>

              <div className="flex items-start justify-between gap-4 p-4 border border-danger-100 rounded-lg bg-danger-50">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Pause All Running Experiments</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Immediately pause all running experiments. They can be re-launched individually.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm("Pause all running experiments?")) {
                      fetch("/api/settings/pause-all-experiments", { method: "POST" })
                        .then(() => alert("All experiments paused."))
                        .catch(console.error);
                    }
                  }}
                >
                  Pause All
                </Button>
              </div>
            </div>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
