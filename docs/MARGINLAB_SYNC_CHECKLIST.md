# MarginLab Sync Checklist

_Source of truth: `margin-labs` repo_  
_Target: `checkout-redo-engine` repo_

Use this checklist every time you make changes in `margin-labs` that need to be reflected in `checkout-redo-engine`.

---

## Quick Sync Command

```powershell
# Run from any directory
$ml  = "C:\Users\pol\Desktop\margin-labs\apps\admin\src"
$cre = "C:\Users\pol\Desktop\checkout-redo-engine\apps\admin\src"

# Selective: copy one file
Copy-Item "$ml\components\ui\Button.tsx" "$cre\components\ui\Button.tsx" -Force

# Bulk: sync entire src tree (excludes nothing — safe because it only touches src/)
robocopy $ml $cre /MIR /R:0 /W:0
```

> ⚠️ **Never use robocopy at the repo root** — it will overwrite `.env`, `shopify.app.*.toml`, `next.config.ts`, and `prisma/migrations/`.

---

## Files That MUST NOT Be Synced

| File / Pattern | Why |
|---|---|
| `apps/admin/.env` | Production DB credentials for each target |
| `apps/admin/.env.local` | Local dev secrets — differ per machine/target |
| `apps/admin/.env.example` | May have different required vars per target |
| `shopify.app.toml` | Root-level Shopify app config — different client IDs |
| `shopify.app.ambrosia.toml` | CRE-only — ambrosia custom app |
| `shopify.app.gettrusupps.toml` | CRE-only — gettrusupps custom app |
| `shopify.app.checkout-redo-engine.toml` | CRE-only |
| `apps/admin/next.config.ts` | Sentry/webpack config differs |
| `apps/admin/sentry.client.config.ts` | Different DSN |
| `apps/admin/sentry.server.config.ts` | Different DSN |
| `apps/admin/sentry.edge.config.ts` | Different DSN |
| `apps/admin/prisma/migrations/` | Apply independently per DB |
| `.shopify/` | Shopify CLI state / bundle cache |
| `.claude/` | AI agent state |

---

## Files That SHOULD Be Synced

Everything under `apps/admin/src/`:

### App pages
- [ ] `app/(dashboard)/page.tsx` — Dashboard
- [ ] `app/(dashboard)/layout.tsx` — Dashboard layout
- [ ] `app/(dashboard)/error.tsx` — Error boundary
- [ ] `app/global-error.tsx` — Global error boundary
- [ ] `app/layout.tsx` — Root layout
- [ ] `app/globals.css` — Global styles
- [ ] All `app/(dashboard)/*/page.tsx` — All feature pages
- [ ] All `app/(dashboard)/*/new/page.tsx` — Create pages
- [ ] All `app/(dashboard)/*/[id]/page.tsx` — Detail pages

### API routes
- [ ] `app/api/auth/` — Auth routes (check for public app specifics)
- [ ] `app/api/billing/` — Billing routes (safe to sync; disabled by env flag in CRE)
- [ ] `app/api/runtime/` — Runtime endpoints
- [ ] `app/api/webhooks/` — Webhook handlers
- [ ] `app/api/settings/` — Settings endpoints
- [ ] All other `app/api/*/` routes

### Components (sync all)
- [ ] `components/ui/` — Design system components
- [ ] `components/layout/` — Layout components
- [ ] `components/experiments/` — Experiment shared components
- [ ] `components/forms/` — Form components
- [ ] `components/analytics/` — Analytics components
- [ ] `components/charts/` — Chart components
- [ ] `components/previews/` — Preview components
- [ ] `components/price-tests/`
- [ ] `components/shipping/`
- [ ] `components/discount-tests/`
- [ ] `components/checkout-tests/`
- [ ] `components/content-tests/`
- [ ] `components/offer-tests/`
- [ ] `components/offers/`
- [ ] `components/personalizations/`
- [ ] `components/personalization-tests/`
- [ ] `components/template-tests/`
- [ ] `components/theme-tests/`
- [ ] `components/checkout-blocks/`
- [ ] `components/cogs/`
- [ ] `components/dashboard/`
- [ ] `components/integrations/`

### Business logic (sync all)
- [ ] `lib/` — All utilities, middleware, helpers
- [ ] `services/` — All service files
- [ ] `jobs/` — Background job workers
- [ ] `config/testTypes/` — Test type configuration
- [ ] `types/` — TypeScript type definitions

### Prisma schema
- [ ] `apps/admin/prisma/schema.prisma` — Sync schema changes
- [ ] `apps/admin/prisma/seed.ts` — Sync seed data changes
- [ ] **After syncing schema:** run `npx prisma generate` in CRE
- [ ] **After schema changes:** carefully review and apply `npx prisma migrate dev` in CRE

### Extensions
- [ ] `extensions/marginlab-checkout/` — Checkout UI extension
- [ ] `extensions/marginlab-pixel/` — Web Pixel
- [ ] `extensions/marginlab-theme/` — Theme App Embed + runtime JS
- [ ] `extensions/marginlab-product-discount/` — Rust function
- [ ] `extensions/marginlab-order-discount/` — Rust function
- [ ] `extensions/marginlab-shipping-discount/` — Rust function
- [ ] `extensions/marginlab-delivery-customization/` — Rust function

### Root config files (sync with care)
- [ ] `apps/admin/package.json` — Sync if new dependencies added (then run `npm install` in CRE)
- [ ] `apps/admin/tsconfig.json` — Sync if TypeScript config changed
- [ ] `apps/admin/tailwind.config.ts` — Sync if Tailwind config changed
- [ ] `apps/admin/postcss.config.js` — Sync if PostCSS config changed
- [ ] `apps/admin/vitest.config.ts` — Sync if test config changed

---

## Post-Sync Validation Steps

```powershell
cd C:\Users\pol\Desktop\checkout-redo-engine\apps\admin

# 1. If package.json changed:
npm install

# 2. If schema.prisma changed:
npx prisma generate
npx prisma migrate dev --name "describe-the-change"

# 3. TypeScript check (must pass with 0 errors):
npx tsc --noEmit

# 4. Start dev server and smoke test:
npm run dev
```

Then verify in browser:
- [ ] Dashboard loads at `/`
- [ ] At least one test list page loads (e.g., `/price-tests`)
- [ ] Debug page loads at `/debug`
- [ ] Kill Switch panel works
- [ ] No console errors on page load

---

## Sync History

| Date | What changed | Synced by |
|---|---|---|
| 2026-05-23 | Initial full sync: all session changes including UpgradePlanModal, PriceTestWizard/ShippingTestWizard/DiscountTestWizard/TemplateTestWizard 402 guards, EditPersonalizationForm, PersonalizationEditPanel, personalizations/[id] page, debug/page with AttributionDebugPanel + CheckoutHealthPanel; also NewPersonalizationForm, PostPurchaseWizard, ThemeTestWizard, global-error.tsx | Auto via Copy-Item |
