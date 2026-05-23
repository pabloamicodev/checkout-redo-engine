You are a senior Shopify app architect, monorepo engineer, migration engineer, and full-stack TypeScript/React developer.

Context:
We now need to support two versions of MarginLab:

1. Standalone MarginLab repository
- This repo already exists.
- It includes the latest changes from today's session.
- It is being prepared to work as a Shopify Public App / Shopify App Store-ready app.
- It should remain the long-term clean standalone MarginLab product.

2. Checkout Redo Engine embedded version
- MarginLab also needs to work inside the existing `checkout-redo-engine` custom Shopify app.
- That custom app is already installed as a Shopify custom app.
- This version does not need Shopify App Store install flow.
- It needs to run inside the existing Checkout Redo Engine app architecture.

Main objective:
Create a safe dual-version strategy so MarginLab can exist in both places:

- Standalone public-app-ready MarginLab repo.
- Integrated custom-app version inside checkout-redo-engine.

Important:
Do not blindly copy files.
Do not break the standalone MarginLab repo.
Do not break checkout-redo-engine.
Do not mix App Store-specific behavior into the custom app version unless it is harmless.
Do not remove App Store readiness work from the standalone repo.
Do not force checkout-redo-engine to behave like a public Shopify App.
Do not force standalone MarginLab to depend on checkout-redo-engine.
Do not create two divergent codebases without a clear sync strategy.
Do not commit secrets.
Do not copy `.env`, `.env.local`, API keys, Shopify secrets, DB URLs, Redis URLs, or production credentials.

The correct approach should be:
- Audit both repos.
- Identify what changed in standalone MarginLab today.
- Identify what MarginLab code already exists inside checkout-redo-engine, if any.
- Determine what must be synced into checkout-redo-engine.
- Create adapters/config differences for each target.
- Keep shared MarginLab product/business/UI logic as consistent as possible.
- Keep environment-specific installation/auth/deployment logic separated.

Before making changes:
Create a detailed migration/sync plan only.

Do not modify files yet.
Do not copy files yet.
Do not delete files yet.
Do not run git commits.
Do not push anything.
Read-only inspection commands are allowed.

Repos to inspect:
- Standalone MarginLab repo
- checkout-redo-engine repo

Task 1 — Audit standalone MarginLab repo

Inspect and document:
- Current root path.
- Package manager.
- Framework.
- Workspace/monorepo structure.
- Admin app structure.
- API route structure.
- Services structure.
- Prisma schema and migrations.
- Shopify app config files.
- Shopify extensions.
- Web Pixel.
- Checkout UI Extension.
- Shopify Functions.
- Theme/runtime extension.
- Analytics/event pipeline.
- Attribution system.
- Billing/App Store readiness logic.
- Environment variables.
- Docs.
- CI/CD.
- Latest changed files from today's session.
- Git status and branch.
- Commit history if relevant.

Task 2 — Audit checkout-redo-engine repo

Inspect and document:
- Current root path.
- Package manager.
- Framework.
- Existing Shopify custom app architecture.
- Existing auth/session model.
- Existing API route conventions.
- Existing services structure.
- Existing database/Prisma schema.
- Existing Shopify extensions/functions.
- Existing checkout-related logic.
- Existing deployment setup.
- Existing environment variables.
- Existing MarginLab-related files if any.
- Existing app scopes/permissions.
- Existing installed custom app assumptions.
- Git status and branch.

Task 3 — Identify target differences

Create a comparison table:

| Area | Standalone MarginLab | Checkout Redo Engine Version | Sync Strategy |
|---|---|---|---|
| Shopify install | Public App / App Store | Custom app already installed | Separate adapters |
| OAuth | Public app OAuth | Existing custom app auth/session | Use target adapter |
| Billing | Shopify Billing/App Store-ready | Probably disabled/not needed | Feature flag |
| App config | shopify.app.toml public app | Existing custom app config | Do not overwrite blindly |
| Extensions | MarginLab extensions | Existing checkout app extensions | Merge carefully |
| DB | Standalone schema | Existing checkout schema | Add namespaced models |
| Env vars | Public app env | Custom app env | Separate `.env.example` |
| Runtime | Public app runtime | Existing custom app runtime | Adapter/config |
| Analytics | MarginLab analytics | Must work in checkout app | Shared logic |
| UI | MarginLab admin | Embedded in checkout app admin | Reuse components where possible |

Task 4 — Define architecture for dual-version support

Recommend the safest architecture.

Options to evaluate:

Option A — Full copy into checkout-redo-engine
- Copy MarginLab code into checkout-redo-engine.
- Pros and cons.
- Risk of divergence.

Option B — Shared package approach
- Extract MarginLab core into a shared package used by both repos.
- Pros and cons.
- Requires package publishing or local workspace strategy.

Option C — Sync strategy with explicit target adapters
- Keep standalone as source of truth.
- Copy/sync MarginLab modules into checkout-redo-engine with clear adapter layer.
- Pros and cons.

Option D — Git subtree/submodule
- Use standalone MarginLab as subtree/submodule inside checkout-redo-engine.
- Pros and cons.
- Developer workflow complexity.

Recommend the best approach for now.

My likely preference:
Keep the standalone MarginLab repo as the source of truth and integrate MarginLab into checkout-redo-engine through a clearly namespaced module with target-specific adapters.

But inspect both repos first and recommend the safest method.

Task 5 — Define module boundaries

Define what should be shared/synced:

Shared MarginLab product logic:
- Test schemas.
- Validation.
- Experiment/test services.
- Analytics calculations.
- Assignment logic.
- Runtime logic where reusable.
- UI components where compatible.
- Wizards.
- Detail pages.
- List pages.
- Guards.
- QA checklist logic.
- Price/shipping/discount/checkout/offer/content/split-url/personalization logic.

Target-specific adapters:
- Shopify auth/session.
- App install/OAuth.
- Billing.
- Webhook registration.
- Shopify app config.
- Runtime endpoint base URLs.
- Extension deployment/config.
- Environment variables.
- Database connection.
- Logging/Sentry config.
- Feature flags.
- App Store-specific review/compliance pages.

Task 6 — Checkout Redo Engine integration plan

Create a plan to add MarginLab into checkout-redo-engine.

The integrated version should:
- Appear as a module/section inside the existing custom app admin.
- Use the existing checkout-redo-engine auth/session where appropriate.
- Use the existing checkout-redo-engine DB/Prisma where appropriate.
- Add MarginLab models with safe namespacing if needed.
- Avoid conflicting with existing checkout-redo-engine models.
- Avoid conflicting with existing routes.
- Avoid conflicting with existing Shopify extensions/functions.
- Avoid overwriting existing app config.
- Preserve custom app installation assumptions.
- Disable or feature-flag App Store-only flows.
- Disable or feature-flag Shopify Billing if not needed.
- Preserve all MarginLab features that can work inside the custom app.

Task 7 — Feature flags / target flags

Create a target configuration system:

Example:
- `MARGINLAB_TARGET=standalone`
- `MARGINLAB_TARGET=checkout_redo_engine`

Feature flags:
- `MARGINLAB_ENABLE_BILLING`
- `MARGINLAB_ENABLE_APP_STORE_READINESS`
- `MARGINLAB_ENABLE_PUBLIC_APP_OAUTH`
- `MARGINLAB_ENABLE_CUSTOM_APP_MODE`
- `MARGINLAB_ENABLE_PRICE_TESTS`
- `MARGINLAB_ENABLE_CHECKOUT_TESTS`
- `MARGINLAB_ENABLE_SHIPPING_TESTS`
- `MARGINLAB_ENABLE_DISCOUNT_TESTS`
- `MARGINLAB_ENABLE_THEME_TESTS`
- `MARGINLAB_ENABLE_POST_PURCHASE`
- `MARGINLAB_ENABLE_ANALYTICS`
- `MARGINLAB_ENABLE_DEBUG`

The standalone repo can have:
- public app mode enabled
- App Store readiness enabled
- billing enabled if implemented

The checkout-redo-engine version can have:
- custom app mode enabled
- billing disabled
- App Store review flows disabled
- existing auth/session adapter enabled

Task 8 — Database/schema plan

Compare Prisma schemas.

For checkout-redo-engine:
- Add MarginLab models without breaking existing models.
- Namespace model names if needed.
- Avoid collisions.
- Preserve existing migrations.
- Create new migration only for MarginLab additions.
- Ensure `prisma generate` works.
- Ensure `prisma migrate` strategy is safe.
- Do not wipe or reset existing DB.
- Do not change existing tables unless absolutely necessary.

If standalone MarginLab schema has models that conflict with checkout-redo-engine:
- propose model renaming or mapping.
- document migration strategy.

Task 9 — Routes/UI integration plan

Define where MarginLab UI should live inside checkout-redo-engine.

Examples:
- `/marginlab`
- `/marginlab/dashboard`
- `/marginlab/tests`
- `/marginlab/content-tests`
- `/marginlab/split-url-tests`
- `/marginlab/offer-tests`
- `/marginlab/checkout-tests`
- `/marginlab/discount-tests`
- `/marginlab/shipping-tests`
- `/marginlab/price-tests`
- `/marginlab/personalizations`
- `/marginlab/analytics`
- `/marginlab/settings`
- `/marginlab/debug`

But do not blindly create routes if checkout-redo-engine already has route conventions. Adapt to its existing structure.

Rules:
- Do not break existing checkout-redo-engine routes.
- Do not replace existing checkout app dashboard.
- Add MarginLab as a clearly separated module.
- Keep navigation clean.
- Use existing UI/design system where possible.
- Reuse MarginLab UI components where compatible.

Task 10 — API/runtime integration plan

Define how MarginLab runtime/API endpoints should work inside checkout-redo-engine.

Need to audit:
- Existing API route patterns.
- Existing public runtime endpoints.
- Existing checkout extension endpoints.
- Existing webhook endpoints.
- Existing function config endpoints.

Plan:
- Add MarginLab endpoints with clear namespace.
- Avoid endpoint collisions.
- Keep public endpoints rate-limited.
- Keep HMAC/security checks.
- Keep CORS/origin restrictions where needed.
- Ensure runtime config works for the installed custom app.
- Ensure analytics/event ingestion works.

Task 11 — Shopify extensions/functions plan

Compare extensions/functions in both repos.

For each MarginLab extension/function:
- Theme/runtime extension.
- Web Pixel.
- Checkout UI Extension.
- Product discount function.
- Order discount function.
- Shipping discount function.
- Delivery customization function.
- Any post-purchase extension.

Decide:
- Already exists in checkout-redo-engine?
- Needs to be copied?
- Needs to be merged?
- Needs target-specific config?
- Conflicts with existing checkout-redo-engine extension?
- Should be disabled in custom app mode?
- Needs manual deploy?

Do not overwrite existing checkout-redo-engine extensions blindly.

Task 12 — Environment variables plan

Create separate `.env.example` sections:

Standalone MarginLab:
- Public app vars
- billing vars
- app store vars
- Shopify public app config

Checkout Redo Engine integrated MarginLab:
- custom app vars
- existing checkout app vars
- MarginLab target flags
- runtime vars
- analytics vars
- Redis/DB vars if needed

Never copy real env files.

Task 13 — Sync strategy

Define how future changes should flow between versions.

Options:
- Standalone source of truth, manual sync checklist.
- Shared package extracted later.
- Git subtree.
- Patch-based sync.
- Scripted sync.
- Monorepo consolidation later.

For now, propose a practical workflow:
1. Build feature in standalone MarginLab.
2. Port shared logic/UI to checkout-redo-engine.
3. Keep target-specific adapters separate.
4. Maintain `docs/DUAL_VERSION_STRATEGY.md`.
5. Keep a `MARGINLAB_SYNC_CHECKLIST.md`.

Task 14 — Documentation to create/update

In standalone MarginLab:
- `docs/DUAL_VERSION_STRATEGY.md`
- `docs/CHECKOUT_REDO_ENGINE_INTEGRATION.md`
- `docs/TARGET_ADAPTERS.md`
- `docs/SYNC_CHECKLIST.md`

In checkout-redo-engine:
- `docs/MARGINLAB_MODULE.md`
- `docs/MARGINLAB_CUSTOM_APP_MODE.md`
- `docs/MARGINLAB_ENV.md`
- `docs/MARGINLAB_QA.md`

Task 15 — Validation plan

Standalone MarginLab validation:
- install dependencies
- typecheck
- lint
- tests
- build
- prisma generate
- prisma migration validation
- extension build
- confirm app store mode still works

Checkout Redo Engine validation:
- install dependencies
- prisma generate
- migration validation
- typecheck
- lint
- tests
- build
- confirm existing checkout app still works
- confirm existing custom app install still works
- confirm existing checkout functionality still works
- confirm MarginLab dashboard loads
- confirm MarginLab tests can be created
- confirm MarginLab runtime works
- confirm checkout extensions/functions do not conflict

Task 16 — Execution plan

Create a step-by-step execution plan, but do not execute yet.

The plan should include:

1. Backup current checkout-redo-engine branch.
2. Create new branch in standalone MarginLab.
3. Create new branch in checkout-redo-engine.
4. Audit both repos.
5. Compare changed files from today's MarginLab work.
6. Build migration map.
7. Identify shared code.
8. Identify target-specific code.
9. Add target flags.
10. Add docs.
11. Integrate schema into checkout-redo-engine.
12. Integrate UI routes.
13. Integrate services.
14. Integrate runtime/API.
15. Integrate extensions/functions carefully.
16. Run validations.
17. Fix broken imports.
18. Verify standalone still works.
19. Verify checkout-redo-engine still works.
20. Provide final summary.

Task 17 — Risk list

List all risks and mitigations:

Risks:
- Code divergence between two versions.
- App Store behavior leaking into custom app.
- Custom app assumptions leaking into standalone app.
- Shopify config overwritten.
- Prisma model collisions.
- Extension/function conflicts.
- Broken auth/session.
- Broken runtime endpoints.
- Broken checkout-redo-engine existing functionality.
- Secrets accidentally copied.
- Env vars mixed across repos.
- Hardcoded URLs.
- Duplicate routes.
- Broken build due to package differences.

For each risk, provide mitigation.

Output required:
Give me a detailed migration/sync plan only.

Do not make changes yet.

Your output must include:
1. Audit summary of both repos.
2. Difference matrix.
3. Recommended architecture.
4. Files/folders likely to sync.
5. Files/folders that must remain target-specific.
6. Schema integration plan.
7. Route/UI integration plan.
8. API/runtime integration plan.
9. Extension/function integration plan.
10. Env var plan.
11. Feature flag plan.
12. Documentation plan.
13. Validation plan.
14. Risk list with mitigations.
15. Exact confirmation prompt I should send before you execute.

Remember:
The goal is to support two versions:
- Standalone MarginLab for Shopify App Store/public app.
- MarginLab inside checkout-redo-engine custom app.

Keep both working.
Do not merge them into one repo.
Do not destroy target-specific behavior.
