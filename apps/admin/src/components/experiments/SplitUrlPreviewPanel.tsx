"use client";

import { Home, Shuffle, XCircle, AlertTriangle, CheckCircle2, Smartphone, Monitor } from "lucide-react";

// ---------------------------------------------------------------------------
// Types (self-contained — does not import from SplitUrlWizard)
// ---------------------------------------------------------------------------
export interface PreviewVariant {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  redirectUrl: string;
}

export interface PreviewTargeting {
  deviceType: "all" | "mobile" | "desktop";
  trafficSource: "all" | "paid" | "organic";
  newVisitorsOnly: boolean;
}

export interface SplitUrlPreviewProps {
  step: number;
  name: string;
  trafficAllocation: number;
  variants: PreviewVariant[];
  targeting: PreviewTargeting;
  preserveQueryParams: boolean;
  preserveUtm: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SKY = "#0284c7";
const ACCENT_GRADIENT = "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  if (url.startsWith("/")) return true;
  try { new URL(url); return true; } catch { return false; }
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function hasDuplicateUrls(variants: PreviewVariant[]): boolean {
  const urls = variants.map((v) => v.redirectUrl.trim()).filter(Boolean);
  return new Set(urls).size !== urls.length;
}

function truncateUrl(url: string, max = 32): string {
  if (!url) return "";
  const display = url.replace(/^https?:\/\//, "");
  return display.length > max ? display.slice(0, max) + "…" : display;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function UrlStatusBadge({ url, duplicates }: { url: string; duplicates: boolean }) {
  if (!url.trim()) return null;
  if (duplicates) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-2.5 h-2.5" /> Duplicate
    </span>
  );
  if (!isValidUrl(url)) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-2.5 h-2.5" /> Invalid URL
    </span>
  );
  if (isExternalUrl(url)) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <AlertTriangle className="w-2.5 h-2.5" /> External
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-2.5 h-2.5" /> Valid
    </span>
  );
}

function RedirectFlowDiagram({ variants }: { variants: PreviewVariant[] }) {
  const duplicates = hasDuplicateUrls(variants);

  return (
    <div className="flex flex-col items-center gap-0 select-none">
      <div className="flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shadow-sm border-2"
          style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          👤
        </div>
        <span className="text-[10px] text-neutral-500 font-medium">Visitor arrives</span>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-px h-4 bg-neutral-300" />
        <div className="w-0 h-0" style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #d1d5db" }} />
      </div>

      <div className="rounded-lg px-4 py-2 text-white text-[11px] font-bold shadow-sm flex items-center gap-1.5"
        style={{ background: ACCENT_GRADIENT }}>
        <span className="text-base leading-none">⇄</span>
        MarginLab Router
      </div>

      <div className="w-full mt-0">
        <div className="flex justify-around items-start pt-0 relative">
          <div className="absolute top-0 h-px bg-neutral-300"
            style={{ left: `${100 / (variants.length * 2)}%`, right: `${100 / (variants.length * 2)}%` }} />
          {variants.map((v) => (
            <div key={v.key} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
              <div className="w-px h-3 bg-neutral-300" />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={v.isControl ? { background: "#e0f2fe", color: "#0369a1" } : { background: "#f3f4f6", color: "#4b5563" }}>
                {v.allocationPercent}%
              </span>
              <div className="w-full rounded-lg border overflow-hidden"
                style={v.isControl ? { borderColor: "#bae6fd", background: "#f0f9ff" } : { borderColor: "#e5e7eb", background: "#fff" }}>
                <div className="px-2 py-1.5 flex items-center gap-1.5 border-b"
                  style={v.isControl ? { borderColor: "#bae6fd", background: "#e0f2fe" } : { borderColor: "#f3f4f6", background: "#f9fafb" }}>
                  {v.isControl
                    ? <Home className="w-2.5 h-2.5 shrink-0" style={{ color: SKY }} />
                    : <Shuffle className="w-2.5 h-2.5 text-neutral-400 shrink-0" />}
                  <span className="text-[10px] font-semibold text-neutral-700 truncate">{v.name}</span>
                </div>
                <div className="px-2 py-2">
                  {v.redirectUrl.trim() ? (
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] text-neutral-600 leading-tight break-all line-clamp-2">
                        {truncateUrl(v.redirectUrl, 28)}
                      </span>
                      <div className="flex justify-center">
                        <UrlStatusBadge url={v.redirectUrl} duplicates={duplicates} />
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-[9px] text-neutral-300 italic">— URL not set —</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-2 bg-neutral-300" />
                <div className="w-0 h-0" style={{ borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "4px solid #d1d5db" }} />
              </div>
              <div className="rounded-md px-2 py-1 bg-emerald-50 border border-emerald-200 text-[9px] font-medium text-emerald-700 text-center whitespace-nowrap">
                Checkout
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main preview panel (default export for React.lazy)
// ---------------------------------------------------------------------------
export default function SplitUrlPreviewPanel({
  step,
  name,
  trafficAllocation,
  variants,
  targeting,
  preserveQueryParams,
  preserveUtm,
}: SplitUrlPreviewProps) {
  const totalAlloc = variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
  const allocOk = Math.abs(totalAlloc - 100) < 0.01;
  const activeTargeting =
    targeting.deviceType !== "all" ||
    targeting.trafficSource !== "all" ||
    targeting.newVisitorsOnly;

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-neutral-100" style={{ background: `${SKY}08` }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: SKY }}>Live Preview</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">Redirect flow diagram</p>
      </div>

      <div className="p-4">
        <RedirectFlowDiagram variants={variants} />
      </div>

      <div className="border-t border-neutral-50 mx-4" />

      {step >= 2 && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">Targeting</p>
          {activeTargeting ? (
            <div className="flex flex-wrap gap-1.5">
              {targeting.deviceType !== "all" && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5 font-medium">
                  {targeting.deviceType === "mobile" ? <Smartphone className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                  {targeting.deviceType === "mobile" ? "Mobile only" : "Desktop only"}
                </span>
              )}
              {targeting.trafficSource !== "all" && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5 font-medium">
                  {targeting.trafficSource === "paid" ? "Paid traffic" : "Organic only"}
                </span>
              )}
              {targeting.newVisitorsOnly && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                  New visitors only
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400 italic">All visitors eligible</p>
          )}
        </div>
      )}

      {step >= 3 && (
        <>
          <div className="border-t border-neutral-50 mx-4" />
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">Settings</p>
            <div className="space-y-1.5">
              {[
                { label: "Query params preserved", on: preserveQueryParams },
                { label: "UTM params preserved", on: preserveUtm },
                { label: "Loop protection", on: true },
              ].map(({ label, on }) => (
                <div key={label} className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-600">{label}</span>
                  <span className={`font-semibold ${on ? "text-emerald-600" : "text-red-500"}`}>
                    {on ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="border-t border-neutral-100 px-4 py-3 bg-neutral-50">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Test name</span>
            <span className="font-medium text-neutral-800 truncate max-w-[120px]">
              {name.trim() || <span className="text-neutral-300 italic">Not set</span>}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">URL variants</span>
            <span className="font-medium text-neutral-800">{variants.length}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Traffic split</span>
            <span className={`font-semibold ${allocOk ? "text-emerald-600" : "text-amber-600"}`}>
              {allocOk ? `✓ ${totalAlloc}%` : `${totalAlloc.toFixed(1)}% — adjust`}
            </span>
          </div>
          {trafficAllocation < 100 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">Enrolled visitors</span>
              <span className="font-medium text-neutral-800">{trafficAllocation}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
