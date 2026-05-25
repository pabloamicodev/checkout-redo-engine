#!/usr/bin/env node
/**
 * Full CRUD test suite for checkout-redo-engine API
 *
 * Autenticación: usa X-Test-Auth + X-Shop-Domain (bypass token).
 * Antes de correr, asegúrate que TEST_AUTH_TOKEN esté seteado en Vercel.
 *
 * Usage (PowerShell):
 *   $env:TEST_AUTH_TOKEN="mi_token_secreto"; node test-endpoints.mjs
 *
 * Orden: SEED → POST → PATCH → GET → Actions → DELETE
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL    = "https://checkout-redo-engine.vercel.app";
const SHOP_DOMAIN = "hpn-supplements.myshopify.com";
const TEST_TOKEN  = process.env.TEST_AUTH_TOKEN ?? "";

if (!TEST_TOKEN) {
  console.error("❌  Falta TEST_AUTH_TOKEN. Ejecuta:");
  console.error('   $env:TEST_AUTH_TOKEN="tu_token"; node test-endpoints.mjs');
  process.exit(1);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function req(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type":   "application/json",
      "X-Test-Auth":    TEST_TOKEN,
      "X-Shop-Domain":  SHOP_DOMAIN,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json") && res.status !== 204) {
    try { data = await res.json(); } catch { /* vacío */ }
  }
  return { status: res.status, data };
}

const get   = (p)    => req("GET",    p);
const post  = (p, b) => req("POST",   p, b);
const patch = (p, b) => req("PATCH",  p, b);
const del   = (p)    => req("DELETE", p);

// ─── Resultados ───────────────────────────────────────────────────────────────
const results  = [];
let   failures = 0;

function record(label, { status, data }, { expect = null } = {}) {
  const is5xx  = status >= 500;
  const expOk  = expect ? status === expect : (status >= 200 && status < 300);
  const pass   = !is5xx && expOk;
  const icon   = is5xx ? "💥" : !pass ? "⚠️ " : "✅";

  if (is5xx) failures++;

  const short = data ? JSON.stringify(data).slice(0, 160) : "(sin body)";
  results.push({ icon, label, status, short });

  console.log(`${icon} [${status}] ${label}`);
  if (!pass) console.log(`       ↳ ${short}`);

  return data;
}

// IDs de recursos creados para las fases siguientes
const ids = {};

// ══════════════════════════════════════════════════════════════════════════════
console.log(`\n🧪 Testing: ${BASE_URL}`);
console.log(`🔑 Shop:    ${SHOP_DOMAIN}`);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log("║  FASE 0 — SEED (registrar shop en DB)    ║");
console.log("╚══════════════════════════════════════════╝\n");

{
  const r = await req("POST", "/api/test/seed", { shopDomain: SHOP_DOMAIN });
  const d = record("POST /api/test/seed", r, { expect: 200 });
  if (r.status !== 200) {
    console.error("\n❌  No se pudo crear el shop en la DB. Abortando.");
    console.error("    Verifica que TEST_AUTH_TOKEN está seteado en Vercel.");
    process.exit(1);
  }
  console.log(`       ↳ shop.id=${d?.shop?.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log("║  FASE 1 — POST (crear recursos)          ║");
console.log("╚══════════════════════════════════════════╝\n");

// Experimento PRICE_TEST
{
  const r = await post("/api/experiments", {
    name: "[TEST] Price Test CRUD",
    type: "PRICE_TEST",
    primaryMetric: "conversion_rate",
    trafficAllocation: 50,
    variants: [
      { key: "control",   name: "Control",   isControl: true,  allocationPercent: 50 },
      { key: "variant_a", name: "Variant A", isControl: false, allocationPercent: 50 },
    ],
  });
  const d = record("POST /api/experiments — PRICE_TEST", r, { expect: 201 });
  ids.exp1 = d?.experiment?.id;
  if (ids.exp1) console.log(`       ↳ id=${ids.exp1}`);
}

// Experimento CONTENT_TEST
{
  const r = await post("/api/experiments", {
    name: "[TEST] Content Test CRUD",
    type: "CONTENT_TEST",
    primaryMetric: "click_rate",
    trafficAllocation: 100,
    variants: [
      { key: "control",  name: "Original", isControl: true,  allocationPercent: 50 },
      { key: "new_copy", name: "New Copy", isControl: false, allocationPercent: 50 },
    ],
  });
  const d = record("POST /api/experiments — CONTENT_TEST", r, { expect: 201 });
  ids.exp2 = d?.experiment?.id;
  if (ids.exp2) console.log(`       ↳ id=${ids.exp2}`);
}

// Offer
{
  const r = await post("/api/offers", {
    name: "[TEST] 10% Descuento",
    type: "PERCENTAGE_DISCOUNT",
    triggerRules: [],
    discountRules: { percentage: 10 },
    displaySettings: { position: "sidebar" },
  });
  const d = record("POST /api/offers — PERCENTAGE_DISCOUNT", r, { expect: 201 });
  ids.offer = d?.id ?? d?.offer?.id;
  if (ids.offer) console.log(`       ↳ id=${ids.offer}`);
}

// Checkout Block
{
  const r = await post("/api/checkout-blocks", {
    name: "[TEST] Trust Badges CRUD",
    type: "TRUST_BADGES",
    content: { badges: ["ssl", "money_back"] },
    styles: {},
    targetingRules: [],
    position: "AFTER_CONTACT",
  });
  const d = record("POST /api/checkout-blocks — TRUST_BADGES", r, { expect: 201 });
  ids.block = d?.id ?? d?.block?.id;
  if (ids.block) console.log(`       ↳ id=${ids.block}`);
}

// Custom Event
{
  const name = `test_evt_${Date.now()}`;
  const r = await post("/api/custom-events", {
    name,
    displayName: "[TEST] Custom Event CRUD",
    description: "Creado por test suite automatizado",
    schema: { orderId: "string", amount: "number" },
  });
  const d = record("POST /api/custom-events", r, { expect: 201 });
  ids.event = d?.event?.id ?? d?.id;
  if (ids.event) console.log(`       ↳ id=${ids.event}`);
}

// Settings general
{
  const r = await post("/api/settings/general", {
    debugModeEnabled: false,
    antiFlickerEnabled: true,
  });
  record("POST /api/settings/general (merge)", r, { expect: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log("║  FASE 2 — PATCH (actualizar recursos)    ║");
console.log("╚══════════════════════════════════════════╝\n");

if (ids.exp1) {
  const r = await patch(`/api/experiments/${ids.exp1}`, {
    name: "[TEST] Price Test CRUD — Updated",
    description: "Actualizado por test suite",
    trafficAllocation: 75,
  });
  record(`PATCH /api/experiments/${ids.exp1}`, r, { expect: 200 });
}

if (ids.offer) {
  const r = await patch(`/api/offers/${ids.offer}`, {
    name: "[TEST] 15% Descuento — Updated",
    discountRules: { percentage: 15 },
  });
  record(`PATCH /api/offers/${ids.offer}`, r, { expect: 200 });
}

if (ids.block) {
  const r = await patch(`/api/checkout-blocks/${ids.block}`, {
    name: "[TEST] Trust Badges CRUD — Updated",
    content: { badges: ["ssl", "money_back", "secure_payment"] },
  });
  record(`PATCH /api/checkout-blocks/${ids.block}`, r, { expect: 200 });
}

if (ids.event) {
  const r = await patch(`/api/custom-events/${ids.event}`, {
    displayName: "[TEST] Custom Event CRUD — Updated",
    description: "Actualizado por test suite",
  });
  record(`PATCH /api/custom-events/${ids.event}`, r, { expect: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log("║  FASE 3 — GET (leer y verificar datos)   ║");
console.log("╚══════════════════════════════════════════╝\n");

record("GET /api/experiments",                   await get("/api/experiments"),                         { expect: 200 });
record("GET /api/experiments?status=DRAFT",      await get("/api/experiments?status=DRAFT"),            { expect: 200 });
record("GET /api/experiments?type=PRICE_TEST",   await get("/api/experiments?type=PRICE_TEST"),         { expect: 200 });
record("GET /api/offers",                        await get("/api/offers"),                              { expect: 200 });
record("GET /api/offers?status=DRAFT",           await get("/api/offers?status=DRAFT"),                 { expect: 200 });
record("GET /api/checkout-blocks",               await get("/api/checkout-blocks"),                     { expect: 200 });
record("GET /api/custom-events",                 await get("/api/custom-events"),                       { expect: 200 });
record("GET /api/personalizations",              await get("/api/personalizations"),                    { expect: 200 });
record("GET /api/settings/general",              await get("/api/settings/general"),                    { expect: 200 });
record("GET /api/settings/shop",                 await get("/api/settings/shop"),                       { expect: 200 });
record("GET /api/billing/plans",                 await get("/api/billing/plans"),                       { expect: 200 });
record("GET /api/onboarding/status",             await get("/api/onboarding/status"),                   { expect: 200 });
record("GET /api/limitations",                   await get("/api/limitations"),                         { expect: 200 });
record("GET /api/integrations",                  await get("/api/integrations"),                        { expect: 200 });

if (ids.exp1) {
  record(`GET /api/experiments/${ids.exp1}`,           await get(`/api/experiments/${ids.exp1}`),           { expect: 200 });
  record(`GET /api/experiments/${ids.exp1}/analytics`, await get(`/api/experiments/${ids.exp1}/analytics`), { expect: 200 });
}
if (ids.offer)  record(`GET /api/offers/${ids.offer}`,            await get(`/api/offers/${ids.offer}`),            { expect: 200 });
if (ids.block)  record(`GET /api/checkout-blocks/${ids.block}`,   await get(`/api/checkout-blocks/${ids.block}`),   { expect: 200 });
if (ids.event)  record(`GET /api/custom-events/${ids.event}`,     await get(`/api/custom-events/${ids.event}`),     { expect: 200 });

// Runtime (público, sin auth)
record("GET /api/runtime/config?shop=hpn-supplements.myshopify.com", await get("/api/runtime/config?shop=hpn-supplements.myshopify.com"), { expect: 200 });
record("GET /api/health", await get("/api/health"), { expect: 200 });

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log("║  FASE 4 — Actions (launch/pause/archive) ║");
console.log("╚══════════════════════════════════════════╝\n");

if (ids.exp1) {
  const launch = await post(`/api/experiments/${ids.exp1}/launch`, {});
  record(`POST /api/experiments/${ids.exp1}/launch`, launch, { expect: 200 });

  if (launch.status === 200) {
    const pause = await post(`/api/experiments/${ids.exp1}/pause`, {});
    record(`POST /api/experiments/${ids.exp1}/pause`, pause, { expect: 200 });
  }
}

if (ids.exp2) {
  const archive = await post(`/api/experiments/${ids.exp2}/archive`, {});
  record(`POST /api/experiments/${ids.exp2}/archive`, archive, { expect: 200 });
}

if (ids.block) {
  const act = await post(`/api/checkout-blocks/${ids.block}/activate`, {});
  record(`POST /api/checkout-blocks/${ids.block}/activate`, act, { expect: 200 });

  if (act.status === 200) {
    const paus = await post(`/api/checkout-blocks/${ids.block}/pause`, {});
    record(`POST /api/checkout-blocks/${ids.block}/pause`, paus, { expect: 200 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log("║  FASE 5 — DELETE (limpiar datos de test) ║");
console.log("╚══════════════════════════════════════════╝\n");

if (ids.event) {
  const r = await del(`/api/custom-events/${ids.event}`);
  record(`DELETE /api/custom-events/${ids.event}`, r, { expect: 204 });
}

if (ids.offer) {
  const r = await del(`/api/offers/${ids.offer}`);
  record(`DELETE /api/offers/${ids.offer}`, r, { expect: 204 });
}

if (ids.block) {
  const r = await del(`/api/checkout-blocks/${ids.block}`);
  if (r.status === 405 || r.status === 404) {
    const arch = await post(`/api/checkout-blocks/${ids.block}/archive`, {});
    record(`POST /api/checkout-blocks/${ids.block}/archive (fallback)`, arch, { expect: 200 });
  } else {
    record(`DELETE /api/checkout-blocks/${ids.block}`, r, { expect: 204 });
  }
}

if (ids.exp1) {
  const r = await post(`/api/experiments/${ids.exp1}/delete`, {});
  record(`POST /api/experiments/${ids.exp1}/delete`, r, { expect: 200 });
}
if (ids.exp2) {
  const r = await post(`/api/experiments/${ids.exp2}/delete`, {});
  record(`POST /api/experiments/${ids.exp2}/delete`, r, { expect: 200 });
}

// ─── Resumen final ────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
const total  = results.length;
const passed = results.filter(r => r.icon === "✅").length;
const warned = results.filter(r => r.icon === "⚠️ ").length;
const fivexx = results.filter(r => r.icon === "💥").length;

console.log(`Total: ${total}  ✅ Passed: ${passed}  ⚠️  Warnings: ${warned}  💥 5xx: ${fivexx}`);

if (fivexx > 0) {
  console.log("\n💥 ERRORES 5xx (crashes — arreglar urgente):");
  results.filter(r => r.icon === "💥").forEach(r => {
    console.log(`   [${r.status}] ${r.label}`);
    console.log(`   ↳ ${r.short}`);
  });
}
if (warned > 0) {
  console.log("\n⚠️  Status codes inesperados:");
  results.filter(r => r.icon === "⚠️ ").forEach(r => {
    console.log(`   [${r.status}] ${r.label}`);
    console.log(`   ↳ ${r.short}`);
  });
}

process.exit(fivexx > 0 ? 1 : 0);
