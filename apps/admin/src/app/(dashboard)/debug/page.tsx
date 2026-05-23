"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export const dynamic = 'force-dynamic';

import {
  Search,
  Terminal,
  RefreshCw,
  Copy,
  ExternalLink,
  Eye,
  ShieldOff,
  ShieldCheck,
  AlertTriangle,
  Activity,
  TrendingUp,
  PackageSearch,
  Download,
  Cpu,
  Zap,
  CircleCheck,
  CircleX,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Kill Switch panel
// ---------------------------------------------------------------------------

interface KillSwitches {
  ks_globalDisabled: boolean;
  ks_contentModificationsDisabled: boolean;
  ks_priceDisplayDisabled: boolean;
  ks_offerWidgetsDisabled: boolean;
  ks_splitUrlRedirectsDisabled: boolean;
  ks_debugOverlayDisabled: boolean;
}

type KsKey = keyof KillSwitches;

const KS_LABELS: Record<KsKey, string> = {
  ks_globalDisabled: "🛑 Global runtime disable",
  ks_contentModificationsDisabled: "Content modifications",
  ks_priceDisplayDisabled: "Price display changes",
  ks_offerWidgetsDisabled: "Offer widgets",
  ks_splitUrlRedirectsDisabled: "Split URL redirects",
  ks_debugOverlayDisabled: "Debug overlay",
};

const KS_DESCRIPTIONS: Record<KsKey, string> = {
  ks_globalDisabled: "Immediately disables ALL MarginLab functionality on the storefront.",
  ks_contentModificationsDisabled: "Stops all DOM content modifications (banners, injections, etc.).",
  ks_priceDisplayDisabled: "Prevents variant prices from being displayed on the storefront.",
  ks_offerWidgetsDisabled: "Hides all offer and upsell widgets.",
  ks_splitUrlRedirectsDisabled: "Disables split URL test redirects.",
  ks_debugOverlayDisabled: "Hides the ?marginlab_debug=true overlay on the storefront.",
};

function KillSwitchPanel() {
  const [switches, setSwitches] = useState<KillSwitches | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<KsKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<KsKey | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/kill-switches");
      const data = await res.json();
      setSwitches(data.killSwitches);
    } catch {
      setError("Failed to load kill switch state");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(key: KsKey) {
    if (!switches) return;
    const newValue = !switches[key];
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/settings/kill-switches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSwitches(data.killSwitches);
      setLastSaved(key);
      setTimeout(() => setLastSaved(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  }

  const anyActive = switches ? Object.values(switches).some(Boolean) : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {anyActive ? (
              <ShieldOff className="w-4 h-4 text-danger-500" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-success-500" />
            )}
            <CardTitle>Kill Switches</CardTitle>
          </div>
          {anyActive && (
            <Badge variant="danger">
              {Object.values(switches ?? {}).filter(Boolean).length} active
            </Badge>
          )}
        </div>
      </CardHeader>

      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {switches && !loading && (
        <div className="space-y-2">
          {switches.ks_globalDisabled && (
            <div className="flex items-center gap-2 text-sm font-medium text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Global runtime is DISABLED — all storefront features are off
            </div>
          )}
          {(Object.keys(switches) as KsKey[]).map((key) => {
            const isOn = switches[key];
            const isSaving = saving === key;
            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg border transition-colors ${
                  isOn
                    ? "border-danger-200 bg-danger-50/50"
                    : "border-neutral-100 bg-white hover:bg-neutral-50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isOn ? "text-danger-800" : "text-neutral-800"}`}>
                    {KS_LABELS[key]}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5 leading-tight">{KS_DESCRIPTIONS[key]}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lastSaved === key && (
                    <span className="text-xs text-success-600 font-medium">Saved</span>
                  )}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => toggle(key)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      isOn ? "bg-danger-500" : "bg-neutral-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                        isOn ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-neutral-400 pt-1">
            Changes take effect on the storefront within ~30 seconds (cache TTL). All changes are logged to Audit Log.
          </p>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Attribution Debug Panel
// ---------------------------------------------------------------------------

interface AttributionTotals {
  total: number;
  attributed: number;
  unattributed: number;
  attributionRate: number;
}

interface MethodBreakdown {
  cartToken: number;
  checkoutToken: number;
  customerId: number;
  visitorIdOnly: number;
}

interface UnattributedOrder {
  shopifyOrderId: string;
  shopifyOrderName: string | null;
  totalPrice: number | null;
  currencyCode: string | null;
  financialStatus: string | null;
  cartToken: string | null;
  checkoutToken: string | null;
  customerId: string | null;
  visitorId: string | null;
  attributedAt: string;
}

interface AttributionDebugData {
  windowDays: number;
  since: string;
  totals: AttributionTotals;
  methodBreakdown: MethodBreakdown;
  recentUnattributed: UnattributedOrder[];
}

function AttributionDebugPanel() {
  const [data, setData] = useState<AttributionDebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function load(d = days) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/attribution-debug?days=${d}`);
      if (!res.ok) throw new Error("Failed to load attribution data");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function exportDebugBundle() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attribution-debug-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rate = data?.totals.attributionRate ?? 0;
  const rateColor = rate >= 80 ? "text-success-600" : rate >= 50 ? "text-amber-500" : "text-danger-500";
  const rateBarColor = rate >= 80 ? "bg-success-500" : rate >= 50 ? "bg-amber-400" : "bg-danger-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-neutral-500" />
            <CardTitle>Attribution Debug</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => { const d = Number(e.target.value); setDays(d); if (data) load(d); }}
              className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white text-neutral-600"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <Button variant="secondary" size="sm" onClick={() => load()} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>
              {data ? "Refresh" : "Load"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!data && !loading && (
        <p className="text-sm text-neutral-400 py-2">Click <strong>Load</strong> to fetch attribution health for the last {days} days.</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading attribution data…
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5 mt-1">
          {/* Rate gauge */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Attribution rate ({data.windowDays}d)</span>
              <span className={`text-lg font-bold ${rateColor}`}>{rate}%</span>
            </div>
            <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${rateBarColor}`} style={{ width: `${rate}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
              <span>{data.totals.attributed} attributed</span>
              <span>{data.totals.unattributed} unattributed</span>
              <span>{data.totals.total} total</span>
            </div>
          </div>

          {/* Method breakdown */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Method breakdown
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Cart token", value: data.methodBreakdown.cartToken, best: true },
                { label: "Checkout token", value: data.methodBreakdown.checkoutToken, best: false },
                { label: "Customer ID", value: data.methodBreakdown.customerId, best: false },
                { label: "Visitor ID only", value: data.methodBreakdown.visitorIdOnly, best: false },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-neutral-100">
                  <span className="text-xs text-neutral-600">{m.label}</span>
                  <span className={`text-sm font-semibold ${m.best ? "text-success-600" : "text-neutral-700"}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unattributed orders */}
          {data.recentUnattributed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <PackageSearch className="w-3.5 h-3.5" /> Recent unattributed orders
              </p>
              <div className="border border-neutral-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-500">Order</th>
                      <th className="text-right px-3 py-2 font-semibold text-neutral-500">Amount</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-500">Missing</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentUnattributed.map((o) => {
                      const missing: string[] = [];
                      if (!o.cartToken) missing.push("cart");
                      if (!o.checkoutToken) missing.push("checkout");
                      if (!o.customerId) missing.push("customer");
                      if (!o.visitorId) missing.push("visitor");
                      return (
                        <tr key={o.shopifyOrderId} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2 font-mono text-neutral-700">{o.shopifyOrderName ?? o.shopifyOrderId.slice(-8)}</td>
                          <td className="px-3 py-2 text-right text-neutral-600">{o.totalPrice ? `${o.currencyCode} ${Number(o.totalPrice).toFixed(2)}` : "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {missing.map((m) => (
                                <span key={m} className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-medium">no {m}</span>
                              ))}
                              {missing.length === 0 && <span className="text-neutral-400">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-neutral-400">{new Date(o.attributedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.recentUnattributed.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-success-600 bg-success-50 border border-success-100 rounded-lg px-3 py-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              All recent orders are attributed. 
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-neutral-50">
            <Button variant="secondary" size="sm" onClick={exportDebugBundle} icon={<Download className="w-3.5 h-3.5" />}>
              Export debug bundle
            </Button>
            <p className="text-[11px] text-neutral-400 ml-1">
              Downloads a JSON snapshot of this attribution data for support tickets.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Checkout & Function Health Panel
// ---------------------------------------------------------------------------

interface CheckoutHealth {
  checkoutExtensionActive: boolean;
  checkoutBlockCount: number;
  discountEngineActive: boolean;
  discountFunctionExperimentCount: number;
  cogsConfigured: boolean;
  cogsVariantCount: number;
  eventsFlowing: boolean;
  recentEvent: boolean;
  lastEventReceivedAt: string | null;
  webhooksReceiving: boolean;
  lastWebhookReceivedAt: string | null;
  lastWebhookTopic: string | null;
  scopesGranted: boolean;
}

function HealthRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-neutral-100 bg-white">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {ok ? (
          <CircleCheck className="w-4 h-4 text-success-500 shrink-0" />
        ) : (
          <CircleX className="w-4 h-4 text-danger-500 shrink-0" />
        )}
        <span className="text-sm font-medium text-neutral-800">{label}</span>
      </div>
      {detail && (
        <span className="text-xs text-neutral-400 shrink-0">{detail}</span>
      )}
    </div>
  );
}

function CheckoutHealthPanel() {
  const [data, setData] = useState<CheckoutHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/status");
      if (!res.ok) throw new Error("Failed to load health data");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const allOk =
    data &&
    data.checkoutExtensionActive &&
    data.discountEngineActive &&
    data.cogsConfigured &&
    data.eventsFlowing &&
    data.webhooksReceiving &&
    data.scopesGranted;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-neutral-500" />
            <CardTitle>Checkout &amp; Function Health</CardTitle>
            {data && (
              <Badge variant={allOk ? "success" : "warning"}>
                {allOk ? "All systems go" : "Issues detected"}
              </Badge>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {data ? "Refresh" : "Load"}
          </Button>
        </div>
      </CardHeader>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!data && !loading && (
        <p className="text-sm text-neutral-400 py-2">
          Click <strong>Load</strong> to run a health check on all checkout
          integrations.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Running health checks…
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Extensions */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Extensions &amp; functions
            </p>
            <div className="space-y-1.5">
              <HealthRow
                ok={data.checkoutExtensionActive}
                label="Checkout UI extension"
                detail={
                  data.checkoutExtensionActive
                    ? `${data.checkoutBlockCount} block${data.checkoutBlockCount !== 1 ? "s" : ""} active`
                    : "No checkout blocks found — add the extension in the Checkout editor"
                }
              />
              <HealthRow
                ok={data.discountEngineActive}
                label="Discount function"
                detail={
                  data.discountEngineActive
                    ? `${data.discountFunctionExperimentCount} function experiment${data.discountFunctionExperimentCount !== 1 ? "s" : ""} configured`
                    : "No discount function experiments — create a Discount Test to activate"
                }
              />
              <HealthRow
                ok={data.cogsConfigured}
                label="COGS / cost data"
                detail={
                  data.cogsConfigured
                    ? `${data.cogsVariantCount} variant${data.cogsVariantCount !== 1 ? "s" : ""} with cost data`
                    : "No product costs found — upload a COGS CSV in Settings"
                }
              />
            </div>
          </div>

          {/* Data pipeline */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Data pipeline
            </p>
            <div className="space-y-1.5">
              <HealthRow
                ok={data.eventsFlowing}
                label="Storefront events flowing"
                detail={
                  data.lastEventReceivedAt
                    ? `Last: ${new Date(data.lastEventReceivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                    : "No events received — check the Theme App Embed is enabled"
                }
              />
              <HealthRow
                ok={data.recentEvent}
                label="Events received in last 7 days"
                detail={data.recentEvent ? "Active" : "Stale — no events in 7 days"}
              />
              <HealthRow
                ok={data.webhooksReceiving}
                label="Webhooks receiving"
                detail={
                  data.lastWebhookReceivedAt
                    ? `Last: ${data.lastWebhookTopic ?? "unknown"} · ${new Date(data.lastWebhookReceivedAt).toLocaleString("en-US", { month: "short", day: "numeric" })}`
                    : "No webhooks received"
                }
              />
              <HealthRow
                ok={data.scopesGranted}
                label="OAuth scopes granted"
                detail={data.scopesGranted ? "All scopes present" : "Missing scopes — reinstall the app"}
              />
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 pt-1">
            Data sourced from <code className="bg-neutral-100 px-1 rounded">/api/onboarding/status</code>. All checks are read-only.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function DebugPage() {
  const [visitorId, setVisitorId] = useState("");
  const [assignmentData, setAssignmentData] = useState<Record<string, unknown> | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [eventQuery, setEventQuery] = useState("");

  async function lookupAssignments() {
    if (!visitorId.trim()) return;
    setLoadingAssignment(true);
    try {
      const res = await fetch(
        `/api/debug/assignments?visitorId=${encodeURIComponent(visitorId.trim())}&shop=${encodeURIComponent("demo.myshopify.com")}`
      );
      const data = await res.json();
      setAssignmentData(data);
    } catch {
      setAssignmentData({ error: "Failed to fetch assignments" });
    } finally {
      setLoadingAssignment(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Debug & QA</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Inspect assignments, events, and runtime state</p>
        </div>

        <div className="space-y-6">
        {/* Kill Switches */}
        <KillSwitchPanel />

        {/* Attribution Debug */}
        <AttributionDebugPanel />

        {/* Checkout & Function Health */}
        <CheckoutHealthPanel />

        {/* Debug URLs */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Query Parameters</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {[
              {
                param: "marginlab_debug=true",
                description: "Show debug overlay on storefront",
                icon: Terminal,
              },
              {
                param: "marginlab_preview={experimentId}:{variantKey}",
                description: "Force preview a specific variant",
                icon: Eye,
              },
              {
                param: "marginlab_force={experimentSlug}:{variantKey}",
                description: "Force assign to a variant (persisted to localStorage)",
                icon: RefreshCw,
              },
            ].map((item) => (
              <div
                key={item.param}
                className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg"
              >
                <item.icon className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <code className="text-xs text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded font-mono">
                    ?{item.param}
                  </code>
                  <p className="text-xs text-neutral-500 mt-1">{item.description}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText("?" + item.param)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Assignment Inspector */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Inspector</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={visitorId}
                onChange={(e) => setVisitorId(e.target.value)}
                placeholder="Visitor ID (from _ml_vid localStorage)"
                className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button
                onClick={lookupAssignments}
                loading={loadingAssignment}
                icon={<Search className="w-3.5 h-3.5" />}
              >
                Lookup
              </Button>
            </div>

            {assignmentData && (
              <div className="bg-neutral-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(assignmentData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {/* Runtime Config Inspector */}
        <Card>
          <CardHeader>
            <CardTitle>Runtime Config Preview</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">
              The runtime config is served from{" "}
              <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                /api/runtime/config
              </code>{" "}
              to the storefront. This is what the storefront runtime fetches on page load.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() =>
                  window.open(
                    `/api/runtime/config?shop=demo.myshopify.com`,
                    "_blank"
                  )
                }
              >
                View Config JSON
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() =>
                  window.open(
                    `/api/runtime/events`,
                    "_blank"
                  )
                }
              >
                Events Endpoint
              </Button>
            </div>
          </div>
        </Card>

        {/* QA Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Pre-Launch QA Checklist</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {[
              "Theme App Extension is active in theme editor",
              "API Base URL is correctly set in extension settings",
              "Runtime script loads on storefront (check Network tab)",
              "Visitor ID is created in localStorage (_ml_vid)",
              "Config fetch returns 200 with experiment data",
              "Variant assignment is consistent across page reloads",
              "Content modifications render correctly",
              "Cart attributes are synced before checkout",
              "Web Pixel is active and sending events",
              "Test order is attributed to correct variant",
            ].map((item, i) => (
              <ChecklistItem key={i} label={item} />
            ))}
          </div>
        </Card>

        {/* Webhook Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Logs</CardTitle>
          </CardHeader>
          <p className="text-sm text-neutral-500">
            Webhook processing logs appear here. Filter by topic using the API.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open("/api/debug/webhooks?shop=demo.myshopify.com", "_blank")}
            >
              View Webhook Logs
            </Button>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="mt-0.5 rounded accent-brand-600 cursor-pointer"
      />
      <span
        className={`text-sm ${checked ? "line-through text-neutral-400" : "text-neutral-700 group-hover:text-neutral-900"}`}
      >
        {label}
      </span>
    </label>
  );
}
