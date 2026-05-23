"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnippetData {
  experimentId: string;
  experimentName: string;
  snippet: string;
  installationGuide: string;
  debugScript: string;
  variants: { key: string; name: string; themeId: number; themeName: string }[];
  cssAssets: string[];
  jsAssets: string[];
  generatedAt: string;
}

interface ThemeSnippetPanelProps {
  experimentId: string;
  experimentName: string;
  /** Show a "webhook paused" warning if set */
  webhookPauseReason?: string | null;
  webhookPausedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-neutral-600 hover:text-neutral-900"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </button>
  );
}

function CodeBlock({
  code,
  language = "liquid",
  label,
}: {
  code: string;
  language?: string;
  label?: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">{label}</span>
          <CopyButton text={code} label="Copy code" />
        </div>
      )}
      <pre className="bg-neutral-900 text-neutral-100 text-[11px] leading-relaxed font-mono p-4 overflow-x-auto max-h-72 whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors text-left"
      >
        <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
        <span className="text-sm font-semibold text-neutral-800 flex-1">{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        )}
      </button>
      {open && <div className="border-t border-neutral-100 p-4 bg-white">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ThemeSnippetPanel({
  experimentId,
  experimentName,
  webhookPauseReason,
  webhookPausedAt,
}: ThemeSnippetPanelProps) {
  const [data, setData] = useState<SnippetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnippet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/theme-tests/${experimentId}/snippet`);
      const json = (await res.json()) as SnippetData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load snippet");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snippet");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void fetchSnippet();
  }, [fetchSnippet]);

  // Download snippet as .liquid file
  function downloadSnippet() {
    if (!data) return;
    const blob = new Blob([data.snippet], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marginlab-theme-ab.liquid";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50 mb-6">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-amber-200 bg-amber-50">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm">◧</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">Theme snippet installation required</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            To enable per-visitor theme serving, add the MarginLab snippet to your published theme.
            The live theme is{" "}
            <strong>never changed</strong> — variant CSS/JS is injected per-visitor at runtime.
          </p>
        </div>
      </div>

      {/* Webhook pause warning */}
      {webhookPauseReason && (
        <div className="flex items-start gap-3 px-5 py-3 bg-red-50 border-b border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-800">Test auto-paused by webhook</p>
            <p className="text-xs text-red-700 mt-0.5">{webhookPauseReason}</p>
            {webhookPausedAt && (
              <p className="text-[11px] text-red-500 mt-1">
                At {new Date(webhookPausedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Quick-add tag */}
        <div>
          <p className="text-xs font-semibold text-neutral-700 mb-2">
            1. Add this to <code className="bg-neutral-100 px-1 rounded text-[11px]">layout/theme.liquid</code> — first child of{" "}
            <code className="bg-neutral-100 px-1 rounded text-[11px]">&lt;head&gt;</code>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono bg-neutral-900 text-emerald-400 px-3 py-2 rounded-lg border border-neutral-700">
              {`{%- render 'marginlab-theme-ab' -%}`}
            </code>
            <CopyButton text={`{%- render 'marginlab-theme-ab' -%}`} />
          </div>
        </div>

        {/* Snippet file */}
        <div>
          <p className="text-xs font-semibold text-neutral-700 mb-2">
            2. Save as <code className="bg-neutral-100 px-1 rounded text-[11px]">snippets/marginlab-theme-ab.liquid</code>
          </p>

          {loading && (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-neutral-400">
              <RefreshCw className="w-4 h-4 animate-spin" /> Generating snippet…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-800">Could not generate snippet</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                <button
                  type="button"
                  onClick={fetchSnippet}
                  className="text-xs text-red-600 underline mt-1"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {data && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadSnippet}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 transition-colors text-zinc-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .liquid file
                </button>
                <CopyButton text={data.snippet} label="Copy snippet" />
                <button
                  type="button"
                  onClick={fetchSnippet}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>

              <CodeBlock
                code={data.snippet}
                label="snippets/marginlab-theme-ab.liquid"
                language="liquid"
              />

              {/* Variant summary */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
                <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
                  <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Variant → Theme mapping (baked into snippet)
                  </p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {data.variants.map((v) => (
                    <div key={v.key} className="flex items-center gap-4 px-4 py-2.5">
                      <code className="text-xs font-mono text-neutral-600 w-28 shrink-0">{v.key}</code>
                      <span className="text-xs text-neutral-800 flex-1">{v.themeName}</span>
                      <span className="text-[11px] text-neutral-400 font-mono">ID: {v.themeId}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detected assets */}
              {(data.cssAssets.length > 0 || data.jsAssets.length > 0) && (
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Assets detected from Shopify API
                  </p>
                  <div className="space-y-1">
                    {data.cssAssets.map((url) => (
                      <div key={url} className="flex items-center gap-2">
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">CSS</span>
                        <code className="text-[11px] text-neutral-600 truncate">{url}</code>
                      </div>
                    ))}
                    {data.jsAssets.map((url) => (
                      <div key={url} className="flex items-center gap-2">
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">JS</span>
                        <code className="text-[11px] text-neutral-600 truncate">{url}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible sections */}
        <div className="space-y-2">
          <CollapsibleSection title="Installation guide" icon={BookOpen} defaultOpen={false}>
            {data ? (
              <div className="prose prose-sm max-w-none text-neutral-700 text-xs leading-relaxed whitespace-pre-wrap">
                {data.installationGuide}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">Load snippet to view installation guide.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Debug script (run in DevTools console)" icon={Terminal} defaultOpen={false}>
            {data ? (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">
                  Paste this in your browser console to test assignment cookie reading without the Liquid wrapper.
                  Set{" "}
                  <code className="bg-neutral-100 px-1 rounded">ml_v_{experimentId}=variant_a</code> as a cookie first.
                </p>
                <CodeBlock code={data.debugScript} label="debug.js" language="javascript" />
              </div>
            ) : (
              <p className="text-xs text-neutral-400">Load snippet to view debug script.</p>
            )}
          </CollapsibleSection>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href="https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/snippets"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1 underline"
          >
            Shopify snippets docs <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={`https://${experimentName ? "" : ""}admin.shopify.com/store/themes`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1 underline"
          >
            Open theme editor <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
