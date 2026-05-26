/**
 * Tests for marginlab-runtime.js
 *
 * Pure logic (hash, assignment, targeting) is inlined here so the functions
 * can be called directly without fighting the IIFE module boundary.
 *
 * DOM behaviour (price overrides, variant change) is tested by eval-ing
 * the IIFE in jsdom with a mocked fetch that returns a controlled config.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUNTIME_SRC = readFileSync(
  join(__dirname, "../assets/marginlab-runtime.js"),
  "utf8"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupShopifyGlobals() {
  window.Shopify = { shop: "test.myshopify.com", currency: { active: "USD" }, country: "US" };
  window.marginlabConfig = { apiBase: "http://localhost" };
}

function mockFetch(config = {}) {
  const defaultConfig = {
    shopDomain: "test.myshopify.com",
    experiments: [],
    personalizations: [],
    offers: [],
    checkoutBlocks: [],
    settings: { antiFlickerEnabled: false, antiFlickerTimeout: 300, debugModeEnabled: false },
    killSwitches: { globalDisabled: false },
    updatedAt: new Date().toISOString(),
  };
  const response = { ...defaultConfig, ...config };

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
    clone: () => ({ json: () => Promise.resolve({}) }),
  });
}

// Eval the IIFE in the current jsdom window scope.
// Returns a promise that resolves when window.MarginLab.onReady fires.
function loadRuntime() {
  delete window.MarginLab;
  // Indirect eval so the IIFE runs in global (window) scope, not module scope
  // eslint-disable-next-line no-eval
  (0, eval)(RUNTIME_SRC);

  return new Promise((resolve) => {
    // onReady fires synchronously if already initialized; otherwise queues
    if (window.MarginLab) {
      window.MarginLab.onReady(resolve);
    } else {
      // MarginLab not yet defined — init hasn't run; call resolve after tick
      setTimeout(resolve, 0);
    }
  });
}

// Build a product page DOM with a price element and an add-to-cart form.
function buildProductPage(variantNumericId = "111", price = "$30.00") {
  document.body.innerHTML = `
    <form action="/cart/add">
      <input type="hidden" name="id" value="${variantNumericId}" />
    </form>
    <div class="price">
      <span class="price-item--regular">${price}</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ─── Pure function mirrors (identical to runtime internals) ──────────────────
// ---------------------------------------------------------------------------

function hashToBucket(input) {
  var hash = 5381;
  for (var i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 10000;
}

function assignVariant(visitorId, experimentId, trafficAllocation, variants) {
  if (!variants || !variants.length) return null;
  var trafficBucket = hashToBucket(experimentId + ":traffic:" + visitorId);
  var trafficThreshold = Math.floor((trafficAllocation / 100) * 10000);
  if (trafficBucket >= trafficThreshold) return null;
  var variantBucket = hashToBucket(experimentId + ":variant:" + visitorId);
  var variantThreshold = variantBucket % 100;
  var cumulative = 0;
  for (var i = 0; i < variants.length; i++) {
    cumulative += variants[i].allocationPercent;
    if (variantThreshold < cumulative) return variants[i];
  }
  return variants.find(function (v) { return v.isControl; }) || variants[0];
}

function evaluateCondition(cond, ctx) {
  var actual;
  switch (cond.type) {
    case "device": actual = ctx.deviceType; break;
    case "country": actual = ctx.country; break;
    case "currency": actual = ctx.currency; break;
    case "url_contains": return (ctx.url || "").includes(cond.value);
    case "utm_source": actual = ctx.utmSource; break;
    case "new_visitor": return cond.operator === "eq" ? ctx.isNewVisitor === cond.value : ctx.isNewVisitor !== cond.value;
    case "returning_visitor": return cond.operator === "eq" ? ctx.isReturningVisitor === cond.value : ctx.isReturningVisitor !== cond.value;
    case "customer_logged_in": return cond.operator === "eq" ? ctx.isCustomerLoggedIn === cond.value : ctx.isCustomerLoggedIn !== cond.value;
    case "date_after": return ctx.currentDate >= new Date(cond.value);
    case "date_before": return ctx.currentDate < new Date(cond.value);
    default: return true;
  }
  if (actual === undefined || actual === null) return false;
  if (cond.operator === "eq") return String(actual).toLowerCase() === String(cond.value).toLowerCase();
  if (cond.operator === "neq") return String(actual).toLowerCase() !== String(cond.value).toLowerCase();
  if (cond.operator === "in") return Array.isArray(cond.value) && cond.value.some(function (v) { return String(actual).toLowerCase() === String(v).toLowerCase(); });
  if (cond.operator === "contains") return String(actual).toLowerCase().includes(String(cond.value).toLowerCase());
  return true;
}

function evaluateGroup(group, ctx) {
  if (!group.conditions || !group.conditions.length) return true;
  if (group.operator === "OR") return group.conditions.some(function (c) { return evaluateCondition(c, ctx); });
  return group.conditions.every(function (c) { return evaluateCondition(c, ctx); });
}

function evaluateTargeting(rules, ctx) {
  if (!rules || !rules.length) return true;
  return rules.every(function (group) { return evaluateGroup(group, ctx); });
}

// ---------------------------------------------------------------------------
// ─── hashToBucket ────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe("hashToBucket", () => {
  it("returns a number in [0, 10000)", () => {
    for (const input of ["abc", "exp-1:traffic:visitor-1", "", "x"]) {
      const b = hashToBucket(input);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(10000);
    }
  });

  it("is deterministic for the same input", () => {
    const b1 = hashToBucket("exp-1:traffic:visitor-42");
    const b2 = hashToBucket("exp-1:traffic:visitor-42");
    expect(b1).toBe(b2);
  });

  it("produces different buckets for different experiments (same visitor)", () => {
    const exp1 = hashToBucket("exp-1:traffic:v-1");
    const exp2 = hashToBucket("exp-2:traffic:v-1");
    expect(exp1).not.toBe(exp2);
  });

  it("distributes across [0, 10000) for many inputs", () => {
    const buckets = new Set();
    for (let i = 0; i < 200; i++) buckets.add(hashToBucket(`exp:traffic:visitor-${i}`));
    expect(buckets.size).toBeGreaterThan(150);
  });
});

// ---------------------------------------------------------------------------
// ─── assignVariant ───────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

const VARIANTS = [
  { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 50 },
  { id: "v-a", key: "variant-a", isControl: false, allocationPercent: 50 },
];

describe("assignVariant", () => {
  it("returns null for empty variants array", () => {
    expect(assignVariant("v1", "exp-1", 100, [])).toBeNull();
  });

  it("returns null when visitor is outside traffic allocation", () => {
    // Find a visitor that lands outside 10% traffic
    let outsider = null;
    for (let i = 0; i < 10000; i++) {
      const vid = `visitor-${i}`;
      const bucket = hashToBucket("exp-1:traffic:" + vid);
      if (bucket >= 1000) { outsider = vid; break; }
    }
    expect(assignVariant(outsider, "exp-1", 10, VARIANTS)).toBeNull();
  });

  it("returns a variant when visitor is inside 100% traffic", () => {
    const result = assignVariant("visitor-1", "exp-1", 100, VARIANTS);
    expect(result).not.toBeNull();
    expect(["control", "variant-a"]).toContain(result.key);
  });

  it("is deterministic — same visitor always gets same variant", () => {
    const r1 = assignVariant("vis-42", "exp-1", 100, VARIANTS);
    const r2 = assignVariant("vis-42", "exp-1", 100, VARIANTS);
    expect(r1?.key).toBe(r2?.key);
  });

  it("distributes roughly 50/50 across many visitors", () => {
    const counts = { control: 0, "variant-a": 0 };
    for (let i = 0; i < 1000; i++) {
      const v = assignVariant(`v${i}`, "exp-1", 100, VARIANTS);
      if (v) counts[v.key] = (counts[v.key] || 0) + 1;
    }
    expect(counts.control).toBeGreaterThan(350);
    expect(counts["variant-a"]).toBeGreaterThan(350);
  });
});

// ---------------------------------------------------------------------------
// ─── evaluateTargeting ───────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

const BASE_CTX = {
  deviceType: "desktop",
  country: "US",
  currency: "USD",
  url: "https://example.com/products/shirt",
  path: "/products/shirt",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "spring",
  isNewVisitor: false,
  isReturningVisitor: true,
  isCustomerLoggedIn: false,
  currentDate: new Date("2025-06-01"),
};

describe("evaluateTargeting", () => {
  it("returns true when rules array is empty", () => {
    expect(evaluateTargeting([], BASE_CTX)).toBe(true);
    expect(evaluateTargeting(null, BASE_CTX)).toBe(true);
  });

  it("matches device type", () => {
    const rules = [{ conditions: [{ type: "device", operator: "eq", value: "desktop" }] }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, deviceType: "mobile" })).toBe(false);
  });

  it("matches country", () => {
    const rules = [{ conditions: [{ type: "country", operator: "eq", value: "US" }] }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, country: "CA" })).toBe(false);
  });

  it("matches url_contains", () => {
    const rules = [{ conditions: [{ type: "url_contains", value: "/products/" }] }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, url: "/collections/all" })).toBe(false);
  });

  it("matches UTM source", () => {
    const rules = [{ conditions: [{ type: "utm_source", operator: "eq", value: "google" }] }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, utmSource: "facebook" })).toBe(false);
  });

  it("handles OR group — passes if any condition matches", () => {
    const rules = [{
      operator: "OR",
      conditions: [
        { type: "country", operator: "eq", value: "CA" },
        { type: "country", operator: "eq", value: "US" },
      ],
    }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, country: "MX" })).toBe(false);
  });

  it("handles date_after and date_before", () => {
    const afterRule = [{ conditions: [{ type: "date_after", value: "2025-01-01" }] }];
    const beforeRule = [{ conditions: [{ type: "date_before", value: "2025-12-31" }] }];
    expect(evaluateTargeting(afterRule, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(beforeRule, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(afterRule, { ...BASE_CTX, currentDate: new Date("2024-12-31") })).toBe(false);
  });

  it("handles neq operator", () => {
    const rules = [{ conditions: [{ type: "device", operator: "neq", value: "mobile" }] }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, deviceType: "mobile" })).toBe(false);
  });

  it("handles in operator", () => {
    const rules = [{ conditions: [{ type: "country", operator: "in", value: ["US", "CA", "GB"] }] }];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(true);
    expect(evaluateTargeting(rules, { ...BASE_CTX, country: "AU" })).toBe(false);
  });

  it("multiple groups are ANDed together", () => {
    const rules = [
      { conditions: [{ type: "device", operator: "eq", value: "desktop" }] },
      { conditions: [{ type: "country", operator: "eq", value: "CA" }] },
    ];
    expect(evaluateTargeting(rules, BASE_CTX)).toBe(false); // country doesn't match
    expect(evaluateTargeting(rules, { ...BASE_CTX, country: "CA" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ─── applyPriceOverrides DOM tests ───────────────────────────────────────────
// ---------------------------------------------------------------------------

const OVERRIDES_V111 = [
  { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
];

describe("applyPriceOverrides (DOM)", () => {
  beforeEach(() => {
    setupShopifyGlobals();
    mockFetch();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    delete window.Shopify;
    delete window.marginlabConfig;
    delete window.MarginLab;
    localStorage.clear();
    sessionStorage.clear();
  });

  it("applies test price to the matching variant's price element", async () => {
    buildProductPage("111", "$30.00");
    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-price-1",
        slug: "price-test-1",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 0, modifications: [], priceOverrides: [] },
          { id: "v-test", key: "variant-a", isControl: false, allocationPercent: 100, modifications: [], priceOverrides: OVERRIDES_V111 },
        ],
      }],
    });

    await loadRuntime();
    await vi.runAllTimersAsync();

    const priceEl = document.querySelector(".price-item--regular");
    expect(priceEl.getAttribute("data-ml-price-override")).toBe("1");
    expect(priceEl.textContent).toContain("24.99");
  });

  it("applies compareAtPrice when provided", async () => {
    document.body.innerHTML = `
      <form action="/cart/add">
        <input type="hidden" name="id" value="111" />
      </form>
      <div class="price">
        <span class="price-item--regular">$30.00</span>
        <span class="price-item--sale">$35.00</span>
      </div>
    `;

    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-compare",
        slug: "compare-test",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 0, modifications: [], priceOverrides: [] },
          {
            id: "v-test",
            key: "variant-a",
            isControl: false,
            allocationPercent: 100,
            modifications: [],
            priceOverrides: [{
              shopifyVariantId: "gid://shopify/ProductVariant/111",
              shopifyProductId: "gid://shopify/Product/999",
              price: "24.99",
              compareAtPrice: "39.99",
            }],
          },
        ],
      }],
    });

    await loadRuntime();
    await vi.runAllTimersAsync();

    const regular = document.querySelector(".price-item--regular");
    const compare = document.querySelector(".price-item--sale");

    expect(regular.getAttribute("data-ml-price-override")).toBe("1");
    expect(compare.getAttribute("data-ml-price-override")).toBe("1");
    expect(regular.textContent).toContain("24.99");
    expect(compare.textContent).toContain("39.99");
  });

  it("does not apply price when selected variant has no matching override", async () => {
    // Variant 222 is selected but overrides only cover variant 111
    buildProductPage("222", "$30.00");
    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-price-2",
        slug: "price-test-2",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 50, modifications: [], priceOverrides: [] },
          { id: "v-test", key: "variant-a", isControl: false, allocationPercent: 50, modifications: [], priceOverrides: OVERRIDES_V111 },
        ],
      }],
    });

    await loadRuntime();
    await vi.runAllTimersAsync();

    const priceEl = document.querySelector(".price-item--regular");
    // Variant 222 has no override — original price should remain (or no override applied)
    expect(priceEl.getAttribute("data-ml-price-override")).toBeNull();
  });

  it("skips SHOPIFY_FUNCTION experiments (does not touch the DOM)", async () => {
    buildProductPage("111", "$30.00");
    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-fn",
        slug: "fn-test",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "SHOPIFY_FUNCTION" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 50, modifications: [], priceOverrides: [] },
          { id: "v-test", key: "variant-a", isControl: false, allocationPercent: 50, modifications: [], priceOverrides: OVERRIDES_V111 },
        ],
      }],
    });

    await loadRuntime();
    await vi.runAllTimersAsync();

    const priceEl = document.querySelector(".price-item--regular");
    expect(priceEl.textContent).toBe("$30.00");
    expect(priceEl.getAttribute("data-ml-price-override")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ─── watchVariantChanges — variant selector interaction ──────────────────────
// ---------------------------------------------------------------------------

describe("watchVariantChanges", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    delete window.Shopify;
    delete window.marginlabConfig;
    delete window.MarginLab;
    localStorage.clear();
    sessionStorage.clear();
  });

  it("re-applies price when hidden input changes via select-change event", async () => {
    // Set up page with variant 111 selected, price test covers 111 and 222
    document.body.innerHTML = `
      <form action="/cart/add">
        <input type="hidden" name="id" value="111" />
      </form>
      <div class="price">
        <span class="price-item--regular">$30.00</span>
      </div>
    `;

    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-vc",
        slug: "vc-test",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 0, modifications: [], priceOverrides: [] },
          {
            id: "v-test", key: "variant-a", isControl: false, allocationPercent: 100,
            modifications: [],
            priceOverrides: [
              { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
              { shopifyVariantId: "gid://shopify/ProductVariant/222", shopifyProductId: "gid://shopify/Product/999", price: "19.99" },
            ],
          },
        ],
      }],
    });

    await loadRuntime();

    // Simulate user switching to variant 222
    const hiddenInput = document.querySelector("input[name='id']");
    hiddenInput.value = "222";
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));

    const priceEl = document.querySelector(".price-item--regular");
    expect(priceEl.getAttribute("data-ml-price-override")).toBe("1");
    expect(priceEl.textContent).toContain("19.99");
    expect(priceEl.textContent).not.toContain("24.99");
  });

  it("re-applies price when custom variant:changed event fires", async () => {
    document.body.innerHTML = `
      <form action="/cart/add">
        <input type="hidden" name="id" value="111" />
      </form>
      <div class="price">
        <span class="price-item--regular">$30.00</span>
      </div>
    `;

    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-custom-evt",
        slug: "custom-evt-test",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 0, modifications: [], priceOverrides: [] },
          {
            id: "v-test", key: "variant-a", isControl: false, allocationPercent: 100,
            modifications: [],
            priceOverrides: [
              { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
            ],
          },
        ],
      }],
    });

    await loadRuntime();

    // Confirm the test price was applied initially
    const priceEl = document.querySelector(".price-item--regular");
    expect(priceEl.getAttribute("data-ml-price-override")).toBe("1");

    // Simulate hidden input update + custom theme event (e.g. Prestige)
    document.querySelector("input[name='id']").value = "333";
    document.dispatchEvent(new CustomEvent("variant:changed"));

    // Variant 333 has no override — price should be restored to original
    expect(priceEl.getAttribute("data-ml-price-override")).toBeNull();
    expect(priceEl.textContent).toBe("$30.00");
  });

  it("restores original price when switching to a variant with no override", async () => {
    document.body.innerHTML = `
      <form action="/cart/add">
        <input type="hidden" name="id" value="111" />
      </form>
      <div class="price">
        <span class="price-item--regular">$30.00</span>
      </div>
    `;

    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-restore",
        slug: "restore-test",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 0, modifications: [], priceOverrides: [] },
          {
            id: "v-test", key: "variant-a", isControl: false, allocationPercent: 100,
            modifications: [],
            priceOverrides: [
              { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
            ],
          },
        ],
      }],
    });

    await loadRuntime();

    // Override applied for variant 111
    const priceEl = document.querySelector(".price-item--regular");
    expect(priceEl.getAttribute("data-ml-price-override")).toBe("1");

    // Switch to variant 999 — no override for this one
    document.querySelector("input[name='id']").value = "999";
    document.dispatchEvent(new CustomEvent("variant:changed"));

    expect(priceEl.getAttribute("data-ml-price-override")).toBeNull();
    expect(priceEl.textContent).toBe("$30.00");
  });

  it("re-applies override after theme re-render wipes price node (MutationObserver path)", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <form action="/cart/add">
        <input type="hidden" name="id" value="111" />
      </form>
      <div class="price">
        <span class="price-item--regular">$30.00</span>
      </div>
    `;

    setupShopifyGlobals();
    mockFetch({
      experiments: [{
        id: "exp-observer",
        slug: "observer-test",
        type: "PRICE_TEST",
        status: "RUNNING",
        trafficAllocation: 100,
        assignmentStrategy: "visitor",
        targetingRules: [],
        priceConfig: { enforcementStrategy: "DISPLAY_ONLY" },
        variants: [
          { id: "v-ctrl", key: "control", isControl: true, allocationPercent: 0, modifications: [], priceOverrides: [] },
          {
            id: "v-test", key: "variant-a", isControl: false, allocationPercent: 100,
            modifications: [],
            priceOverrides: [
              { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
            ],
          },
        ],
      }],
    });

    await loadRuntime();
    await vi.runAllTimersAsync();

    const priceContainer = document.querySelector(".price");
    const priceElBefore = document.querySelector(".price-item--regular");
    expect(priceElBefore.getAttribute("data-ml-price-override")).toBe("1");

    // Simulate theme section re-render that wipes runtime attributes
    priceContainer.innerHTML = `<span class="price-item--regular">$31.00</span>`;

    // Observer path waits 50ms before re-applying overrides
    await vi.advanceTimersByTimeAsync(60);

    const priceElAfter = document.querySelector(".price-item--regular");
    expect(priceElAfter.getAttribute("data-ml-price-override")).toBe("1");
    expect(priceElAfter.textContent).toContain("24.99");
    expect(priceElAfter.textContent).not.toContain("31.00");
  });
});
