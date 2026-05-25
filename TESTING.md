You are a senior QA automation engineer, senior full-stack engineer, Shopify app architect, TypeScript testing expert, and reliability engineer.

Context:
This repository contains MarginLab, a Shopify experimentation platform with multiple advanced features:
- Content Tests
- Split URL Tests
- Offer Tests
- Checkout Tests
- Discount Tests
- Shipping Tests
- Price Tests
- Template Tests
- Theme Tests
- Post-purchase Personalizations
- Personalizations
- Analytics
- Attribution
- Storefront runtime
- Theme App Extension
- Web Pixel
- Checkout UI Extension
- Shopify Functions
- Price rollout / rollback
- Install Health
- Debug tools
- App Store readiness / custom app target adapters where applicable

Main goal:
Build a comprehensive, production-grade test suite across the entire MarginLab repo.

Do not write superficial tests.
Do not only test happy paths.
Do not skip edge cases.
Do not mock everything so heavily that tests become meaningless.
Do not change production behavior just to make tests pass.
Do not remove existing tests.
Do not bypass failing tests.
Do not delete validations or guards.
Do not test implementation details when behavior can be tested.
Do not expose secrets in tests.
Do not require real Shopify API keys, real Google/AI keys, real production DBs, or real stores to run the default test suite.

Before writing tests:
Audit the repository and produce a testing plan.

Read and inspect:
- package.json
- workspace config
- test framework setup
- existing tests
- app routes
- API routes
- services
- Prisma schema
- Shopify extension folders
- Shopify Functions
- runtime/storefront code
- analytics/event pipeline
- attribution logic
- validation schemas
- wizard components
- feature flags / target adapters
- CI config
- environment examples

First output:
1. Current test framework detected.
2. Existing test commands.
3. Existing test files.
4. Missing test coverage by feature.
5. Recommended test structure.
6. Test data/factory strategy.
7. Mocking strategy.
8. Critical path matrix.
9. Step-by-step implementation plan.

After that, implement tests.

Testing philosophy:
Use a testing pyramid:
- Unit tests for pure logic, schemas, guards, assignment, validation, analytics calculations, pricing math, and utility functions.
- Integration tests for services, API routes, Prisma-backed flows, auth adapters, runtime config, and orchestration.
- Component tests for complex UI flows where applicable.
- E2E tests for critical merchant and shopper flows, using mocks where external Shopify systems cannot be used.
- Contract tests for runtime payloads, webhook payloads, Shopify Function inputs/outputs, and public APIs.
- Regression tests for known risky areas.

Recommended testing tools:
Use whatever is already installed if the repo has a test stack.

If no test framework exists, recommend and add a minimal modern setup:
- Vitest for unit/integration tests.
- React Testing Library for React components.
- Playwright for E2E flows if the app has browser flows.
- MSW or fetch mocks for external API calls.
- Prisma test DB setup using an isolated test database or SQLite test DB if compatible.
- Factory helpers for creating shops, sessions, experiments, variants, orders, events, products, and assignments.

Do not add a heavy testing stack unless justified.
Keep tests runnable in CI.

Required root scripts if missing:
- test
- test:unit
- test:integration
- test:e2e
- test:watch
- test:coverage
- test:ci

Also ensure existing commands still pass:
- typecheck
- lint
- build
- prisma generate
- Shopify extension/function build commands if applicable

Test folder structure:
Adapt to the repo, but prefer something like:

tests/
  unit/
    schemas/
    services/
    guards/
    analytics/
    attribution/
    runtime/
    functions/
  integration/
    api/
    services/
    prisma/
    runtime/
    webhooks/
  e2e/
    admin/
    storefront/
    checkout/
  fixtures/
  factories/
  mocks/
  helpers/

or colocated tests if the repo already uses that pattern.

Test data strategy:
Create factories/helpers for:
- shop
- session
- merchant
- experiment
- test variant
- traffic allocation
- content test
- split URL test
- offer test
- checkout test
- discount test
- shipping test
- price test
- personalization
- template test
- theme test
- post-purchase personalization
- runtime assignment
- visitor/session
- product
- variant
- collection
- cart
- checkout
- order
- refund
- event
- attribution record
- COGS record
- Shopify function config
- webhook payload
- install health status

Factories should:
- produce valid defaults
- allow overrides
- avoid duplication
- make edge cases easy to create
- never include real credentials

Mocking strategy:
Mock these by default:
- Shopify Admin API
- Shopify Storefront API
- Shopify MCP if applicable
- Shopify billing
- Shopify webhooks
- Shopify Functions runtime where unit testing JS/TS wrappers
- Web Pixel events
- Checkout extension APIs
- fetch/sendBeacon
- Redis
- ClickHouse
- Sentry/Axiom/logging
- AI providers if any
- Date/time using fixed time helpers

Do not mock:
- pure business logic
- schema validation
- traffic allocation math
- analytics calculations
- attribution matching logic
- launch readiness guards
- destructive action guards

Global test requirements:
Every test type should include:
- schema validation tests
- service tests
- API route tests
- list/detail/new page tests where applicable
- wizard validation tests
- launch guard tests
- activation/pause tests
- analytics tests
- edge cases
- malformed payload tests
- authorization/tenant isolation tests

Multi-tenant security tests:
For every API/service:
- A shop cannot read another shop’s tests.
- A shop cannot update another shop’s tests.
- A shop cannot delete/archive another shop’s tests.
- A shop cannot read another shop’s analytics.
- Runtime config only returns data for the correct shop.
- Webhook handling does not cross shops.
- Public endpoints do not leak secrets.
- Admin API tokens are never returned in payloads.

Auth/session tests:
- valid embedded admin session passes
- missing session fails
- expired session fails
- invalid shop domain fails
- HMAC validation passes for valid callback
- HMAC validation fails for tampered callback
- uninstall cleans session safely
- reinstall does not duplicate corrupt data

Environment/target adapter tests:
If the repo supports standalone and checkout-redo-engine/custom-app target modes:
- standalone target enables public app behavior
- custom app target disables App Store-only behavior
- billing can be feature-flagged off
- public app OAuth does not leak into custom app mode
- custom app assumptions do not leak into standalone mode
- target-specific env validation works
- missing required env vars produce helpful errors
- secrets are never logged

Feature: Content Tests
Unit tests:
- validates name/hypothesis
- requires at least one target page/rule
- requires at least two variants
- requires control variant
- non-control variants require modifications
- validates selector-based modification needs selector
- validates text replacement needs replacement text
- validates image replacement needs URL/alt warning
- validates HTML insert is sanitized
- JS injection requires explicit acknowledgement
- traffic allocation must be valid
- variant allocations must sum correctly
- all variants cannot be identical

Service/API tests:
- create content test
- update content test
- list content tests
- read detail
- activate
- pause
- archive/delete if supported
- duplicate if supported
- rejects invalid payload
- rejects cross-shop access

Runtime tests:
- applies text replacement
- applies image replacement
- hides/shows element
- handles missing selector gracefully
- anti-flicker timeout always releases page
- does not throw on malformed DOM
- does not apply modifications on non-target page
- sends assignment/render events

Edge cases:
- selector exists multiple times
- selector missing
- target URL with query params
- mobile-only targeting
- conflicting modifications
- unsafe HTML
- JS injection disabled
- no active variants
- stale runtime config

Feature: Split URL Tests
Tests:
- validates control URL
- validates variant URLs
- rejects duplicate URLs
- rejects variant URL equal to control URL
- rejects invalid URL
- preserves UTM by default
- preserves query params when enabled
- loop protection enabled
- does not redirect checkout/cart paths unless explicitly allowed
- handles external URLs with warning/override
- assignment persists
- redirect event logged
- conversion attribution survives redirect
- no redirect loop
- pause stops redirects

Edge cases:
- trailing slash differences
- encoded URLs
- relative vs absolute URLs
- cross-domain redirect
- UTM-heavy URL
- hash fragments
- bot user-agent
- preview mode

Feature: Offer Tests
Tests:
- validates offer type
- validates trigger rules
- validates display placement
- validates free gift product required
- validates threshold amount
- validates quantity tiers ascending
- validates campaign link slug
- validates discount behavior
- offer preview data correct
- cart drawer placement config correct
- product page placement config correct
- claim event tracked
- offer view event tracked
- discount behavior matches checkout expectation

Edge cases:
- free gift out of stock
- duplicate gift in cart
- threshold exactly met
- threshold below/above
- quantity decrement removes eligibility
- campaign link shared
- conflicting offers
- offer disabled while active cart exists
- AJAX cart does not refresh automatically

Feature: Checkout Tests
Tests:
- validates block type
- validates placement
- validates variant content
- blocks unsafe HTML/JS
- checks checkout extension health
- renders correct block by assignment
- fallback when no assignment
- mobile/desktop preview data
- block impression event
- checkout completion attribution
- pause stops block rendering

Edge cases:
- missing checkout extension
- unavailable placement
- content too long
- unknown assignment
- multiple checkout tests active
- custom HTML attempted
- checkout extension config outdated

Feature: Discount Tests
Tests:
- validates discount type
- percentage between 1 and 100
- fixed amount greater than 0
- product discount requires product/collection
- minimum subtotal cannot be negative
- stacking rule required
- discount title required
- function config valid
- eligible cart gets discount
- ineligible cart does not
- discount cost analytics correct
- order attribution includes discount cost

Edge cases:
- discount exceeds cart value
- stacking conflict
- multiple products eligible
- mixed eligible/ineligible cart
- shipping discount not supported
- currency mismatch
- function config missing
- paused test still has stale function config

Feature: Shipping Tests
Tests:
- validates strategy
- validates free shipping threshold
- threshold cannot be negative
- currency required
- method matcher required for method strategy
- prevents hiding all shipping methods
- progress bar config valid
- delivery customization health checked
- shipping discount function health checked
- progress bar below threshold
- progress bar above threshold
- checkout method renamed
- checkout method hidden
- shipping analytics: AOV, CVR, shipping revenue

Edge cases:
- no shipping methods match
- multiple shipping methods match
- all methods would be hidden
- country-specific rates
- multi-currency
- threshold exactly equals subtotal
- cart subtotal changes
- free shipping message mismatch

Feature: Price Tests
High-risk area. Write extensive tests.

Validation tests:
- requires product/variant selection
- requires control price
- requires test price
- price > 0
- variant price cannot equal control for all variants
- currency required
- display surface required
- checkout enforcement mode required
- risk review confirmation required
- rollout strategy required if rollout enabled

Display/enforcement tests:
- PDP price preview
- collection price preview
- cart price preview
- checkout behavior summary
- display-only warning
- discount-based enforcement config
- function-backed enforcement config if supported
- multi-currency warning
- subscription warning
- discount stacking warning

Rollout/rollback tests:
- rollout requires double confirmation
- rollout creates backup
- rollout writes audit log
- rollout updates correct Shopify product/variant only
- rollout rejects stale data
- rollback uses backup
- rollback within allowed window succeeds
- rollback after expiration fails
- rollback writes audit log
- rollback cannot run twice if unsafe
- failed rollout leaves recoverable state
- partial rollout is detected

Analytics tests:
- revenue per visitor
- profit per visitor
- gross margin
- AOV
- conversion rate
- price elasticity hint if implemented
- missing COGS warning
- refund impact

Edge cases:
- deleted product
- deleted variant
- product has many variants
- subscription product
- multi-currency store
- compare-at price
- discount stacking
- test paused during rollout
- concurrent rollout requests
- Shopify API rate limit
- Admin API failure mid-rollout

Feature: Personalizations
Tests:
- validates type
- validates audience
- validates priority
- validates schedule
- validates modifications/rules
- conflict with running tests detected
- high-priority override warning
- render only to matching audience
- impression event tracked
- publish/unpublish works

Edge cases:
- overlapping audiences
- expired schedule
- future schedule
- no audience
- conflicting personalization priority
- personalization on same page as test

Feature: Template Tests
Tests if implemented:
- validates template selection
- validates variants
- detects conflict with active template test
- assignment returns correct template behavior
- analytics tracked

Coming soon behavior if not fully implemented:
- cannot create functional test
- shows coming soon page
- no broken route
- no fake launch action

Feature: Theme Tests
Tests if implemented:
- fetch themes
- select control and variant theme
- risk review required
- snippet generation
- theme publish auto-pause
- assignment behavior
- high-risk warnings

Edge cases:
- theme deleted
- theme unpublished
- theme publish webhook received
- snippet missing
- incorrect theme ID
- merchant changes theme while test running

Feature: Post-purchase
Tests:
- feature only visible when supported
- unsupported store gets explanation
- audience validation
- offer validation
- render/attribution if supported
- fallback when extension unavailable

Analytics/Event Pipeline
Tests:
- event ingestion validates payload
- invalid payload rejected
- bot traffic handled
- duplicate events deduped
- visitor/session deduplication
- assignment attached to event
- event batch accepted
- event batch size limit
- sendBeacon payload accepted
- custom events registered
- unregistered custom events warn, not crash
- events are shop-scoped
- events update daily metrics
- event ingestion does not leak secrets

Attribution
Tests:
- attribution by visitor ID
- attribution by session ID
- attribution by cart token
- attribution by checkout token
- attribution by order webhook data
- multi-experiment attribution
- assignment expiration
- unattributed order handling
- attribution confidence
- refund updates metrics
- cancelled orders update metrics
- test orders excluded or flagged
- duplicate webhook idempotency
- out-of-order webhook handling
- webhook retry idempotency

COGS/Profit
Tests:
- product COGS sync
- variant COGS sync
- CSV import
- invalid CSV rows
- manual COGS override
- missing COGS warning
- shipping cost estimate
- transaction fee estimate
- gross profit formula
- contribution margin formula
- discount cost impact
- refund impact
- profit per visitor

Runtime Config
Tests:
- returns active tests only
- returns correct shop config
- excludes secrets
- stale-while-revalidate behavior if implemented
- handles no active tests
- handles runtime config API failure
- handles paused tests
- handles scheduled tests
- handles completed tests
- cache invalidation after update
- rate limit public endpoint
- CORS/origin validation

Storefront Runtime
Tests:
- assignment created
- assignment persists
- traffic allocation respected statistically or deterministically in controlled sample
- sticky assignment
- handles no localStorage
- handles blocked cookies/localStorage
- handles sendBeacon missing
- fetch fallback works
- anti-flicker timeout works
- DOM mutation observer does not loop
- cart sync works
- checkout propagation works
- runtime does not throw on malformed config
- runtime does not block page render
- disabled feature does not render

Web Pixel
Tests:
- receives core Shopify events
- maps page_viewed
- maps product_viewed
- maps collection_viewed
- maps product_added_to_cart
- maps cart_viewed
- maps checkout_started
- maps checkout_completed
- includes assignment data
- respects privacy/consent flags
- handles missing assignment
- handles duplicate events

Checkout UI Extension
Tests:
- renders correct block by assignment
- handles no assignment
- handles missing config
- handles invalid config
- emits impression event
- does not allow unsafe HTML/JS
- handles long text
- handles mobile layout assumptions
- never blocks checkout completion

Shopify Functions
Test every function with fixture inputs/outputs.

Product/Price function:
- assignment match
- no assignment
- invalid assignment
- eligible product
- ineligible product
- multiple cart lines
- quantity changes
- high quantity
- config version mismatch

Order Discount function:
- percentage
- fixed
- product discount
- order discount
- eligibility
- minimum subtotal
- minimum quantity
- stacking behavior
- discount title

Shipping Discount function:
- free shipping threshold
- threshold not met
- threshold exactly met
- threshold exceeded
- country/currency behavior
- missing config

Delivery Customization function:
- rename method
- hide method
- reorder method
- no matcher
- multiple matchers
- prevent hiding all methods
- fallback safe behavior

Webhooks
Tests:
- app uninstall
- shop redact
- customers data request
- customers redact
- orders create/update/paid/cancelled/refunded
- themes publish if used
- HMAC valid
- HMAC invalid
- idempotency
- malformed payload
- missing shop
- unknown webhook topic
- retry-safe behavior

Install Health / Debug
Tests:
- theme app embed active/inactive
- web pixel active/inactive
- checkout extension active/inactive
- functions active/outdated
- runtime receiving events
- last event timestamp
- last order attribution
- missing dependency shows actionable message
- debug page does not expose secrets
- developer-only info hidden when needed

UI/Wizard Tests
For every wizard:
- empty initial state
- valid draft save
- invalid draft save behavior
- next disabled when current step invalid
- step status calculation
- review screen warnings
- launch readiness score
- launch blocked by errors
- launch allowed with non-blocking warnings after acknowledgement
- unsaved changes guard
- loading state
- API error state
- duplicate action
- pause action
- archive/delete confirmation

Accessibility:
- fields have labels
- errors associated with fields
- buttons accessible
- focus visible
- keyboard navigation for stepper
- modal focus trap where applicable
- no color-only status

API Robustness
For every API route:
- valid payload accepted
- invalid payload rejected
- missing auth rejected
- wrong shop rejected
- malformed JSON rejected
- unsupported method rejected
- idempotency where needed
- rate limit where public
- returns stable error shape
- never returns secrets
- handles DB error gracefully
- handles Shopify API error gracefully

Concurrency tests:
- two launches at same time
- two rollout requests at same time
- pause while launch in progress
- update while running
- duplicate webhook delivery
- simultaneous event batches
- stale config write
- optimistic lock or version mismatch where implemented

Performance tests where reasonable:
- analytics aggregation with many events
- runtime config with many active tests
- wizard validation with many variants/products
- price matrix with many variants
- event batch processing
- no obvious O(n^2) issues on large lists

Snapshot tests:
Avoid broad brittle snapshots.
Only use targeted snapshots for:
- stable Shopify Function outputs
- stable runtime config contract
- analytics calculation output
- webhook normalized payloads

Coverage expectations:
Aim for meaningful coverage, not fake 100%.

Minimum target:
- critical business logic: 90%+
- schemas/guards: 90%+
- services: 80%+
- UI components: focus on critical flows
- runtime/functions: high confidence with fixture tests

CI requirements:
Add or update CI to run:
- install
- prisma generate
- typecheck
- lint
- unit tests
- integration tests
- build
- function tests
- extension build if feasible

CI must not require real Shopify credentials.
Use mock env vars in CI.

Deliverables:
1. Testing plan document:
   - docs/TESTING_STRATEGY.md
   - docs/QA_MATRIX.md if missing
2. Test setup/config files.
3. Factories/fixtures/mocks.
4. Unit tests.
5. Integration tests.
6. E2E tests where feasible.
7. CI update.
8. Coverage report command.
9. Final summary of coverage by feature.
10. List of intentionally untested areas and why.
11. List of tests that require real Shopify QA/manual validation.

Execution order:
1. Audit existing test setup.
2. Add testing docs.
3. Add test helpers/factories.
4. Add schema/guard unit tests.
5. Add service unit tests.
6. Add API integration tests.
7. Add runtime tests.
8. Add Shopify Function fixture tests.
9. Add analytics/attribution tests.
10. Add critical UI tests.
11. Add E2E/manual QA specs.
12. Update CI.
13. Run full validation.
14. Fix failures caused by real bugs.
15. Do not hide failures.

Final validation commands:
Run the repo’s actual commands, but include:
- npm run typecheck or equivalent
- npm run lint
- npm run test
- npm run test:coverage
- npm run build
- prisma generate
- function build/tests if available
- extension build if available

If tests reveal bugs:
- Fix the bug if clearly in scope.
- Add regression test.
- Do not weaken the test to pass.
- Document any remaining issue.

At the end, provide:
- tests added
- files changed
- commands run
- passing/failing status
- coverage summary
- known gaps
- manual Shopify QA checklist
