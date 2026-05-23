# Dual Version Strategy: MarginLab

_Last updated: May 23, 2026_

## Overview

MarginLab exists in two forms:

| Version | Repo | Purpose | Auth model | Billing |
|---|---|---|---|---|
| **Standalone** | `margin-labs` | Shopify App Store / public app | Public app OAuth | Shopify Billing API |
| **Embedded** | `checkout-redo-engine` | Custom app for existing merchants (ambrosia, gettrusupps, ...) | Custom app / pre-installed | Disabled / not needed |

---

## Audit Summary

### margin-labs (standalone)

- **Path:** `C:\Users\pol\Desktop\margin-labs`
- **Package manager:** npm (package-lock.json)
- **Framework:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Admin app:** `apps/admin/src/` — full dashboard, API routes, services, components
- **Prisma:** `apps/admin/prisma/schema.prisma` — PostgreSQL
- **Shopify config:** `shopify.app.toml` — public app client ID
- **Extensions (11 total):**
  - `marginlab-checkout` — Checkout UI extension
  - `marginlab-pixel` — Web Pixel (analytics events)
  - `marginlab-theme` — Theme App Embed (runtime JS)
  - `marginlab-product-discount` — Rust function
  - `marginlab-order-discount` — Rust function
  - `marginlab-shipping-discount` — Rust function
  - `marginlab-delivery-customization` — Rust function
  - `checkout-step-tracker` — Checkout UI extension
  - `order-duplicator` / `order-duplicator-discount` — existing custom extensions
  - `redo-offer`, `subscription-terms`, `fda-disclaimer`, `utm-attribution`, `volume-discount`
- **Auth:** `lib/shopify.ts` + `lib/session-shop.ts` + `lib/api-middleware.ts` using `@shopify/shopify-app-remix` / NextAuth session
- **Billing:** `services/billing.service.ts` — Shopify Billing API, plan gates, trial logic
- **CI/CD:** Vercel (`vercel.json`), Sentry instrumentation
- **Git branch:** main

### checkout-redo-engine (custom app)

- **Path:** `C:\Users\pol\Desktop\checkout-redo-engine`
- **Package manager:** npm
- **Framework:** Next.js 14 App Router — **identical structure** to margin-labs
- **Admin app:** `apps/admin/src/` — same files as margin-labs (see diff below)
- **Prisma:** same schema
- **Shopify configs:**
  - `shopify.app.toml` — default config
  - `shopify.app.checkout-redo-engine.toml` — custom app for checkout-redo-engine merchant
  - `shopify.app.ambrosia.toml` — custom app for ambrosia merchant
  - `shopify.app.gettrusupps.toml` — custom app for gettrusupps merchant
- **Extensions:** same 11 extensions, same structure
- **Auth:** same code, but used as custom app (pre-installed, no OAuth install flow needed in practice)
- **Billing:** same code present but not enforced in custom app context

---

## Key Insight

> **The two repos share ~99% identical source code.**  
> They differ only in Shopify app config (`.toml` files), `.env` credentials, and a small number of source files.

The "dual version" strategy is already in place by design:
- Same product logic, same UI, same API routes, same Prisma schema.
- Different deployment targets controlled by `shopify.app.*.toml` files and environment variables.

---

## Source File Differences (as of May 23, 2026)

After today's sync, the following intentional differences remain:

| File | Standalone ML | CRE | Reason |
|---|---|---|---|
| `apps/admin/next.config.ts` | Has Windows watchOptions workaround | Standard Sentry webpack config | Local dev environments differ |
| `shopify.app.toml` | Public app client ID | Custom app client ID | Different Shopify apps |
| `shopify.app.ambrosia.toml` | Not present | Present | Ambrosia custom install |
| `shopify.app.gettrusupps.toml` | Not present | Present | GetTrusupps custom install |
| `apps/admin/.env.local` | Public app keys, public DB | Custom app keys, custom DB | **Never copy env files** |

All other source files under `apps/admin/src/` are identical.

---

## Architecture Decision

**Chosen approach: Option C — Shared source with target-specific config**

- `margin-labs` is the **source of truth** for product code.
- `checkout-redo-engine` receives changes via a **periodic file sync** (see `MARGINLAB_SYNC_CHECKLIST.md`).
- Target-specific behavior is controlled by environment variables and `.toml` configs, not by code branches.

### Why not the other options

| Option | Reason rejected |
|---|---|
| A — Full copy | Already done; the repos ARE copies. The risk is divergence without a sync process |
| B — Shared package | Over-engineering for two repos that are 99% identical |
| D — Git subtree/submodule | Developer workflow complexity, Windows path issues with `[id]` routes |

---

## Feature Flags / Target Configuration

Both repos share the same code. Feature behavior is controlled by env vars:

```bash
# In checkout-redo-engine .env.local — custom app mode
MARGINLAB_TARGET=checkout_redo_engine
MARGINLAB_ENABLE_BILLING=false          # Disable Shopify Billing in custom app
MARGINLAB_ENABLE_PUBLIC_APP_OAUTH=false # No install flow needed
MARGINLAB_ENABLE_APP_STORE_READINESS=false

# In margin-labs .env.local — standalone public app
MARGINLAB_TARGET=standalone
MARGINLAB_ENABLE_BILLING=true
MARGINLAB_ENABLE_PUBLIC_APP_OAUTH=true
MARGINLAB_ENABLE_APP_STORE_READINESS=true
```

> ⚠️ These env vars are defined but currently the codebase does not yet have runtime `if (process.env.MARGINLAB_TARGET)` gates. Add them when you need to conditionally show/hide App Store-only UI (e.g., the billing page, upgrade CTA, onboarding install flow).

---

## What to Keep Target-Specific (Never Sync)

| File/folder | Reason |
|---|---|
| `shopify.app.*.toml` | App client IDs, extension IDs, scopes differ per target |
| `apps/admin/.env` / `.env.local` | DB URL, API keys, secrets — **never sync** |
| `apps/admin/next.config.ts` | Sentry/webpack config may differ |
| `apps/admin/sentry.*.config.ts` | Different DSNs per deployment |
| `apps/admin/prisma/migrations/` | Apply migrations independently per DB |
| `.shopify/` | Shopify CLI state, bundle manifest |

---

## What to Sync (margin-labs → checkout-redo-engine)

Everything under `apps/admin/src/` except nothing — the full source tree is shared:

- `app/(dashboard)/` — all pages
- `app/api/` — all API routes
- `components/` — all UI components
- `lib/` — all utilities and middleware
- `services/` — all business logic services
- `config/` — test type configs
- `jobs/` — background job workers
- `types/` — TypeScript type definitions
- `app/global-error.tsx`, `app/layout.tsx`, `app/globals.css`

Extensions are also synced when changed:
- `extensions/marginlab-*` — all MarginLab-specific extensions

---

## Sync Workflow (Future Changes)

1. **Build the feature in `margin-labs`** (source of truth).
2. **Run the sync** (see `MARGINLAB_SYNC_CHECKLIST.md`):
   ```powershell
   # Sync all src files
   $ml = "C:\Users\pol\Desktop\margin-labs\apps\admin\src"
   $cre = "C:\Users\pol\Desktop\checkout-redo-engine\apps\admin\src"
   robocopy $ml $cre /MIR /XD node_modules .next /XF .env* *.local
   ```
   > Or selectively copy changed files using `Copy-Item ... -Force`.
3. **Do NOT copy:** `.env*`, `next.config.ts`, `sentry.*.config.ts`, `shopify.app.*.toml`, `prisma/migrations/`
4. **Run validations** in checkout-redo-engine:
   ```powershell
   cd C:\Users\pol\Desktop\checkout-redo-engine\apps\admin
   npx tsc --noEmit
   ```
5. **Apply DB migrations** if schema changed:
   ```powershell
   npx prisma migrate deploy
   ```

---

## Validation Checklist

### After any sync from margin-labs → checkout-redo-engine:

- [ ] TypeScript compiles: `npx tsc --noEmit` (no errors)
- [ ] Prisma client regenerates: `npx prisma generate`
- [ ] Dev server starts: `npm run dev`
- [ ] Existing checkout-redo-engine functionality still works
- [ ] Kill Switch panel loads
- [ ] Attribution Debug panel loads
- [ ] Checkout Health panel loads
- [ ] At least one test type (price-tests, discount-tests) can be created

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Divergence between repos | Always build in `margin-labs` first; sync is one-directional |
| Accidentally copying `.env` files | The sync script explicitly excludes `.env*` |
| Breaking CRE's existing merchants | Run TypeScript check + smoke test after every sync |
| App Store auth leaking into CRE | `MARGINLAB_ENABLE_PUBLIC_APP_OAUTH=false` feature flag |
| Billing logic confusing CRE merchants | `MARGINLAB_ENABLE_BILLING=false` feature flag |
| Prisma migration conflicts | Apply migrations independently; never run `migrate reset` in production |
| Shopify config overwritten | `shopify.app.*.toml` files are excluded from sync |
| Secrets committed | Both repos have `.gitignore` covering `.env.local`, `.env` |
