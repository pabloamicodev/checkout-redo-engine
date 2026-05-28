"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type IntegrationType = "GA4" | "KLAVIYO" | "CLARITY" | "HEAP" | "SEGMENT" | "ELEVAR" | "SLACK" | "OUTBOUND_WEBHOOK";

interface Integration {
  id: string;
  type: IntegrationType;
  enabled: boolean;
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  updatedAt: string;
}

const INTEGRATION_META: Record<IntegrationType, {
  label: string;
  description: string;
  icon: string;
  credentialFields: Array<{ key: string; label: string; type: "text" | "password" | "url"; placeholder: string }>;
}> = {
  GA4: {
    label: "Google Analytics 4",
    description: "Send experiment events to GA4 via Measurement Protocol.",
    icon: "📊",
    credentialFields: [
      { key: "measurementId", label: "Measurement ID", type: "text", placeholder: "G-XXXXXXXXXX" },
      { key: "apiSecret", label: "API Secret", type: "password", placeholder: "GA4 Measurement Protocol secret" },
    ],
  },
  KLAVIYO: {
    label: "Klaviyo",
    description: "Sync experiment assignments as profile properties and track custom events.",
    icon: "📧",
    credentialFields: [
      { key: "privateKey", label: "Private API Key", type: "password", placeholder: "pk_…" },
    ],
  },
  CLARITY: {
    label: "Microsoft Clarity",
    description: "Tag Clarity sessions with experiment and variant names.",
    icon: "🔍",
    credentialFields: [
      { key: "projectId", label: "Project ID", type: "text", placeholder: "Clarity project ID" },
    ],
  },
  HEAP: {
    label: "Heap",
    description: "Add experiment variant properties to Heap user identities.",
    icon: "📈",
    credentialFields: [
      { key: "appId", label: "App ID", type: "text", placeholder: "Heap app ID" },
    ],
  },
  SEGMENT: {
    label: "Segment",
    description: "Track experiment events and traits via Segment's HTTP API.",
    icon: "🔀",
    credentialFields: [
      { key: "writeKey", label: "Write Key", type: "password", placeholder: "Segment write key" },
    ],
  },
  ELEVAR: {
    label: "Elevar",
    description: "Push experiment assignments into Elevar's data layer.",
    icon: "📡",
    credentialFields: [
      { key: "containerId", label: "Container ID", type: "text", placeholder: "Elevar container ID" },
    ],
  },
  SLACK: {
    label: "Slack",
    description: "Receive notifications when experiments start, stop, or reach significance.",
    icon: "💬",
    credentialFields: [
      { key: "webhookUrl", label: "Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/…" },
    ],
  },
  OUTBOUND_WEBHOOK: {
    label: "Outbound Webhook",
    description: "POST signed JSON payloads to your endpoint on every experiment event.",
    icon: "🔗",
    credentialFields: [
      { key: "url", label: "Endpoint URL", type: "url", placeholder: "https://your-server.com/marginlab-events" },
      { key: "secret", label: "Signing Secret", type: "password", placeholder: "HMAC-SHA256 signing secret" },
    ],
  },
};

const ALL_TYPES = Object.keys(INTEGRATION_META) as IntegrationType[];

interface Props {
  initialIntegrations: Integration[];
}

export function IntegrationsClient({ initialIntegrations }: Props) {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<Map<IntegrationType, Integration>>(
    () => new Map(initialIntegrations.map((i) => [i.type as IntegrationType, i]))
  );
  const [expanded, setExpanded] = useState<IntegrationType | null>(null);
  const [saving, setSaving] = useState<IntegrationType | null>(null);
  const [testing, setTesting] = useState<IntegrationType | null>(null);
  const [testResult, setTestResult] = useState<Map<IntegrationType, { ok: boolean; message: string }>>(new Map());
  const [credentials, setCredentials] = useState<Map<IntegrationType, Record<string, string>>>(
    () => new Map(initialIntegrations.map((i) => [i.type as IntegrationType, i.credentials]))
  );

  function getCredentials(type: IntegrationType): Record<string, string> {
    return credentials.get(type) ?? {};
  }

  function setField(type: IntegrationType, key: string, value: string) {
    setCredentials((prev) => {
      const next = new Map(prev);
      next.set(type, { ...getCredentials(type), [key]: value });
      return next;
    });
  }

  async function handleSave(type: IntegrationType) {
    setSaving(type);
    const label = INTEGRATION_META[type].label;
    try {
      const existing = integrations.get(type);
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          enabled: existing?.enabled ?? true,
          credentials: getCredentials(type),
          settings: existing?.settings ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setIntegrations((prev) => {
        const next = new Map(prev);
        next.set(type, data);
        return next;
      });
      toast.success(`${label} credentials saved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not save ${label} credentials. Please try again.`);
    } finally {
      setSaving(null);
    }
  }

  async function handleToggle(type: IntegrationType) {
    const existing = integrations.get(type);
    const newEnabled = !(existing?.enabled ?? false);
    const label = INTEGRATION_META[type].label;
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          enabled: newEnabled,
          credentials: getCredentials(type),
          settings: existing?.settings ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setIntegrations((prev) => {
        const next = new Map(prev);
        next.set(type, data);
        return next;
      });
      toast.success(newEnabled ? `${label} enabled.` : `${label} disabled.`);
    } catch {
      toast.error(`Could not update ${label}. Please try again.`);
    }
  }

  async function handleTest(type: IntegrationType, integrationId: string) {
    setTesting(type);
    setTestResult((prev) => { const n = new Map(prev); n.delete(type); return n; });
    const label = INTEGRATION_META[type].label;
    try {
      const res = await fetch(`/api/integrations/${integrationId}/test`, { method: "POST" });
      const data = await res.json();
      const result = { ok: data.ok, message: data.message ?? (data.ok ? "Connection successful" : "Test failed") };
      setTestResult((prev) => { const n = new Map(prev); n.set(type, result); return n; });
      if (data.ok) {
        toast.success(`${label} connection test passed.`);
      } else {
        toast.error(`${label} connection test failed: ${result.message}`);
      }
    } catch {
      const result = { ok: false, message: "Network error" };
      setTestResult((prev) => { const n = new Map(prev); n.set(type, result); return n; });
      toast.error(`Could not test ${label} connection. Check your network.`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-3">
      {ALL_TYPES.map((type) => {
        const meta = INTEGRATION_META[type];
        const integration = integrations.get(type);
        const isExpanded = expanded === type;
        const creds = getCredentials(type);
        const result = testResult.get(type);
        const hasCredentials = meta.credentialFields.every((f) => creds[f.key]?.trim());

        return (
          <div key={type} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 text-sm">{meta.label}</span>
                    {integration && (
                      <Badge variant={integration.enabled ? "success" : "neutral"} dot>
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{meta.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration && (
                  <button
                    onClick={() => handleToggle(type)}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${integration.enabled ? "bg-brand-600" : "bg-neutral-200"}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${integration.enabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
                  </button>
                )}
                <button onClick={() => setExpanded(isExpanded ? null : type)} className="text-neutral-400 hover:text-neutral-600 p-1">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-5 pb-5 border-t border-neutral-100 pt-4 space-y-4">
                <div className="grid gap-3">
                  {meta.credentialFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">{field.label}</label>
                      <input
                        type={field.type}
                        className="input-base"
                        placeholder={field.placeholder}
                        value={creds[field.key] ?? ""}
                        onChange={(e) => setField(type, field.key, e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>

                {result && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {result.message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={() => handleSave(type)} disabled={saving === type || !hasCredentials}>
                    {saving === type ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving…</> : "Save credentials"}
                  </Button>
                  {integration && (
                    <Button size="sm" variant="ghost" onClick={() => handleTest(type, integration.id)} disabled={testing === type}>
                      {testing === type ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Testing…</> : "Test connection"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
