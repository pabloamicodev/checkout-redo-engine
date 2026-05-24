"use client";

import { ReactNode, useState } from "react";

// ─── WizardField ─────────────────────────────────────────────────────────────

interface WizardFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  action?: ReactNode;
  children: ReactNode;
}

export function WizardField({ label, hint, error, required, action, children }: WizardFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1 text-sm font-semibold text-neutral-700 leading-none">
          {label}
          {required && <span className="text-rose-400 text-xs ml-0.5">*</span>}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-rose-500 font-medium leading-tight">{error}</p>
      ) : hint ? (
        <p className="text-xs text-neutral-500 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── WizardInput ─────────────────────────────────────────────────────────────

interface WizardInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  accentColor?: string;
  icon?: ReactNode;
  mono?: boolean;
  autoFocus?: boolean;
}

export function WizardInput({
  label,
  value,
  onChange,
  onBlur: onBlurProp,
  placeholder,
  hint,
  error,
  required,
  maxLength,
  accentColor = "#6366f1",
  icon,
  mono,
  autoFocus,
}: WizardInputProps) {
  const [focused, setFocused] = useState(false);
  const near = maxLength ? value.length > maxLength * 0.8 : false;
  const over = maxLength ? value.length >= maxLength : false;

  return (
    <WizardField label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none flex items-center">
            {icon}
          </span>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlurProp?.(); }}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={`w-full rounded-xl border bg-white py-3 text-sm placeholder-neutral-400 transition-all ${mono ? "font-mono text-neutral-700" : "text-neutral-800"}`}
          style={{
            paddingLeft: icon ? "2.5rem" : "1rem",
            paddingRight: maxLength ? "3.5rem" : "1rem",
            borderColor: focused ? accentColor : error ? "#f43f5e" : "#e5e7eb",
            boxShadow: focused ? `0 0 0 3px ${accentColor}1a` : "none",
            outline: "none",
          }}
        />
        {maxLength && (
          <span
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs tabular-nums pointer-events-none transition-colors"
            style={{ color: over ? "#f43f5e" : near ? accentColor : "#c4c4c4" }}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </WizardField>
  );
}

// ─── WizardTextarea ───────────────────────────────────────────────────────────

interface WizardTextareaProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  accentColor?: string;
  templateText?: string;
  mono?: boolean;
}

export function WizardTextarea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  required,
  rows = 3,
  maxLength,
  accentColor = "#6366f1",
  templateText,
  mono,
}: WizardTextareaProps) {
  const [focused, setFocused] = useState(false);
  const near = maxLength ? value.length > maxLength * 0.8 : false;

  const action = templateText ? (
    <button
      type="button"
      className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0 leading-none"
      style={{ color: accentColor, background: `${accentColor}12` }}
      onMouseDown={(e) => {
        e.preventDefault();
        onChange(templateText);
      }}
    >
      Use template ↗
    </button>
  ) : undefined;

  return (
    <WizardField label={label} hint={hint} error={error} required={required} action={action}>
      <div className="relative">
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm resize-none placeholder-neutral-400 transition-all ${mono ? "font-mono text-neutral-700" : "text-neutral-800"}`}
          style={{
            paddingBottom: maxLength ? "1.875rem" : "0.75rem",
            borderColor: focused ? accentColor : error ? "#f43f5e" : "#e5e7eb",
            boxShadow: focused ? `0 0 0 3px ${accentColor}1a` : "none",
            outline: "none",
          }}
        />
        {maxLength && (
          <span
            className="absolute right-3 bottom-2.5 text-xs tabular-nums pointer-events-none transition-colors"
            style={{ color: near ? accentColor : "#c4c4c4" }}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </WizardField>
  );
}

// ─── WizardNumberInput ────────────────────────────────────────────────────────

interface WizardNumberInputProps {
  label: string;
  value: number | string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  unit?: string;
  hint?: string;
  accentColor?: string;
}

export function WizardNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  unit,
  hint,
  accentColor = "#6366f1",
}: WizardNumberInputProps) {
  const [focused, setFocused] = useState(false);
  const num = typeof value === "number" ? value : parseFloat(String(value)) || 0;
  const atMin = min !== undefined && num <= min;
  const atMax = max !== undefined && num >= max;

  const decrement = () => {
    const next = parseFloat((num - step).toFixed(10));
    if (min !== undefined && next < min) return;
    onChange(next);
  };
  const increment = () => {
    const next = parseFloat((num + step).toFixed(10));
    if (max !== undefined && next > max) return;
    onChange(next);
  };

  return (
    <WizardField label={label} hint={hint}>
      <div
        className="inline-flex items-stretch rounded-xl border overflow-hidden transition-all"
        style={{
          borderColor: focused ? accentColor : "#e5e7eb",
          boxShadow: focused ? `0 0 0 3px ${accentColor}1a` : "none",
        }}
      >
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          className="flex items-center justify-center w-11 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 border-r border-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors select-none"
          style={{ fontSize: "1.25rem", lineHeight: 1, fontWeight: 300 }}
        >
          −
        </button>
        <div className="flex items-center gap-1 px-4 bg-white min-w-0">
          {prefix && <span className="text-sm text-neutral-500 font-medium shrink-0">{prefix}</span>}
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (isNaN(v)) return;
              const clamped =
                max !== undefined
                  ? Math.min(max, Math.max(min ?? 0, v))
                  : Math.max(min ?? 0, v);
              onChange(clamped);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-16 text-center text-sm font-semibold text-neutral-800 bg-transparent outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-sm text-neutral-500 shrink-0">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={increment}
          disabled={atMax}
          className="flex items-center justify-center w-11 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 border-l border-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors select-none"
          style={{ fontSize: "1.25rem", lineHeight: 1, fontWeight: 300 }}
        >
          +
        </button>
      </div>
    </WizardField>
  );
}

// ─── WizardCheckCard ──────────────────────────────────────────────────────────

interface WizardCheckCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
  accentColor?: string;
  strikeOnCheck?: boolean;
}

export function WizardCheckCard({
  checked,
  onChange,
  label,
  description,
  icon,
  accentColor = "#6366f1",
  strikeOnCheck,
}: WizardCheckCardProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 rounded-xl px-4 py-3.5 border text-left transition-all"
      style={{
        borderColor: checked ? accentColor : "#e5e7eb",
        background: checked ? `${accentColor}08` : "white",
      }}
    >
      <div
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all"
        style={{
          borderColor: checked ? accentColor : "#d1d5db",
          background: checked ? accentColor : "transparent",
        }}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {icon && <span className="text-neutral-400 flex-shrink-0">{icon}</span>}
          <span
            className={`text-sm font-medium transition-colors ${
              checked && strikeOnCheck ? "line-through text-neutral-400" : "text-neutral-700"
            }`}
          >
            {label}
          </span>
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">{description}</p>
        )}
      </div>
      {checked && (
        <span
          className="text-xs font-bold shrink-0 mt-0.5"
          style={{ color: accentColor }}
        >
          ✓
        </span>
      )}
    </button>
  );
}

// ─── WizardCheckCardGroup ─────────────────────────────────────────────────────

interface WizardCheckCardGroupOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface WizardCheckCardGroupProps {
  label?: string;
  hint?: string;
  options: WizardCheckCardGroupOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accentColor?: string;
  columns?: 1 | 2;
  strikeOnCheck?: boolean;
}

export function WizardCheckCardGroup({
  label,
  hint,
  options,
  selected,
  onChange,
  accentColor = "#6366f1",
  columns = 1,
  strikeOnCheck,
}: WizardCheckCardGroupProps) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  return (
    <div className="space-y-2">
      {(label || hint) && (
        <div className="flex items-center justify-between">
          {label && <p className="text-sm font-semibold text-neutral-700">{label}</p>}
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      )}
      <div className={columns === 2 ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        {options.map((opt) => (
          <WizardCheckCard
            key={opt.value}
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            label={opt.label}
            description={opt.description}
            icon={opt.icon}
            accentColor={accentColor}
            strikeOnCheck={strikeOnCheck}
          />
        ))}
      </div>
    </div>
  );
}

// ─── WizardRadioCard ──────────────────────────────────────────────────────────

interface WizardRadioCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  accentColor?: string;
}

export function WizardRadioCard({
  selected,
  onSelect,
  label,
  description,
  icon,
  badge,
  accentColor = "#6366f1",
}: WizardRadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-start gap-3 rounded-xl px-4 py-3.5 border text-left transition-all"
      style={{
        borderColor: selected ? accentColor : "#e5e7eb",
        background: selected ? `${accentColor}08` : "white",
      }}
    >
      <div
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
        style={{ borderColor: selected ? accentColor : "#d1d5db" }}
      >
        {selected && (
          <div
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{ background: accentColor }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {icon && <span className="text-neutral-400 flex-shrink-0">{icon}</span>}
          <span
            className="text-sm font-semibold"
            style={{ color: selected ? "#111827" : "#374151" }}
          >
            {label}
          </span>
          {badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-none"
              style={{ color: accentColor, background: `${accentColor}18` }}
            >
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">{description}</p>
        )}
      </div>
    </button>
  );
}

// ─── WizardRadioGroup ─────────────────────────────────────────────────────────

interface WizardRadioGroupOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
}

interface WizardRadioGroupProps {
  label?: string;
  hint?: string;
  options: WizardRadioGroupOption[];
  value: string;
  onChange: (value: string) => void;
  accentColor?: string;
  columns?: 1 | 2 | 3;
}

export function WizardRadioGroup({
  label,
  hint,
  options,
  value,
  onChange,
  accentColor = "#6366f1",
  columns = 1,
}: WizardRadioGroupProps) {
  const gridClass =
    columns === 3
      ? "grid grid-cols-3 gap-2"
      : columns === 2
      ? "grid grid-cols-2 gap-2"
      : "space-y-2";

  return (
    <div className="space-y-2">
      {(label || hint) && (
        <div className="flex items-center justify-between">
          {label && <p className="text-sm font-semibold text-neutral-700">{label}</p>}
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      )}
      <div className={gridClass}>
        {options.map((opt) => (
          <WizardRadioCard
            key={opt.value}
            selected={value === opt.value}
            onSelect={() => onChange(opt.value)}
            label={opt.label}
            description={opt.description}
            icon={opt.icon}
            badge={opt.badge}
            accentColor={accentColor}
          />
        ))}
      </div>
    </div>
  );
}
