# MarginLab — Premium UI Redesign Master Todo

> **Objetivo:** Transformar cada tipo de test en una experiencia visual custom, premium y purpose-built.
> No tocar backend, APIs, ni lógica de negocio. Solo UI/UX.
> Calidad objetivo: Linear · Vercel · Stripe · Raycast.
>
> Última actualización: 2026-05-21
> Estado: ✅ Steps 1-6 + 8 (guard banners) + 9 (toast system) + 10-11 complete. Step 4 wizard rebuild (all 8 types) complete — sidebar nav + live preview panels. Steps 7 + 12-15 pending.

---

## Leyenda

- `[ ]` Pendiente
- `[x]` Completado
- `[~]` En progreso
- `[!]` Bloqueado / depende de otro

---

## STEP 1 — Audit & Context

- [ ] Leer y aplicar guía de `npx modern-web-guidance@latest install` (buscar archivos generados en repo)
- [x] Auditar estructura de rutas actual: `apps/admin/src/app/(dashboard)/`
- [x] Identificar rutas sin navegación (billing, audit-log, analytics/profit, onboarding, cogs)
- [x] Crear links faltantes en sidebar (billing, audit-log, cogs, onboarding)
- [x] Agregar link "Profit & Loss report" en página `/analytics`
- [x] Agregar sub-nav Settings ↔ Style Guide en `/settings` y `/settings/styles`
- [x] Agregar back link en `/checkout-blocks/new`
- [x] Crear ruta `/personalizations/abandoned-cart/new`
- [x] Crear rutas `/get-inspired/[slug]` para los 5 templates
- [ ] Auditar todos los wizards actuales y documentar qué campos son genéricos/duplicados

---

## STEP 2 — Design System Foundation

### 2.1 Tokens & Helpers

- [x] Actualizar `apps/admin/src/lib/design/testTypeTheme.ts`
  - Agregar: `label`, `description`, `icon`, `accentColor`, `softBg`, `gradient`, `border`, `badgeStyle`, `emptyStateCopy`, `exampleHypothesis`, `primaryConcept`
  - Colores por tipo:
    - Content → violet (`#7c3aed`)
    - Split URL → sky (`#0284c7`)
    - Price → rose (`#e11d48`)
    - Shipping → cyan (`#0891b2`)
    - Checkout → indigo (`#4f46e5`)
    - Offers → emerald (`#059669`)
    - Discounts → amber (`#d97706`)
    - Personalizations → fuchsia (`#c026d3`)
    - Template → slate (coming soon)
    - Theme → zinc (coming soon)
    - Post-purchase → neutral (coming soon)
- [x] Actualizar `apps/admin/src/lib/design/statusTheme.ts`
  - Agregar estados: `QA`, `Preview`, `Scheduled`, `Error`, `Needs attention`, `Coming soon`
- [x] Crear `apps/admin/src/lib/design/metricTheme.ts`
  - Colores y íconos para cada métrica (CVR, RPV, AOV, profit, etc.)
- [ ] Crear `apps/admin/src/lib/design/wizardStepTheme.ts`
  - Estilos de step activo, completado, con error, pendiente
- [ ] Verificar `apps/admin/src/lib/utils.ts` tiene `cn()` / alias limpio

### 2.2 Layout Components

- [ ] Crear `apps/admin/src/components/layout/WizardLayout.tsx`
  - Shell con: breadcrumb, header con ícono tipo-test, step nav lateral o top, main form, preview panel opcional, sticky action bar
- [ ] Crear `apps/admin/src/components/layout/SplitPanelLayout.tsx`
  - Layout form izquierda + preview derecha (desktop), stacked en mobile
- [ ] Crear `apps/admin/src/components/layout/DetailLayout.tsx`
  - Breadcrumb, header, status badge, tabs, main content area
- [ ] Crear `apps/admin/src/components/layout/PageHeader.tsx`
  - h1, subtitle, badge de tipo, acciones primarias/secundarias
- [ ] Crear `apps/admin/src/components/layout/WizardStepNav.tsx`
  - Stepper lateral: step completado (check), activo (resaltado con acento del tipo), pendiente (neutral), con error (rojo)

### 2.3 Core UI Components

- [ ] `apps/admin/src/components/ui/Badge.tsx` — agregar variante `TypeBadge` con dot + color por tipo
- [ ] `apps/admin/src/components/ui/StatusBadge.tsx` — componente dedicado usando `getStatusTheme`
- [x] `apps/admin/src/components/ui/InlineAlert.tsx` — variantes: info, warning, danger, success
- [ ] `apps/admin/src/components/ui/Banner.tsx` — banner persistente (warning riesgo, guard, etc.)
- [ ] `apps/admin/src/components/ui/Tooltip.tsx` — tooltip básico accesible
- [ ] `apps/admin/src/components/ui/Skeleton.tsx` — verificar que cubre todos los casos
- [x] `apps/admin/src/components/ui/ComingSoonPage.tsx` — página coming soon reutilizable
- [ ] `apps/admin/src/components/ui/EmptyState.tsx` — soporte para acento por tipo de test
- [ ] `apps/admin/src/components/ui/Separator.tsx` — divisor horizontal/vertical
- [ ] `apps/admin/src/components/ui/SegmentedControl.tsx` — selector estilo tabs pill
- [ ] `apps/admin/src/components/ui/DropdownMenu.tsx` — menú contextual accesible

### 2.4 Form Components

- [x] `apps/admin/src/components/forms/FormSection.tsx` — sección con título, descripción, children
- [x] `apps/admin/src/components/forms/FormField.tsx` — label + input + helper + error
- [ ] `apps/admin/src/components/forms/CurrencyInput.tsx` — input numérico con símbolo de moneda
- [ ] `apps/admin/src/components/forms/PercentageInput.tsx` — input numérico con % suffix
- [ ] `apps/admin/src/components/forms/URLInput.tsx` — input texto con validación de URL
- [ ] `apps/admin/src/components/forms/RuleBuilder.tsx` — constructor visual de reglas de targeting
- [x] `apps/admin/src/components/forms/StickyFormActions.tsx` — barra inferior sticky: Back, Save Draft, Continue/Launch
- [ ] `apps/admin/src/components/forms/ValidationSummary.tsx` — lista de errores bloqueantes + warnings

### 2.5 Experiment-Specific Components

- [x] `apps/admin/src/components/experiments/LaunchReadinessPanel.tsx`
  - Secciones: blocking issues, warnings, recommendations, passed checks, readiness score
- [ ] `apps/admin/src/components/experiments/ReviewSummaryPanel.tsx`
  - Test summary, variants, targeting, risk, dependencies, launch CTA
- [x] `apps/admin/src/components/experiments/VariantAllocationEditor.tsx`
  - Editor de % por variante con validación suma = 100
- [ ] `apps/admin/src/components/experiments/TargetingRuleCard.tsx`
  - Card visual para una regla de targeting
- [ ] `apps/admin/src/components/experiments/RiskChecklist.tsx`
  - Checklist de riesgo específico por tipo

### 2.6 Preview Components (placeholders primero, luego enriquecer)

- [ ] `apps/admin/src/components/previews/PriceMatrixPreview.tsx`
- [ ] `apps/admin/src/components/previews/ShippingThresholdPreview.tsx`
- [ ] `apps/admin/src/components/previews/CheckoutBlockPreview.tsx`
- [ ] `apps/admin/src/components/previews/ContentModificationPreview.tsx`
- [ ] `apps/admin/src/components/previews/SplitUrlPreview.tsx`
- [ ] `apps/admin/src/components/previews/OfferPreview.tsx`
- [ ] `apps/admin/src/components/previews/DiscountPreview.tsx`

### 2.7 Analytics Components

- [ ] `apps/admin/src/components/analytics/MetricCard.tsx` — con delta, trend, color por métrica
- [ ] `apps/admin/src/components/analytics/MetricGrid.tsx` — grid responsive de MetricCards
- [ ] `apps/admin/src/components/analytics/MetricDelta.tsx` — +x% / -x% con color
- [ ] `apps/admin/src/components/analytics/ConfidencePanel.tsx` — significancia estadística visual

---

## STEP 3 — Declarative Test Type Config System

- [ ] Crear directorio `apps/admin/src/config/testTypes/`
- [ ] Crear `apps/admin/src/config/testTypes/contentTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/splitUrlTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/offerTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/checkoutTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/discountTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/shippingTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/priceTestConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/personalizationConfig.ts`
- [ ] Crear `apps/admin/src/config/testTypes/index.ts` — export centralizado

Cada config define:
```ts
{
  type, label, description, theme,
  wizardSteps, defaultValues,
  validationSchema (Zod),
  launchReadinessChecks,
  previewComponent,
  reviewComponent,
  listColumns,
  detailSummaryCards,
  analyticsCards,
  emptyState,
  guards,
  edgeCaseMessages,
  exampleName, exampleHypothesis,
}
```

---

## STEP 4 — Wizard Redesigns (por tipo) ✅ COMPLETE — Premium sidebar nav + type-specific live preview panels

### 4.1 Content Test Wizard
**Archivo:** `apps/admin/src/components/content-tests/ContentTestWizard.tsx`

Steps: Setup → Page Targeting → Variants → Content Changes → Anti-flicker → QA → Review

- [x] Step 1 — Setup: nombre, hipótesis, traffic %
- [x] Step 2 — Page Targeting: URL pattern input con InlineAlert guards
- [x] Step 3 — Variants: `VariantAllocationEditor`, add/remove variants
- [x] Step 4 — Content Changes: 8 modification types, editor por variante, JS warning, selector guard
- [x] Step 5 — Anti-flicker: toggle, timeout, CSS snippet preview
- [x] Step 6 — QA: 6-item checklist con completion counter
- [x] `LaunchReadinessPanel` en Review con 5 computed checks
- [x] Violet gradient hero, `WizardStepNav`, `StickyFormActions`

### 4.2 Split URL Test Wizard
**Archivo:** `apps/admin/src/components/experiments/SplitUrlWizard.tsx`

Steps: Setup → URL Routes → Traffic & Targeting → Settings → Review

- [x] Step 1 — Setup: nombre, hipótesis, hero banner sky
- [x] Step 2 — URL Routes: Control card + Variant cards, URL format validation, redirect-flow diagram
  - [x] Guard duplicates, guard empty, guard external URL
  - [x] Warning SEO canónico
- [x] Step 3 — Traffic & Targeting: `VariantAllocationEditor`, device/traffic-source selects, new-visitors toggle
- [x] Step 4 — Settings: preserve query params, preserve UTM, loop protection (read-only), SEO alert
- [x] Step 5 — Review: `LaunchReadinessPanel` (5 block + warn checks), URL routing summary table, sky CTA

### 4.3 Offer Test Wizard
**Archivo:** `apps/admin/src/components/offer-tests/OfferTestWizard.tsx`

Steps: Setup → Offer Type → Trigger Rules → Variant Offers → Placement → Review

- [x] Step 1 — Setup: nombre, hipótesis, hero emerald
- [x] Step 2 — Offer Type: 7 visual cards (Free Shipping, Free Gift, Volume Discount, Quantity Break, BXGY, Cart Message, Product Page Offer)
- [x] Step 3 — Trigger Rules: min subtotal, min qty, eligible products toggle, claim behavior radio
- [x] Step 4 — Variant Offers: per-type editors (threshold, free gift ID guard, tier table with ascending guard)
- [x] Step 5 — Placement: 5 checkboxes, progress bar preview widget, no-placement guard
- [x] Step 6 — Review: `LaunchReadinessPanel`, per-variant summary, emerald gradient CTA

### 4.4 Checkout Test Wizard
**Archivo:** `apps/admin/src/components/checkout-tests/CheckoutTestWizard.tsx`

Steps: Setup → Block Type → Placement → Variant Content → QA → Review

- [x] Step 1 — Setup: nombre, hipótesis, hero indigo
- [x] Step 2 — Block Type: 8 visual cards (Trust Badges, Guarantee, Shipping, Social Proof, Payment Icons, Urgency, Custom, Image+Text)
- [x] Step 3 — Placement: checkout flow diagram (Info → Shipping → Payment → Review), extension health InlineAlert
- [x] Step 4 — Variant Content: per-blockType editors, empty-content guard, HTML-injection warning
- [x] Step 5 — QA: 5-item animated checklist with progress bar
- [x] Step 6 — Review: `LaunchReadinessPanel` (7 checks), summary table, disabled CTA while blockers exist

### 4.5 Discount Test Wizard
**Archivo:** `apps/admin/src/components/discount-tests/DiscountTestWizard.tsx`

Steps: Setup → Discount Type → Eligibility → Variant Discounts → Stacking → Review

- [x] Step 1 — Setup: nombre, hipótesis, hero amber
- [x] Step 2 — Discount Type: 7 visual cards (%, Fixed, Product, Order, Shipping, Volume, BXGY)
- [x] Step 3 — Eligibility: min subtotal, min qty, product/collection targeting, per-customer limit
- [x] Step 4 — Variant Discounts: per-type value editors, tier editor with ascending guard
- [x] Step 5 — Stacking: exclusive/additive/first_only radio, info alert, high-value additive warning
- [x] Step 6 — Review: `LaunchReadinessPanel` (4 blockers + 2 warn), summary table, amber CTA

### 4.6 Shipping Test Wizard
**Archivo:** `apps/admin/src/components/shipping/ShippingTestWizard.tsx`

Steps: Setup → Shipping Strategy → Variant Config → Display → Review

- [x] Step 1 — Setup: nombre, hipótesis, hero cyan
- [x] Step 2 — Strategy: 4 visual cards (Free Threshold, Method Visibility, Method Rename, Progress Bar), Plus badge on advanced
- [x] Step 3 — Variant Config: per-strategy sub-editors per variant, `VariantAllocationEditor`
- [x] Step 4 — Display: progress bar toggle, message template with `{remaining}` hint, live preview widget
- [x] Step 5 — Review: `LaunchReadinessPanel`, summary table, cyan CTA disabled while blockers exist

### 4.7 Price Test Wizard ⚠️ High Risk
**Archivo:** `apps/admin/src/components/price-tests/PriceTestWizard.tsx`

Steps: Setup → Products → Price Matrix → Display → Enforcement → Risk Review → Review

- [x] Step 1 — Setup: nombre, hipótesis, hero rose
- [x] Step 2 — Products: product + variant IDs input, bulk import via comma-separated IDs
- [x] Step 3 — Price Matrix: table (variant rows × variant columns), compare-at price, live delta %, multi-currency + subscription guards
- [x] Step 4 — Display: checkboxes PDP, Collection, Cart, Checkout; display-only warning
- [x] Step 5 — Enforcement: DISPLAY_ONLY vs SHOPIFY_FUNCTION cards, function-deployed checkbox required to continue
- [x] Step 6 — Risk Review: persistent high-risk banner, 5-item acknowledgement checklist blocks "Continue"
- [x] Step 7 — Review: `LaunchReadinessPanel`, summary table, rose CTA disabled while blockers exist

### 4.8 Personalization Wizard
**Archivo:** `apps/admin/src/components/personalizations/NewPersonalizationForm.tsx`

Steps: Setup → Audience → Experience → Schedule → Review

- [x] Step 1 — Setup: nombre, descripción, priority; hero fuchsia with explanatory InlineAlert
- [x] Step 2 — Audience: full rule builder (10 rule types), AND-logic info alert, all-visitors warning
- [x] Step 3 — Experience: offer checkbox list, empty-offers warning, offer type + status badges
- [x] Step 4 — Schedule: datetime-local inputs, end < start guard, past-end warning, no-schedule info
- [x] Step 5 — Review: `LaunchReadinessPanel` (5 checks), summary card, fuchsia CTA disabled on blockers

---

## STEP 5 — List Page Redesigns (por tipo)

Cada list page debe tener: acento propio, empty state custom, explicación del tipo, columnas relevantes.

### 5.1 Content Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/content-tests/page.tsx`
- [x] Accent: violet `#7c3aed`, gradient header, running badge, empty state with icon + CTA
- [x] Columnas: Name · Status (animated pulse on RUNNING) · Variants · Updated · View

### 5.2 Split URL Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/split-url-tests/page.tsx`
- [x] Accent: sky `#0284c7`, gradient header, running badge, empty state with CTA
- [x] Columnas: Name · Status · Base URL (monospace) · Variants · Updated · View

### 5.3 Offer Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/offer-tests/page.tsx`
- [x] Accent: emerald `#059669`, gradient header, running badge, empty state with CTA
- [x] Columnas: Name · Status · Variants · Updated · View

### 5.4 Checkout Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/checkout-tests/page.tsx`
- [x] Accent: indigo `#4f46e5`, gradient header, running badge, empty state with CTA
- [x] Columnas: Name · Status · Variants · Updated · View

### 5.5 Discount Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/discount-tests/page.tsx`
- [x] Accent: amber `#d97706`, gradient header, running badge, empty state with CTA
- [x] Columnas: Name · Status · Variants · Updated · View

### 5.6 Shipping Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/shipping-tests/page.tsx`
- [x] Accent: cyan `#0891b2`, gradient header, running badge, empty state with CTA
- [x] Columnas: Name · Status · Variants · Updated · View

### 5.7 Price Tests List
**Archivo:** `apps/admin/src/app/(dashboard)/price-tests/page.tsx`
- [x] Accent: rose `#e11d48`, gradient header, running badge, empty state with CTA
- [x] Columnas: Name · Status · Variants · Updated · View

### 5.8 Personalizations List
**Archivo:** `apps/admin/src/app/(dashboard)/personalizations/page.tsx`
- [x] Accent: fuchsia `#c026d3`, gradient header, active badge (pulse), empty state with CTA
- [x] Columnas: Name · Status · Priority · Offers · Schedule · Actions (analytics + menu)

---

## STEP 6 — Detail Page Redesigns (por tipo)

Todos comparten: breadcrumb, header, status badge, acciones, tabs, analytics, audit log. Pero con summary cards únicas.

### 6.1 Content Test Detail
- [ ] Summary cards: Target Pages · Active Modifications · Selector Health · Anti-flicker Status · Current Leader
- [ ] Tab: Modifications (lista con tipo y selector)
- [ ] Tab: Analytics (page views, ATC rate, CVR, RPV)
- [ ] Tab: QA / Health

### 6.2 Split URL Test Detail
- [ ] Summary cards: Control URL · Variant URL Count · Redirect Health · Loop Protection · Landing CVR
- [ ] Tab: URL Routes (tabla)
- [ ] Tab: Analytics (sessions by URL, landing CVR, revenue/session)
- [ ] Tab: QA / Health

### 6.3 Offer Test Detail
- [ ] Summary cards: Offer Type · Claim Rate · Revenue Influenced · Cart Display Status · Current Leader
- [ ] Tab: Offer Config
- [ ] Tab: Analytics (offer views, claim rate, AOV, revenue)
- [ ] Tab: QA / Health

### 6.4 Checkout Test Detail
- [ ] Summary cards: Block Type · Placement · Extension Health · Block Impressions · Checkout CVR
- [ ] Tab: Block Config
- [ ] Tab: Analytics (impressions, checkout CVR, orders, revenue)
- [ ] Tab: QA / Health
- [ ] Guard banner si Extension no está instalada

### 6.5 Discount Test Detail
- [ ] Summary cards: Discount Type · Avg Discount · Discount Cost · Revenue Lift · Function Health
- [ ] Tab: Discount Config
- [ ] Tab: Analytics (discount cost, revenue lift, profit lift, redemption rate)
- [ ] Tab: QA / Health

### 6.6 Shipping Test Detail
- [ ] Summary cards: Strategy · Threshold/Method · Shipping Revenue · AOV Impact · Delivery Function Health
- [ ] Tab: Shipping Config
- [ ] Tab: Analytics (shipping revenue, AOV, CVR, free shipping eligibility rate)
- [ ] Tab: QA / Health

### 6.7 Price Test Detail ⚠️
- [ ] Summary cards: Product Count · Price Range · Margin Impact · Profit/Visitor · Risk Level · Rollout State
- [ ] Price matrix table
- [ ] Rollout / Rollback panel con doble confirmación
- [ ] Risk banner siempre visible si status = RUNNING
- [ ] Gross margin impact simulation
- [ ] Tab: Price Config
- [ ] Tab: Analytics (RPV, profit/visitor, gross margin, CVR, AOV, price elasticity hint)
- [ ] Tab: Audit Log
- [ ] Tab: QA / Health
- [ ] Warning si checkout mismatch (display-only + real price issue)

### 6.8 Personalization Detail
- [ ] Summary cards: Audience · Priority · Impressions · Conflicts · Publish State
- [ ] Tab: Experience Config
- [ ] Tab: Analytics (impressions, engagement, revenue)
- [ ] Tab: QA / Health

---

## STEP 7 — Launch Readiness System (global)

- [ ] Crear `apps/admin/src/lib/launchReadiness.ts`
  - Funciones: `getBlockingIssues()`, `getWarnings()`, `getRecommendations()`, `getPassedChecks()`, `getReadinessScore()`
  - Por cada tipo de test: checks específicos
- [ ] `LaunchReadinessPanel` component (ver Step 2.5)
- [ ] Integrar en Review step de cada wizard
- [ ] Integrar en detail page (sidebar o tab dedicado)

**Checks globales obligatorios:**
- [ ] ≥ 2 variantes para experiments
- [ ] 1 variante control
- [ ] Traffic allocation suma = 100
- [ ] No variantes idénticas
- [ ] Tracking health no roto (o override explícito)
- [ ] Extensions/Functions requeridas disponibles (o override)

**Checks por tipo:**
- [ ] Price: Risk Review confirmado, precio > 0, checkout enforcement configurado
- [ ] Split URL: URLs válidas, no duplicadas, loop protection
- [ ] Content: targeting URL required, selector no vacío, ≥1 mod en no-control
- [ ] Checkout: extension instalada, placement seleccionado, contenido no vacío
- [ ] Shipping: function disponible, threshold > 0, método matcher configurado
- [ ] Discount: function config disponible, valor > 0, stacking rules explícitas
- [ ] Offer: tipo seleccionado, placement seleccionado, trigger rules válidas
- [ ] Personalization: audience configurada, modificaciones presentes, priority set

---

## STEP 8 — Guards & Edge Cases (UI)

- [x] Banner: "Shopify Checkout UI Extension not installed" con link a `/install-health`
- [ ] Banner: "Web Pixel not active" con link a install
- [ ] Banner: "Theme App Embed disabled"
- [x] Banner: "Shopify Function outdated or not deployed"
- [ ] Estado: "No events received yet" con guía de debug
- [ ] Estado: "No orders attributed yet" con guía
- [ ] Estado: "Insufficient sample size" con cálculo de tiempo estimado
- [ ] Estado: "Running test with zero traffic"
- [ ] Guard modal: "Discard unsaved changes?"
- [ ] Guard modal: "Archive running test?"
- [ ] Guard modal: "Roll out winner — this is irreversible"
- [ ] Guard modal: "Edit high-risk setting on running test"
- [ ] Guard inline: product deleted
- [ ] Guard inline: variant deleted
- [ ] Guard inline: collection deleted
- [ ] Guard inline: duplicate URLs (Split URL)
- [ ] Guard inline: invalid selector (Content)
- [ ] Guard inline: free gift product missing (Offer)
- [ ] Guard inline: discount stacking conflict
- [ ] Guard inline: multi-currency store (Price)
- [ ] Guard inline: subscription product detected (Price)
- [ ] Guard inline: price delta unusually large (Price, >50%)

---

## STEP 9 — Empty, Error & Loading States

- [ ] Empty state por cada test type list (acento + copy propio + CTA)
- [ ] Loading skeleton en todas las tablas y grids de métricas
- [ ] Error state en analytics (con retry)
- [ ] Error state en wizard (con mensaje específico)
- [ ] Error state en detail page (recurso no encontrado vs error de servidor)
- [x] Toast de éxito en: crear test, activar, pausar, archivar, rollout, save draft
- [x] Toast de error con mensaje de API
- [ ] Disabled state con tooltip que explica por qué está deshabilitado

---

## STEP 10 — Coming Soon Pages (Template, Theme, Post-purchase)

- [x] `apps/admin/src/app/(dashboard)/template-tests/page.tsx` — 5 features list, slate accent, ComingSoonPage component
- [x] `apps/admin/src/app/(dashboard)/theme-tests/page.tsx` — 5 features list, zinc accent
- [x] `apps/admin/src/app/(dashboard)/personalizations/post-purchase/page.tsx` — 5 features list, fuchsia accent
- [x] `apps/admin/src/components/ui/ComingSoonPage.tsx` — shared reusable component
- [x] Rutas en sidebar (Templates, Themes) con "soon" badge; Post-purchase como link clickable

---

## STEP 11 — Sidebar Polish

- [x] Agregar Template Tests como disabled/coming-soon con dot slate
- [x] Agregar Theme Tests como disabled/coming-soon con dot zinc
- [x] Post-purchase Personalizations como link clickable con "soon" badge
- [x] Verificar y actualizar colores de dot en `TEST_TYPE_DOTS` para coincidir con `testTypeTheme.ts`
- [x] Corregir `/personalization-tests` link → `/personalizations`
- [ ] Quick find (⌘K) — conectar a funcionalidad real o eliminar el button si no hay implementación

---

## STEP 12 — Copy & UX Text

- [ ] Cada wizard tiene nombre propio específico (no "Create Test")
  - "Create Content Test" · "Create Split URL Test" · "Create Price Test" · etc.
- [ ] Cada step tiene label propio (no "Next" genérico)
- [ ] Hipótesis examples por tipo (ver plantillas en este archivo abajo)
- [ ] Placeholders específicos en cada input
- [ ] Empty state copy único por tipo
- [ ] Guard messages específicos (no "Error occurred")
- [ ] Toast messages específicos

---

## STEP 13 — Accessibility & Responsive

- [ ] Todos los forms tienen labels correctos (`<label for>` o `aria-label`)
- [ ] Todos los botones disabled tienen `title` explicando por qué
- [ ] Focus visible en todos los elementos interactivos
- [ ] Color no es el único indicador de estado
- [ ] Modals y drawers hacen focus trap
- [ ] Wizard preview panel stacks below form en mobile
- [ ] Tablas son scrollables horizontalmente en mobile
- [ ] Sticky action bar funciona en mobile
- [ ] Touch targets ≥ 44px

---

## STEP 14 — TypeScript & Performance

- [ ] `npx tsc --noEmit` — 0 errores en `apps/admin`
- [ ] Sin `any` explícito (usar `unknown` o tipos propios)
- [ ] Wizard validation memoizada si deriva de estado pesado
- [ ] Preview components lazy-loaded si tienen dependencias pesadas
- [ ] Sin re-renders innecesarios en stepper (useCallback en handlers)
- [ ] Animaciones CSS-first (transition, transform), no JS animation loops

---

## STEP 15 — Final QA Audit

- [ ] Cada test type se siente diferente visualmente
- [ ] No hay dos wizards con el mismo layout/form sin customización
- [ ] Cada tipo tiene su acento de color consistentemente aplicado
- [ ] No hay texto genérico ("Submit", "Next", "Error")
- [ ] No hay estados vacíos en blanco sin mensaje
- [ ] No hay spinners indefinidos sin timeout
- [ ] Verificar rutas en sidebar todas funcionan
- [ ] Verificar CTAs en `/get-inspired` llevan a los wizards correctos
- [ ] Verificar breadcrumbs en detail pages y wizards
- [ ] Verificar que crear → ver en list funciona
- [ ] Verificar que activar/pausar actualiza status en UI sin reload
- [ ] Verificar que guardar draft no rompe el wizard state

---

## Reference: Example Hypotheses by Type

```
Shipping:
  name: "Free Shipping Threshold Test"
  hypothesis: "Lowering the free shipping threshold from $75 to $50 will increase
               checkout completion without reducing profit per visitor."

Price:
  name: "Premium Price Sensitivity Test"
  hypothesis: "Increasing the hero product price by 8% will improve gross profit
               per visitor without materially reducing conversion rate."

Checkout:
  name: "Checkout Trust Badge Test"
  hypothesis: "Adding payment security badges above the payment step will increase
               checkout completion rate."

Offer:
  name: "Free Gift Threshold Test"
  hypothesis: "Offering a free gift above $80 will increase AOV and revenue per visitor."

Content:
  name: "Hero Value Proposition Test"
  hypothesis: "Changing the hero headline to emphasize fast shipping will increase
               add-to-cart rate."

Split URL:
  name: "Landing Page Layout Test"
  hypothesis: "Sending paid traffic to the long-form landing page will increase
               conversion rate compared to the standard PDP."

Discount:
  name: "10% vs $15 Discount Test"
  hypothesis: "A fixed $15 discount will create higher perceived value than 10% off,
               increasing conversion without hurting revenue per visitor."

Personalization:
  name: "Returning Visitor Offer"
  hypothesis: "Showing returning visitors a cart-specific incentive will increase
               purchase completion rate."
```

---

## Reference: Files to Modify per Test Type

| Test Type | Wizard | List Page | Detail Page | Config |
|-----------|--------|-----------|-------------|--------|
| Content | `components/content-tests/ContentTestWizard.tsx` | `app/(dashboard)/content-tests/page.tsx` | `app/(dashboard)/content-tests/[id]/page.tsx` | `config/testTypes/contentTestConfig.ts` |
| Split URL | `components/experiments/SplitUrlWizard.tsx` | `app/(dashboard)/split-url-tests/page.tsx` | `app/(dashboard)/split-url-tests/[id]/page.tsx` | `config/testTypes/splitUrlTestConfig.ts` |
| Offers | `components/offer-tests/OfferTestWizard.tsx` | `app/(dashboard)/offer-tests/page.tsx` | `app/(dashboard)/offer-tests/[id]/page.tsx` | `config/testTypes/offerTestConfig.ts` |
| Checkout | `components/checkout-tests/CheckoutTestWizard.tsx` | `app/(dashboard)/checkout-tests/page.tsx` | `app/(dashboard)/checkout-tests/[id]/page.tsx` | `config/testTypes/checkoutTestConfig.ts` |
| Discounts | `components/discount-tests/DiscountTestWizard.tsx` | `app/(dashboard)/discount-tests/page.tsx` | `app/(dashboard)/discount-tests/[id]/page.tsx` | `config/testTypes/discountTestConfig.ts` |
| Shipping | `components/shipping/ShippingTestWizard.tsx` | `app/(dashboard)/shipping-tests/page.tsx` | `app/(dashboard)/shipping-tests/[id]/page.tsx` | `config/testTypes/shippingTestConfig.ts` |
| Price | `components/price-tests/PriceTestWizard.tsx` | `app/(dashboard)/price-tests/page.tsx` | `app/(dashboard)/price-tests/[id]/page.tsx` | `config/testTypes/priceTestConfig.ts` |
| Personalizations | `components/personalizations/NewPersonalizationForm.tsx` | `app/(dashboard)/personalizations/page.tsx` | `app/(dashboard)/personalizations/[id]/page.tsx` | `config/testTypes/personalizationConfig.ts` |

---

> **Próximo paso sugerido:** Empezar por STEP 2 (Design System Foundation) para tener primitivos reutilizables antes de tocar los wizards.
> Luego atacar wizards en orden de menor a mayor riesgo: Split URL → Content → Checkout → Offers → Discounts → Shipping → Price.
