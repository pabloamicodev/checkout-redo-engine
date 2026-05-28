"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { UpgradePlanModal } from "@/components/ui/UpgradePlanModal";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";
import { TrafficSlider } from "@/components/experiments/TrafficSlider";
import { WizardInput, WizardTextarea } from "@/components/experiments/WizardControls";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROSE = "#e11d48";
const ROSE_GRADIENT = "linear-gradient(135deg, #e11d48 0%, #be123c 100%)";

const STEP_LABELS = [
  "Setup",
  "Products",
  "Price Matrix",
  "Display",
  "Enforcement",
  "Risk Review",
  "Review",
] as const;

const STEP_TITLES = [
  "Define your price test",
  "Select products to test",
  "Build the price matrix",
  "Choose display surfaces",
  "Configure checkout enforcement",
  "Complete the risk review",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the test and write a clear hypothesis about the pricing change you expect to drive results.",
  "Add the Shopify product variants whose prices you want to test.",
  "Set control (current) and variant (test) prices. The delta is calculated automatically.",
  "Choose where on the storefront the test prices will be visible to enrolled visitors.",
  "Decide whether to show test prices only (safe) or enforce them at checkout (real revenue impact).",
  "High-risk acknowledgement required. Read each item and confirm before proceeding.",
  "Review the full configuration. Fix any blocking issues before creating the test.",
];

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Strategy = "DISPLAY_ONLY" | "SHOPIFY_FUNCTION";

const DISPLAY_SURFACES = [
  { key: "pdp",        label: "Product page (PDP)",  hint: "Show variant price on product pages" },
  { key: "collection", label: "Collection pages",     hint: "Show in collection grids" },
  { key: "cart",       label: "Cart",                 hint: "Show in cart line items" },
  { key: "checkout",   label: "Checkout",             hint: "Price shown at checkout (Shopify Function mode only)" },
] as const;

type SurfaceKey = (typeof DISPLAY_SURFACES)[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string; // internal row id
  productId: string;
  variantId: string;
}

interface PriceCell {
  price: string;
  compareAtPrice: string;
}

// price matrix: variantId → variantKey → PriceCell
type PriceMatrix = Record<string, Record<string, PriceCell>>;

interface TestVariant {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyProductRow(): ProductRow {
  return { id: uid(), productId: "", variantId: "" };
}

function emptyTestVariant(isControl: boolean, idx: number): TestVariant {
  return {
    key: isControl ? "control" : `variant_${String.fromCharCode(97 + idx - 1)}`,
    name: isControl ? "Control (current prices)" : `Variant ${String.fromCharCode(65 + idx - 1)}`,
    isControl,
    allocationPercent: 50,
  };
}

function priceDeltaPct(control: string, test: string): number | null {
  const c = parseFloat(control);
  const t = parseFloat(test);
  if (!c || isNaN(c) || isNaN(t) || c === 0) return null;
  return ((t - c) / c) * 100;
}

function formatDelta(delta: number | null): { label: string; color: string } | null {
  if (delta === null) return null;
  const sign = delta > 0 ? "+" : "";
  const label = `${sign}${delta.toFixed(1)}%`;
  // Rose for price increases (bad for consumer), green for decreases
  const color = delta > 0 ? ROSE : "#10b981";
  return { label, color };
}

// ─────────────────────────────────────────────────────────────────────────────
// Right-side Preview Panel
// ─────────────────────────────────────────────────────────────────────────────

interface SetupState {
  name: string;
  hypothesis: string;
  traffic: number;
}

interface ProductsState {
  bulkInput: string;
  rows: ProductRow[];
}

interface RiskChecks {
  pricesReviewed: boolean;
  realVisitors: boolean;
  discountsConsidered: boolean;
  rollbackPlan: boolean;
  functionDeployed: boolean;
}

function PriceTestPreviewPanel({
  step,
  setup,
  products,
  variants,
  matrix,
  surfaces,
  strategy,
  riskChecks,
}: {
  step: number;
  setup: SetupState;
  products: ProductsState;
  variants: TestVariant[];
  matrix: PriceMatrix;
  surfaces: Set<SurfaceKey>;
  strategy: Strategy;
  riskChecks: RiskChecks;
}) {
  const activeRows = products.rows.filter((r) => r.variantId.trim());
  const nonControl = variants.filter((v) => !v.isControl);
  const control = variants.find((v) => v.isControl);

  return (
    <div className="space-y-3">
      {/* Price comparison card (steps 2+) */}
      {step >= 2 && activeRows.length > 0 ? (
        <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-50 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <p className="text-xs font-semibold text-neutral-700">Price Comparison</p>
          </div>
          <div className="p-4 space-y-4">
            {activeRows.slice(0, 4).map((row) => {
              const ctrlKey = control?.key ?? "control";
              const ctrlPrice = matrix[row.variantId]?.[ctrlKey]?.price ?? "";
              return (
                <div key={row.id} className="space-y-1.5">
                  <p className="text-[9px] font-mono text-neutral-400 truncate max-w-full">
                    {row.variantId ? `…${row.variantId.slice(-12)}` : "Variant"}
                  </p>
                  {/* Control bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-neutral-400 w-12 shrink-0">Control</span>
                    <div className="flex-1 h-6 bg-neutral-100 rounded-md flex items-center px-2">
                      <span className="text-xs font-semibold text-neutral-500">
                        {ctrlPrice ? `$${parseFloat(ctrlPrice).toFixed(2)}` : "—"}
                      </span>
                    </div>
                  </div>
                  {/* Variant bars */}
                  {nonControl.map((v) => {
                    const cell = matrix[row.variantId]?.[v.key];
                    const delta = cell?.price && ctrlPrice ? priceDeltaPct(ctrlPrice, cell.price) : null;
                    const isUp = delta !== null && delta > 0;
                    const barColor = isUp ? "#fef2f2" : delta !== null ? "#f0fdf4" : "#f5f5f5";
                    const textColor = isUp ? ROSE : delta !== null ? "#059669" : "#a3a3a3";
                    return (
                      <div key={v.key} className="flex items-center gap-2">
                        <span className="text-[9px] text-neutral-400 w-12 shrink-0 truncate">{v.name}</span>
                        <div
                          className="flex-1 h-6 rounded-md flex items-center justify-between px-2"
                          style={{ background: barColor }}
                        >
                          <span className="text-xs font-semibold" style={{ color: textColor }}>
                            {cell?.price ? `$${parseFloat(cell.price).toFixed(2)}` : "—"}
                          </span>
                          {delta !== null && (
                            <span className="text-[9px] font-bold" style={{ color: textColor }}>
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {activeRows.length > 4 && (
              <p className="text-[10px] text-neutral-400 text-center">+{activeRows.length - 4} more variants</p>
            )}
          </div>
        </div>
      ) : (
        /* Empty state for steps 0-1 or no products */
        <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-50">
            <p className="text-xs font-semibold text-neutral-700">Price Preview</p>
          </div>
          <div className="p-4">
            {/* Simulated product card */}
            <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3 mb-3">
              <div className="h-20 bg-neutral-100 rounded-md mb-2 flex items-center justify-center">
                <span className="text-neutral-300 text-xs">Product image</span>
              </div>
              <p className="text-xs font-medium text-neutral-500 mb-1">Your product</p>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-neutral-400">$—</span>
                <span className="text-[10px] text-neutral-300">control price</span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-sm font-bold text-neutral-300">$—</span>
                <span className="text-[10px] text-neutral-300">variant price</span>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
              Add products in step 2 to see the price comparison
            </p>
          </div>
        </div>
      )}

      {/* Configuration summary */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-3">Configuration</p>
        <div className="space-y-2">
          {[
            { label: "Name", value: setup.name || "—" },
            { label: "Products", value: activeRows.length > 0 ? `${activeRows.length} variant${activeRows.length !== 1 ? "s" : ""}` : "—" },
            { label: "Strategy", value: strategy === "DISPLAY_ONLY" ? "Display only" : "Function" },
            { label: "Surfaces", value: surfaces.size > 0 ? `${surfaces.size} selected` : "—" },
            { label: "Traffic", value: `${setup.traffic}%` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">{label}</span>
              <span className="text-[10px] font-semibold text-neutral-700 max-w-[120px] truncate text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk review progress (step 5) */}
      {step === 5 && (
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
          <p className="text-xs font-semibold text-rose-800 mb-2">Risk Checklist</p>
          {[
            { key: "pricesReviewed", label: "Prices reviewed" },
            { key: "realVisitors", label: "Real visitors understood" },
            { key: "discountsConsidered", label: "Discounts considered" },
            { key: "rollbackPlan", label: "Rollback plan ready" },
            { key: "functionDeployed", label: "Function deployed" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 py-1">
              <span
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[8px]"
                style={{
                  background: riskChecks[key as keyof typeof riskChecks] ? "#10b981" : "#e5e7eb",
                  color: "#fff",
                }}
              >
                {riskChecks[key as keyof typeof riskChecks] ? "✓" : ""}
              </span>
              <span className="text-[10px] text-rose-700">{label}</span>
            </div>
          ))}
          {/* Progress bar */}
          {(() => {
            const done = Object.values(riskChecks).filter(Boolean).length;
            const total = Object.keys(riskChecks).length;
            return (
              <div className="mt-2 h-1.5 bg-rose-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Display surfaces visual (step 3) */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-3">Display Coverage</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "pdp", label: "Product page", icon: "🏷" },
              { key: "collection", label: "Collections", icon: "📋" },
              { key: "cart", label: "Cart", icon: "🛒" },
              { key: "checkout", label: "Checkout", icon: "💳" },
            ].map(({ key, label, icon }) => (
              <div
                key={key}
                className="rounded-lg p-2.5 text-center border transition-colors"
                style={{
                  background: surfaces.has(key as SurfaceKey) ? "#fef2f2" : "#f9fafb",
                  borderColor: surfaces.has(key as SurfaceKey) ? "#fca5a5" : "#e5e7eb",
                }}
              >
                <span className="text-base block mb-1">{icon}</span>
                <p className="text-[9px] font-medium" style={{ color: surfaces.has(key as SurfaceKey) ? ROSE : "#9ca3af" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Setup
// ─────────────────────────────────────────────────────────────────────────────

function StepSetup({
  state,
  onChange,
}: {
  state: SetupState;
  onChange: (p: Partial<SetupState>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Persistent high-risk banner */}
      <InlineAlert variant="danger" title="High-risk experiment type">
        Price tests modify product prices in your Shopify store. Use display-only mode to show
        different prices without changing real checkout prices, or Shopify Function mode to enforce
        prices at checkout.
      </InlineAlert>

      <FormSection
        title="Test identity"
        description="Give this test a clear name so your team understands what is being tested."
        accent={ROSE}
      >
        <div className="space-y-4">
          <WizardInput
            label="Test name"
            required
            value={state.name}
            onChange={(v) => onChange({ name: v })}
            placeholder="Premium Price Elasticity Test"
            maxLength={80}
            accentColor={ROSE}
            hint="Be specific — e.g. 'Premium Hoodie: $89 vs $99 vs $109'."
          />

          <WizardTextarea
            label="Hypothesis"
            value={state.hypothesis}
            onChange={(v) => onChange({ hypothesis: v })}
            placeholder="e.g. A 10% price increase on premium products will maintain CVR and improve profit margin"
            rows={3}
            maxLength={400}
            accentColor={ROSE}
            hint="Articulate what you expect to happen and why."
            templateText="If we [raise/lower] the price of [product] by [X%], then [revenue per visitor] will increase because customers are less price-sensitive than expected."
          />

          <TrafficSlider
            value={state.traffic}
            onChange={(v) => onChange({ traffic: v })}
            accentColor={ROSE}
            holdoutLabel="See default prices"
          />
        </div>
      </FormSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Products
// ─────────────────────────────────────────────────────────────────────────────

function StepProducts({
  state,
  onChange,
  hasMultiCurrency,
  currencies,
}: {
  state: ProductsState;
  onChange: (p: Partial<ProductsState>) => void;
  hasMultiCurrency?: boolean;
  currencies?: string[];
}) {
  function addRow() {
    onChange({ rows: [...state.rows, emptyProductRow()] });
  }

  function removeRow(id: string) {
    onChange({ rows: state.rows.filter((r) => r.id !== id) });
  }

  function updateRow(id: string, patch: Partial<ProductRow>) {
    onChange({ rows: state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }

  return (
    <div className="space-y-6">
      <InlineAlert variant="info">
        Where to find variant IDs: Products → select product → click variant → see ID in the URL
        bar.
      </InlineAlert>

      {/* Multi-currency warning */}
      {hasMultiCurrency && currencies && (
        <InlineAlert variant="warning" title="Multi-currency store detected">
          Your store has {currencies.length} active currencies (
          {currencies.join(", ")}). Price tests set prices in your store&apos;s primary currency
          only. Visitors using other currencies will see Shopify&apos;s auto-converted price, not
          your test price exactly. Verify the experience in each currency before launching.
        </InlineAlert>
      )}

      {/* Subscription product warning */}
      <InlineAlert variant="warning" title="Subscription products">
        If any of the variants you add are part of a subscription selling plan, price overrides
        will <strong>not</strong> apply to subscription orders — Shopify enforces the selling
        plan price at checkout regardless of the Shopify Function. Test only non-subscription
        variants, or validate your Function behaviour with subscription orders before launching.
      </InlineAlert>

      <FormSection
        title="Bulk import"
        description="Paste comma-separated variant IDs to import multiple variants at once."
        accent={ROSE}
      >
        <FormField
          label="Shopify Variant IDs"
          hint="Enter the Shopify variant IDs to test. Format: 12345,67890,11111"
        >
          <input
            className="input-base"
            value={state.bulkInput}
            onChange={(e) => onChange({ bulkInput: e.target.value })}
            placeholder="12345,67890,11111"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Product / variant pairs"
        description="Specify which products and variants to include in this test."
        accent={ROSE}
      >
        <div className="space-y-3">
          {state.rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-neutral-100 p-3.5 bg-neutral-50/50 hover:bg-white transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-400">
                    {state.rows.indexOf(row) + 1}
                  </div>
                  <span className="text-xs font-medium text-neutral-600">Variant {state.rows.indexOf(row) + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition-all rounded"
                  aria-label="Remove row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Product ID</label>
                  <input
                    className="input-base text-xs"
                    value={row.productId}
                    onChange={(e) => updateRow(row.id, { productId: e.target.value })}
                    placeholder="gid://shopify/Product/…"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Variant ID</label>
                  <input
                    className="input-base text-xs"
                    value={row.variantId}
                    onChange={(e) => updateRow(row.id, { variantId: e.target.value })}
                    placeholder="gid://shopify/ProductVariant/…"
                  />
                </div>
              </div>
            </div>
          ))}

          {state.rows.length === 0 && (
            <InlineAlert variant="danger">
              No products added yet. Add at least one product/variant pair to continue.
            </InlineAlert>
          )}

          <button
            type="button"
            onClick={addRow}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 text-neutral-500 hover:border-rose-300 hover:text-rose-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add product
          </button>
        </div>
      </FormSection>

      {/* Preview table */}
      {state.rows.some((r) => r.variantId.trim()) && (
        <FormSection title="Added variants preview" accent={ROSE}>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-3 py-2 text-left font-semibold text-neutral-500">Product ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-neutral-500">Variant ID</th>
                </tr>
              </thead>
              <tbody>
                {state.rows
                  .filter((r) => r.variantId.trim() || r.productId.trim())
                  .map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-3 py-2 text-neutral-600 font-mono">
                        {r.productId || <span className="text-neutral-300 italic">—</span>}
                      </td>
                      <td className="px-3 py-2 text-neutral-600 font-mono">
                        {r.variantId || <span className="text-neutral-300 italic">—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </FormSection>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Price Matrix
// ─────────────────────────────────────────────────────────────────────────────

function StepPriceMatrix({
  rows,
  variants,
  matrix,
  onMatrixChange,
}: {
  rows: ProductRow[];
  variants: TestVariant[];
  matrix: PriceMatrix;
  onMatrixChange: (next: PriceMatrix) => void;
}) {
  const activeRows = rows.filter((r) => r.variantId.trim());
  const nonControlVariants = variants.filter((v) => !v.isControl);
  const controlVariant = variants.find((v) => v.isControl);

  function getCell(variantId: string, variantKey: string): PriceCell {
    return matrix[variantId]?.[variantKey] ?? { price: "", compareAtPrice: "" };
  }

  function setCell(variantId: string, variantKey: string, patch: Partial<PriceCell>) {
    const next: PriceMatrix = {
      ...matrix,
      [variantId]: {
        ...(matrix[variantId] ?? {}),
        [variantKey]: { ...getCell(variantId, variantKey), ...patch },
      },
    };
    onMatrixChange(next);
  }

  // Guards
  const hasZeroOrNegative = activeRows.some((r) =>
    nonControlVariants.some((v) => {
      const p = parseFloat(getCell(r.variantId, v.key).price);
      return !isNaN(p) && p <= 0;
    })
  );

  const hasLargeDelta = activeRows.some((r) =>
    nonControlVariants.some((v) => {
      const controlPrice = getCell(r.variantId, controlVariant?.key ?? "control").price;
      const testPrice = getCell(r.variantId, v.key).price;
      const delta = priceDeltaPct(controlPrice, testPrice);
      return delta !== null && Math.abs(delta) > 50;
    })
  );

  if (activeRows.length === 0) {
    return (
      <InlineAlert variant="warning">
        No products added yet. Go back to Step 2 and add at least one product/variant pair.
      </InlineAlert>
    );
  }

  return (
    <div className="space-y-6">
      {hasZeroOrNegative && (
        <InlineAlert variant="danger" title="Invalid price detected">
          One or more test prices are zero or negative. All prices must be greater than $0.00.
        </InlineAlert>
      )}
      {hasLargeDelta && (
        <InlineAlert variant="warning" title="Unusually large price change">
          This price change is unusually large — verify this is intentional.
        </InlineAlert>
      )}
      <InlineAlert variant="warning">
        Multi-currency stores: prices will be shown in the variant's base currency. Other currencies
        may convert differently.
      </InlineAlert>
      <InlineAlert variant="warning">
        Subscription products: if any variant has active subscriptions, changing prices may affect
        subscription renewals.
      </InlineAlert>

      <FormSection
        title="Price matrix"
        description="Set control (current) and test prices for each variant. Control prices are your existing Shopify prices."
        accent={ROSE}
      >
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-500 w-40">
                  Variant ID
                </th>
                {controlVariant && (
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-400 bg-neutral-100 w-36">
                    Control (current)
                  </th>
                )}
                {nonControlVariants.map((v) => (
                  <th
                    key={v.key}
                    className="px-3 py-2.5 text-left font-semibold w-36"
                    style={{ color: ROSE }}
                  >
                    {v.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => {
                const controlKey = controlVariant?.key ?? "control";
                const controlPrice = getCell(row.variantId, controlKey).price;
                return (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-neutral-500">
                      {row.variantId.length > 20
                        ? `…${row.variantId.slice(-16)}`
                        : row.variantId || (
                            <span className="text-neutral-300 italic">—</span>
                          )}
                    </td>
                    {/* Control column — editable, greyed */}
                    {controlVariant && (
                      <td className="px-3 py-2 bg-neutral-50">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-400 text-[10px]">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              className="input-base text-xs w-24 bg-neutral-100 text-neutral-500"
                              value={getCell(row.variantId, controlKey).price}
                              onChange={(e) =>
                                setCell(row.variantId, controlKey, { price: e.target.value })
                              }
                              placeholder="49.99"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-300 text-[10px]">compare</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="input-base text-[10px] w-24 bg-neutral-100 text-neutral-400"
                              value={getCell(row.variantId, controlKey).compareAtPrice}
                              onChange={(e) =>
                                setCell(row.variantId, controlKey, {
                                  compareAtPrice: e.target.value,
                                })
                              }
                              placeholder="optional"
                            />
                          </div>
                        </div>
                      </td>
                    )}
                    {/* Test variant columns */}
                    {nonControlVariants.map((v) => {
                      const cell = getCell(row.variantId, v.key);
                      const delta = priceDeltaPct(controlPrice, cell.price);
                      const formatted = formatDelta(delta);
                      const cellPriceNum = parseFloat(cell.price);
                      const isZeroPrice = !isNaN(cellPriceNum) && cellPriceNum <= 0;
                      const isLargeDelta = delta !== null && Math.abs(delta) > 50;
                      return (
                        <td key={v.key} className="px-3 py-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-neutral-400 text-[10px]">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className={`input-base text-xs w-24${isZeroPrice ? " border-red-400" : ""}`}
                                value={cell.price}
                                onChange={(e) =>
                                  setCell(row.variantId, v.key, { price: e.target.value })
                                }
                                placeholder="54.99"
                              />
                            </div>
                            {isZeroPrice && (
                              <p className="text-xs text-red-500 mt-1">Price cannot be $0</p>
                            )}
                            {isLargeDelta && !isZeroPrice && (
                              <p className="text-xs text-amber-600 mt-1">&#9888; This price differs by more than 50% from the control — are you sure?</p>
                            )}
                            {/* Delta bar */}
                            {formatted && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(Math.abs(delta ?? 0) * 2, 100)}%`,
                                      background: (delta ?? 0) > 0 ? ROSE : "#10b981",
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-semibold shrink-0" style={{ color: formatted.color }}>
                                  {formatted.label}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-neutral-300 text-[10px]">compare</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input-base text-[10px] w-24"
                                value={cell.compareAtPrice}
                                onChange={(e) =>
                                  setCell(row.variantId, v.key, {
                                    compareAtPrice: e.target.value,
                                  })
                                }
                                placeholder="optional"
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">
          Control prices are your current Shopify prices (editable to reflect current state). Test
          variant prices are what enrolled visitors will see.
        </p>
      </FormSection>

      <FormSection title="Traffic allocation" description="How visitors are split across variants." accent={ROSE}>
        <VariantAllocationEditor
          variants={variants.map((v) => ({
            key: v.key,
            name: v.name,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
          }))}
          onChange={() => {
            /* handled at wizard level */
          }}
          accentHex={ROSE}
        />
      </FormSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Display Surfaces
// ─────────────────────────────────────────────────────────────────────────────

function StepDisplay({
  surfaces,
  onChange,
}: {
  surfaces: Set<SurfaceKey>;
  onChange: (next: Set<SurfaceKey>) => void;
}) {
  function toggle(key: SurfaceKey) {
    const next = new Set(surfaces);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  }

  return (
    <div className="space-y-6">
      <FormSection
        title="Where to show the test price"
        description="Select every storefront surface where the test price should be rendered."
        accent={ROSE}
      >
        <div className="space-y-2">
          {DISPLAY_SURFACES.map((s) => {
            const checked = surfaces.has(s.key);
            return (
              <label
                key={s.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? "border-rose-300 bg-rose-50"
                    : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.key)}
                  className="mt-0.5 accent-rose-600"
                />
                <div>
                  <p className={`text-sm font-semibold ${checked ? "text-rose-800" : "text-neutral-800"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{s.hint}</p>
                </div>
              </label>
            );
          })}
        </div>

        {surfaces.size === 0 && (
          <InlineAlert variant="danger" className="mt-3">
            At least one display surface must be selected.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Enforcement
// ─────────────────────────────────────────────────────────────────────────────

function StepEnforcement({
  strategy,
  functionConfirmed,
  onChange,
}: {
  strategy: Strategy;
  functionConfirmed: boolean;
  onChange: (strategy: Strategy, functionConfirmed: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection
        title="Enforcement strategy"
        description="Choose how the test price is applied to visitors in the experiment."
        accent={ROSE}
      >
        <div className="space-y-3">
          {(
            [
              {
                value: "DISPLAY_ONLY" as const,
                label: "Display only",
                description:
                  "Show different prices on the storefront but checkout uses the real Shopify price. Safe to test — no real price impact.",
              },
              {
                value: "SHOPIFY_FUNCTION" as const,
                label: "Shopify Function",
                description:
                  "Enforce variant prices at checkout. Requires the marginlab-product-discount Shopify Function to be deployed.",
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                strategy === opt.value
                  ? "border-rose-300 bg-rose-50"
                  : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <input
                type="radio"
                name="enforcement"
                value={opt.value}
                checked={strategy === opt.value}
                onChange={() => onChange(opt.value, functionConfirmed)}
                className="mt-0.5 accent-rose-600"
              />
              <div>
                <p className={`text-sm font-semibold ${strategy === opt.value ? "text-rose-800" : "text-neutral-900"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </FormSection>

      {/* How it works flow diagram */}
      <div className="mt-4 rounded-xl border border-neutral-100 p-4 bg-neutral-50">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-3">How it works</p>
        <div className="flex items-center gap-2 text-[10px] text-neutral-600">
          <div className="px-2 py-1.5 rounded-lg bg-white border border-neutral-200 text-center">
            <p className="font-semibold">Visitor</p>
            <p className="text-neutral-400">arrives</p>
          </div>
          <span className="text-neutral-300">→</span>
          <div className="px-2 py-1.5 rounded-lg bg-white border border-neutral-200 text-center">
            <p className="font-semibold">Assigned</p>
            <p className="text-neutral-400">to group</p>
          </div>
          <span className="text-neutral-300">→</span>
          <div
            className="px-2 py-1.5 rounded-lg text-center border"
            style={{
              background: strategy === "DISPLAY_ONLY" ? "#fff7ed" : "#fef2f2",
              borderColor: strategy === "DISPLAY_ONLY" ? "#fed7aa" : "#fca5a5",
            }}
          >
            <p className="font-semibold">{strategy === "DISPLAY_ONLY" ? "Sees price" : "Pays price"}</p>
            <p style={{ color: strategy === "DISPLAY_ONLY" ? "#c2410c" : ROSE }}>
              {strategy === "DISPLAY_ONLY" ? "display only" : "real checkout"}
            </p>
          </div>
        </div>
      </div>

      {strategy === "DISPLAY_ONLY" && (
        <InlineAlert variant="info">
          Visitors see the test price, but if they checkout, the real Shopify price is charged. Use
          this mode to measure intent without affecting revenue.
        </InlineAlert>
      )}

      {strategy === "SHOPIFY_FUNCTION" && (
        <div className="space-y-3">
          <InlineAlert variant="warning" title="Function enforcement changes real checkout prices">
            Shopify Function enforcement changes the actual checkout price. Requires
            marginlab-product-discount to be deployed and active. Only use if you intend to charge
            the test price.
          </InlineAlert>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
            <input
              type="checkbox"
              checked={functionConfirmed}
              onChange={(e) => onChange(strategy, e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                I confirm that marginlab-product-discount is deployed and active
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                You must confirm this before you can continue.
              </p>
            </div>
          </label>

          {!functionConfirmed && (
            <InlineAlert variant="danger">
              You must confirm the Shopify Function is deployed before continuing with this
              enforcement mode.
            </InlineAlert>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 — Risk Review
// ─────────────────────────────────────────────────────────────────────────────

function StepRiskReview({
  productCount,
  priceRange,
  strategy,
  checks,
  onChange,
}: {
  productCount: number;
  priceRange: { min: string; max: string } | null;
  strategy: Strategy;
  checks: RiskChecks;
  onChange: (next: RiskChecks) => void;
}) {
  const isFunction = strategy === "SHOPIFY_FUNCTION";

  const allRequiredChecked =
    checks.pricesReviewed &&
    checks.realVisitors &&
    checks.discountsConsidered &&
    checks.rollbackPlan &&
    (!isFunction || checks.functionDeployed);

  const checkItems: Array<{
    key: keyof RiskChecks;
    label: string;
    required: boolean;
  }> = [
    { key: "pricesReviewed",       label: "I have reviewed all test prices and they are correct",        required: true },
    { key: "realVisitors",         label: "I understand this test affects real visitors on my store",     required: true },
    { key: "discountsConsidered",  label: "I have considered the impact on active discounts/promotions", required: true },
    { key: "rollbackPlan",         label: "I have a rollback plan if results are unexpected",             required: true },
    { key: "functionDeployed",     label: "The marginlab-product-discount function is deployed and active", required: isFunction },
  ];

  return (
    <div className="space-y-6">
      {/* Risk summary card */}
      <div
        className="rounded-xl border-2 p-5 space-y-3"
        style={{ borderColor: ROSE, background: "#fff5f7" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-bold text-rose-900 text-sm">Price Test Risk Review</p>
            <p className="text-xs text-rose-700">Review all risks before proceeding.</p>
          </div>
        </div>
        <div className="h-px bg-rose-200" />
        <p className="text-xs font-semibold text-rose-800 uppercase tracking-wide">
          This test will:
        </p>
        <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside">
          <li>
            Affect{" "}
            <span className="font-semibold">
              {productCount} product variant{productCount !== 1 ? "s" : ""}
            </span>
          </li>
          {priceRange && (
            <li>
              Test prices ranging from{" "}
              <span className="font-semibold">
                ${priceRange.min} to ${priceRange.max}
              </span>
            </li>
          )}
          <li>
            Run in{" "}
            <span className="font-semibold">
              {strategy === "DISPLAY_ONLY" ? "display-only" : "Shopify Function enforcement"} mode
            </span>
          </li>
        </ul>
      </div>

      <FormSection
        title="Risk acknowledgement checklist"
        description="All items must be checked before you can proceed to the final review."
        accent={ROSE}
      >
        <div className="space-y-2">
          {checkItems
            .filter((item) => item.required)
            .map((item) => (
              <label
                key={item.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  checks[item.key]
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checks[item.key]}
                  onChange={(e) => onChange({ ...checks, [item.key]: e.target.checked })}
                  className="mt-0.5 accent-emerald-600"
                />
                <p
                  className={`text-sm ${
                    checks[item.key] ? "text-emerald-800 font-medium" : "text-neutral-700"
                  }`}
                >
                  {item.label}
                </p>
              </label>
            ))}
        </div>

        {!allRequiredChecked && (
          <InlineAlert variant="warning" className="mt-3">
            All checklist items must be acknowledged before you can proceed.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7 — Review
// ─────────────────────────────────────────────────────────────────────────────

function StepReview({
  name,
  hypothesis,
  traffic,
  rows,
  variants,
  matrix,
  strategy,
  surfaces,
  riskChecks,
  allocationVariants,
  onAllocationChange,
  saving,
  error,
  onSubmit,
}: {
  name: string;
  hypothesis: string;
  traffic: number;
  rows: ProductRow[];
  variants: TestVariant[];
  matrix: PriceMatrix;
  strategy: Strategy;
  surfaces: Set<SurfaceKey>;
  riskChecks: RiskChecks;
  allocationVariants: AllocationVariant[];
  onAllocationChange: (v: AllocationVariant[]) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const activeRows = rows.filter((r) => r.variantId.trim());
  const nonControl = variants.filter((v) => !v.isControl);
  const allocationSum = allocationVariants.reduce((s, v) => s + v.allocationPercent, 0);

  const isFunction = strategy === "SHOPIFY_FUNCTION";
  const isRiskComplete =
    riskChecks.pricesReviewed &&
    riskChecks.realVisitors &&
    riskChecks.discountsConsidered &&
    riskChecks.rollbackPlan &&
    (!isFunction || riskChecks.functionDeployed);

  const hasZeroPrice = activeRows.some((r) =>
    nonControl.some((v) => {
      const p = parseFloat(matrix[r.variantId]?.[v.key]?.price ?? "");
      return !isNaN(p) && p <= 0;
    })
  );

  const maxDelta = useMemo(() => {
    let max = 0;
    for (const r of activeRows) {
      const ctrlPrice = matrix[r.variantId]?.["control"]?.price ?? "";
      for (const v of nonControl) {
        const d = priceDeltaPct(ctrlPrice, matrix[r.variantId]?.[v.key]?.price ?? "");
        if (d !== null) max = Math.max(max, Math.abs(d));
      }
    }
    return max;
  }, [activeRows, nonControl, matrix]);

  const checks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Test name provided",
      status: name.trim() ? "pass" : "block",
      detail: name.trim() ? name : "A test name is required.",
    },
    {
      id: "products",
      label: "At least one product variant added",
      status: activeRows.length > 0 ? "pass" : "block",
      detail:
        activeRows.length > 0
          ? `${activeRows.length} variant(s) configured`
          : "Add products in Step 2.",
    },
    {
      id: "prices",
      label: "No zero or negative prices",
      status: hasZeroPrice ? "block" : "pass",
      detail: hasZeroPrice ? "Fix invalid prices in Step 3." : "All test prices are positive.",
    },
    {
      id: "risk",
      label: "Risk review completed",
      status: isRiskComplete ? "pass" : "block",
      detail: isRiskComplete ? "All risk items acknowledged." : "Complete the Risk Review (Step 6).",
    },
    {
      id: "allocation",
      label: "Traffic allocation sums to 100%",
      status: Math.abs(allocationSum - 100) < 0.1 ? "pass" : "block",
      detail: `Currently ${allocationSum.toFixed(1)}%.`,
    },
    {
      id: "display_only_warn",
      label: "Display-only mode — prices won't affect checkout",
      status: strategy === "DISPLAY_ONLY" ? "warn" : "info",
      detail:
        strategy === "DISPLAY_ONLY"
          ? "Visitors see test prices but are charged real Shopify prices. Intentional?"
          : "Shopify Function mode — real checkout prices will be affected.",
    },
    ...(maxDelta > 30
      ? [
          {
            id: "large_delta",
            label: `Large price delta detected (${maxDelta.toFixed(1)}%)`,
            status: "warn" as const,
            detail: "Verify this change is intentional before launching.",
          },
        ]
      : []),
    {
      id: "discount_stacking",
      label: "Discount stacking not explicitly verified",
      status: "warn" as const,
      detail: "Ensure active discounts/promotions don't interact unexpectedly with test prices.",
    },
  ];

  const canSubmit = checks.filter((c) => c.status === "block").length === 0;

  return (
    <div className="space-y-6">
      <LaunchReadinessPanel checks={checks} accentHex={ROSE} />

      {/* Summary table */}
      <FormSection title="Test summary" accent={ROSE}>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-neutral-100">
              {[
                ["Name", name || <span className="text-neutral-300 italic">—</span>],
                ["Hypothesis", hypothesis || <span className="text-neutral-300 italic">—</span>],
                ["Traffic", `${traffic}% of visitors`],
                ["Products", `${activeRows.length} variant(s)`],
                [
                  "Strategy",
                  strategy === "DISPLAY_ONLY" ? "Display only" : "Shopify Function",
                ],
                [
                  "Display surfaces",
                  surfaces.size > 0
                    ? Array.from(surfaces).join(", ")
                    : <span className="text-neutral-300 italic">none</span>,
                ],
              ].map(([label, value], i) => (
                <tr key={i} className="bg-white">
                  <td className="px-4 py-2.5 text-neutral-500 font-medium w-36 shrink-0 text-xs">
                    {label}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-900 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>

      {/* Variants summary */}
      <FormSection title="Variants & allocation" accent={ROSE}>
        <VariantAllocationEditor
          variants={allocationVariants}
          onChange={onAllocationChange}
          accentHex={ROSE}
          compact
        />
      </FormSection>

      {error && (
        <InlineAlert variant="danger" title="Creation failed">
          {error}
        </InlineAlert>
      )}

      {/* Create button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canSubmit ? ROSE_GRADIENT : undefined }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create Price Test"
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard shell
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_VARIANTS: TestVariant[] = [
  emptyTestVariant(true, 0),
  emptyTestVariant(false, 1),
];

interface ShopInfo {
  currency: string | null;
  currencies: string[];
  hasMultiCurrency: boolean;
  moneyFormat: string | null;
}

export function PriceTestWizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<StepIndex>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Shop info (fetched once on mount)
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);

  useEffect(() => {
    void fetch("/api/shopify/shop-info")
      .then((r) => r.json() as Promise<ShopInfo>)
      .then(setShopInfo)
      .catch(() => {/* soft-fail: no shop info available */});
  }, []);

  // Step 1 — Setup
  const [setup, setSetup] = useState<SetupState>({
    name: "",
    hypothesis: "",
    traffic: 100,
  });

  // Step 2 — Products
  const [products, setProducts] = useState<ProductsState>({
    bulkInput: "",
    rows: [emptyProductRow()],
  });

  // Test variants (shared across steps 3 + 7)
  const [variants, setVariants] = useState<TestVariant[]>(DEFAULT_VARIANTS);

  // Step 3 — Price matrix
  const [matrix, setMatrix] = useState<PriceMatrix>({});

  // Step 4 — Display surfaces
  const [surfaces, setSurfaces] = useState<Set<SurfaceKey>>(
    new Set<SurfaceKey>(["pdp", "collection", "cart", "checkout"])
  );

  // Step 5 — Enforcement
  const [strategy, setStrategy] = useState<Strategy>("DISPLAY_ONLY");
  const [functionConfirmed, setFunctionConfirmed] = useState(false);

  // Step 6 — Risk checks
  const [riskChecks, setRiskChecks] = useState<RiskChecks>({
    pricesReviewed: false,
    realVisitors: false,
    discountsConsidered: false,
    rollbackPlan: false,
    functionDeployed: false,
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeRows = products.rows.filter((r) => r.variantId.trim());
  const allocationVariants: AllocationVariant[] = variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocationPercent,
  }));
  const allocationSum = variants.reduce((s, v) => s + v.allocationPercent, 0);
  const nonControl = variants.filter((v) => !v.isControl);

  const priceRange = useMemo((): { min: string; max: string } | null => {
    const prices: number[] = [];
    for (const r of activeRows) {
      for (const v of nonControl) {
        const p = parseFloat(matrix[r.variantId]?.[v.key]?.price ?? "");
        if (!isNaN(p) && p > 0) prices.push(p);
      }
    }
    if (prices.length === 0) return null;
    return {
      min: Math.min(...prices).toFixed(2),
      max: Math.max(...prices).toFixed(2),
    };
  }, [activeRows, nonControl, matrix]);

  // ── Per-step validation ────────────────────────────────────────────────────

  function canContinue(): boolean {
    if (step === 0) return setup.name.trim().length > 0;
    if (step === 1) return activeRows.length > 0;
    if (step === 2) {
      // no zero prices in non-control variants
      const hasZero = activeRows.some((r) =>
        nonControl.some((v) => {
          const p = parseFloat(matrix[r.variantId]?.[v.key]?.price ?? "");
          return !isNaN(p) && p <= 0;
        })
      );
      return !hasZero && Math.abs(allocationSum - 100) < 0.1;
    }
    if (step === 3) return surfaces.size > 0;
    if (step === 4)
      return strategy === "DISPLAY_ONLY" || (strategy === "SHOPIFY_FUNCTION" && functionConfirmed);
    if (step === 5) {
      const isFunc = strategy === "SHOPIFY_FUNCTION";
      return (
        riskChecks.pricesReviewed &&
        riskChecks.realVisitors &&
        riskChecks.discountsConsidered &&
        riskChecks.rollbackPlan &&
        (!isFunc || riskChecks.functionDeployed)
      );
    }
    return true;
  }

  // ── Step blocker label for StickyFormActions ────────────────────────────────

  function blockingIssue(): string | undefined {
    if (step === 0 && !setup.name.trim()) return "Test name required";
    if (step === 1 && activeRows.length === 0) return "Add at least one product variant";
    if (step === 3 && surfaces.size === 0) return "Select at least one display surface";
    if (step === 4 && strategy === "SHOPIFY_FUNCTION" && !functionConfirmed)
      return "Confirm function deployment";
    if (step === 5 && !canContinue()) return "Complete all risk checklist items";
    return undefined;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: setup.name.trim(),
        hypothesis: setup.hypothesis.trim() || undefined,
        trafficAllocation: setup.traffic,
        enforcementStrategy: strategy,
        variants: variants.map((v) => ({
          key: v.key.trim(),
          name: v.name.trim(),
          isControl: v.isControl,
          allocationPercent: v.allocationPercent,
          priceOverrides: v.isControl
            ? []
            : activeRows.map((r) => {
                const cell = matrix[r.variantId]?.[v.key] ?? { price: "", compareAtPrice: "" };
                return {
                  shopifyVariantId: r.variantId.trim(),
                  shopifyProductId: r.productId.trim(),
                  price: cell.price.trim(),
                  compareAtPrice: cell.compareAtPrice.trim() || null,
                };
              }),
        })),
      };
      const res = await fetch("/api/price-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (res.status === 402) { setShowUpgradeModal(true); setSaving(false); return; }
      if (!res.ok) throw new Error(data.error ?? "Failed to create price test");
      toast.success(`Price test "${setup.name.trim()}" created — activate it from the test detail page.`);
      router.push("/price-tests");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create test. Check your connection and try again.";
      toast.error(msg);
      setError(msg);
      setSaving(false);
    }
  }, [setup, activeRows, variants, matrix, strategy, router, toast]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goBack = useCallback(function goBack() {
    if (step === 0) {
      router.back();
    } else {
      setStep((prev) => (prev - 1) as StepIndex);
    }
  }, [step, router]);

  const goNext = useCallback(function goNext() {
    if (step < 6) {
      setStep((prev) => (prev + 1) as StepIndex);
    } else {
      handleSubmit();
    }
  }, [step, handleSubmit]);

  // ── Wizard steps config ────────────────────────────────────────────────────

  const wizardSteps: WizardStep[] = STEP_LABELS.map((label, i) => ({
    label,
    status:
      i < step
        ? "complete"
        : i === step
        ? "active"
        : "pending",
  }));

  // ── Per-step continue labels ───────────────────────────────────────────────

  const CONTINUE_LABELS: Record<number, string> = {
    0: "Configure prices →",
    1: "Build price matrix →",
    2: "Choose display →",
    3: "Choose strategy →",
    4: "Review risk →",
    5: "Review →",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <UpgradePlanModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} limitType="running experiments" />
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="w-52 xl:w-60 shrink-0 border-r border-neutral-100 bg-white flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-50">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: "#e11d4815" }}
          >
            <span className="text-base" style={{ color: "#e11d48" }}>◎</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Price Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test product prices with margin-aware controls and rollback protection.
          </p>
        </div>

        {/* Vertical step nav */}
        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={wizardSteps}
            currentStep={step}
            accentHex={ROSE}
            onStepClick={(i) => {
              if (i < step) setStep(i as StepIndex);
            }}
          />
        </div>

        {/* Warning footer */}
        <div className="p-3 border-t border-neutral-50">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-50 border border-rose-100">
            <span className="text-rose-400 text-xs">⚠</span>
            <p className="text-[9px] text-rose-600 font-medium leading-tight">High-risk test type</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header — unique per step */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: ROSE }}>
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Two-column content */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6 max-w-6xl">
            {/* Form — LEFT */}
            <div className="flex-1 min-w-0 space-y-5">
              {step === 0 && (
                <StepSetup
                  state={setup}
                  onChange={(p) => setSetup((prev) => ({ ...prev, ...p }))}
                />
              )}

              {step === 1 && (
                <StepProducts
                  state={products}
                  onChange={(p) => setProducts((prev) => ({ ...prev, ...p }))}
                  hasMultiCurrency={shopInfo?.hasMultiCurrency}
                  currencies={shopInfo?.currencies}
                />
              )}

              {step === 2 && (
                <StepPriceMatrix
                  rows={products.rows}
                  variants={variants}
                  matrix={matrix}
                  onMatrixChange={(next) => setMatrix(next)}
                />
              )}

              {step === 3 && (
                <StepDisplay
                  surfaces={surfaces}
                  onChange={setSurfaces}
                />
              )}

              {step === 4 && (
                <StepEnforcement
                  strategy={strategy}
                  functionConfirmed={functionConfirmed}
                  onChange={(s, fc) => {
                    setStrategy(s);
                    setFunctionConfirmed(fc);
                  }}
                />
              )}

              {step === 5 && (
                <StepRiskReview
                  productCount={activeRows.length}
                  priceRange={priceRange}
                  strategy={strategy}
                  checks={riskChecks}
                  onChange={setRiskChecks}
                />
              )}

              {step === 6 && (
                <StepReview
                  name={setup.name}
                  hypothesis={setup.hypothesis}
                  traffic={setup.traffic}
                  rows={products.rows}
                  variants={variants}
                  matrix={matrix}
                  strategy={strategy}
                  surfaces={surfaces}
                  riskChecks={riskChecks}
                  allocationVariants={allocationVariants}
                  onAllocationChange={(updated) =>
                    setVariants((prev) =>
                      prev.map((v) => {
                        const u = updated.find((a) => a.key === v.key);
                        return u ? { ...v, allocationPercent: u.allocationPercent } : v;
                      })
                    )
                  }
                  saving={saving}
                  error={error}
                  onSubmit={handleSubmit}
                />
              )}
            </div>

            {/* Preview — RIGHT, sticky */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6 space-y-3">
              <PriceTestPreviewPanel
                step={step}
                setup={setup}
                products={products}
                variants={variants}
                matrix={matrix}
                surfaces={surfaces}
                strategy={strategy}
                riskChecks={riskChecks}
              />
            </aside>
          </div>
        </div>

        {/* Sticky actions */}
        <StickyFormActions
          step={step}
          totalSteps={STEP_LABELS.length}
          onBack={goBack}
          onNext={goNext}
          canContinue={canContinue()}
          isLastStep={step === 6}
          isSubmitting={saving}
          submitLabel="Create Price Test"
          continueLabel={CONTINUE_LABELS[step]}
          accentHex={ROSE}
          blockingIssue={blockingIssue()}
        />
      </div>
    </div>
    </>
  );
}
