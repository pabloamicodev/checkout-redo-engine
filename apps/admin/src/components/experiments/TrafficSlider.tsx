"use client";

import { Users, EyeOff } from "lucide-react";

const PRESETS = [10, 25, 50, 75, 100];

/**
 * Beautiful traffic enrollment selector — replaces the plain <input type="number">
 * for overall traffic allocation in all test wizards.
 *
 * Shows:
 *   • Enrolled / Holdout stat cards (live updates as you drag)
 *   • A styled range slider with accent-colored fill
 *   • Quick-select preset buttons
 */
export function TrafficSlider({
  value,
  onChange,
  accentColor = "#6366f1",
  holdoutLabel = "See original",
}: {
  value: number;
  onChange: (v: number) => void;
  accentColor?: string;
  holdoutLabel?: string;
}) {
  const pct     = Math.min(100, Math.max(1, Math.round(value)));
  const holdout = 100 - pct;

  return (
    <div className="space-y-4">

      {/* ── Enrolled / Holdout stat cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Enrolled */}
        <div
          className="rounded-xl px-4 pt-4 pb-3.5 border-2 transition-colors"
          style={{ borderColor: accentColor, background: `${accentColor}0a` }}
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            <Users className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
            <p
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              Enrolled
            </p>
          </div>
          <p
            className="text-[2.25rem] font-black leading-none tracking-tight tabular-nums"
            style={{ color: accentColor }}
          >
            {pct}
            <span className="text-xl font-bold">%</span>
          </p>
          <p className="text-[10px] mt-1.5 leading-snug" style={{ color: `${accentColor}99` }}>
            Enter this test
          </p>
        </div>

        {/* Holdout */}
        <div className="rounded-xl px-4 pt-4 pb-3.5 border-2 border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-1.5 mb-2.5">
            <EyeOff className="w-3 h-3 text-neutral-300 shrink-0" />
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-300">
              Holdout
            </p>
          </div>
          <p className="text-[2.25rem] font-black leading-none tracking-tight tabular-nums text-neutral-300">
            {holdout}
            <span className="text-xl font-bold">%</span>
          </p>
          <p className="text-[10px] text-neutral-300 mt-1.5 leading-snug">{holdoutLabel}</p>
        </div>
      </div>

      {/* ── Slider ────────────────────────────────────────────────────── */}
      <div className="px-0.5">
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="traffic-slider w-full"
          style={
            {
              "--ts-accent": accentColor,
              "--ts-pct":    `${pct}%`,
            } as React.CSSProperties
          }
          aria-label="Traffic allocation"
          aria-valuemin={1}
          aria-valuemax={100}
          aria-valuenow={pct}
        />
        <div className="flex justify-between text-[9px] text-neutral-300 mt-1 px-0.5 select-none">
          <span>1%</span>
          <span>100%</span>
        </div>
      </div>

      {/* ── Quick-select presets ────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
          Quick select
        </p>
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => {
            const active = pct === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className="flex-1 py-1.5 rounded-lg border text-[11px] font-bold transition-all duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background:   active ? accentColor : "transparent",
                  color:        active ? "#fff"       : "#94a3b8",
                  borderColor:  active ? accentColor  : "#e5e7eb",
                  boxShadow:    active ? `0 2px 10px ${accentColor}45` : "none",
                }}
              >
                {p}%
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
