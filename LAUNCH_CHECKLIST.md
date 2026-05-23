# MarginLab — Launch Checklist

> **This is the final gate before Shopify App Store submission.**
> Every item must be checked or explicitly marked N/A before submitting.

Last updated: 2026-05-22

---

## 1. App Configuration

| # | Check | Status | Notes |
|---|---|---|---|
| 1.1 | `shopify.app.toml` → `application_url` points to production domain | ✅ | `https://marginlab.vercel.app` |
| 1.2 | `redirect_urls` includes production `/api/auth` | ✅ | Set in `[auth]` block |
| 1.3 | App is configured as **public distribution** in Partner Dashboard | ⬜ | Confirm in Partner Dashboard → App setup |
| 1.4 | App name, description, and icon are final | ⬜ | Confirm in Partner Dashboard → App listing |
| 1.5 | App listing screenshots are real (not mockups) | ⬜ | Upload to Partner Dashboard |
| 1.6 | Privacy Policy URL is live and accessible | ⬜ | Required by Shopify |
| 1.7 | Terms of Service URL is live and accessible | ⬜ | Required by Shopify |

---

## 2. Scopes

| # | Check | Status | Notes |
|---|---|---|---|
| 2.1 | All scopes in `shopify.app.toml` are in `SCOPES.md` with justification | ✅ | See `SCOPES.md` |
| 2.2 | No unused scopes are requested | ✅ | `write_themes`, `write_script_tags` removed |
| 2.3 | `read_inventory` is included only if COGS sync is used | ⬜ | Confirm or add to scopes if needed |

---

## 3. Privacy / GDPR Webhooks

| # | Check | Status | Notes |
|---|---|---|---|
| 3.1 | `customers/data_request` webhook implemented | ✅ | `/api/webhooks/shopify` |
| 3.2 | `customers/redact` webhook implemented | ✅ | Deletes customer event/attribution data |
| 3.3 | `shop/redact` webhook implemented | ✅ | Full shop data deletion after 90 days |
| 3.4 | All 3 GDPR webhooks registered in `shopify.app.toml` | ✅ | In `[[webhooks.subscriptions]]` |
| 3.5 | GDPR webhook handler returns 200 within 5 seconds | ✅ | Confirmed in `/api/webhooks/shopify` |

---

## 4. Billing

| # | Check | Status | Notes |
|---|---|---|---|
| 4.1 | Billing is configured with a test plan or real plans | ✅ | `BillingService` + plan guards |
| 4.2 | Free tier allows merchant to try the app without paying | ✅ | Free plan enforced in `plans.ts` |
| 4.3 | Plan upgrade flow works from within the embedded app | ⬜ | Manual QA required |
| 4.4 | Billing status is visible to merchants in Settings | ⬜ | UI check required |

---

## 5. OAuth & Install

| # | Check | Status | Notes |
|---|---|---|---|
| 5.1 | Install flow works from Partner Dashboard test install | ⬜ | Manual QA required |
| 5.2 | Re-install (after uninstall) creates a new Shop record cleanly | ✅ | `upsert` logic in `/api/auth/callback` |
| 5.3 | HMAC validation is in place | ✅ | `validateHmac()` in callback |
| 5.4 | State/CSRF cookie is validated | ✅ | `state` param vs `oauth_state` cookie |
| 5.5 | Access token is encrypted at rest | ✅ | AES-256-GCM in `lib/crypto.ts` |

---

## 6. Onboarding

| # | Check | Status | Notes |
|---|---|---|---|
| 6.1 | Onboarding checklist shows correct status for new installs | ✅ | `/api/onboarding/status` |
| 6.2 | App Embed, Web Pixel, Checkout Extension, Function statuses detected | ✅ | Via event/order proxies |
| 6.3 | Merchant can complete onboarding without a developer | ✅ | No CLI steps |
| 6.4 | Onboarding does not mention CLI, ngrok, or localhost | ✅ | Audited in Phase 23 |

---

## 7. Security

| # | Check | Status | Notes |
|---|---|---|---|
| 7.1 | App Bridge JWT validated on all admin API routes | ✅ | `withShopAuth` + `verifyShopifyJwt` |
| 7.2 | `aud`, `dest`, `exp` validated in JWT | ✅ | `api-middleware.ts` |
| 7.3 | Shop ownership enforced on every resource | ✅ | All routes use `shopId` from JWT |
| 7.4 | IDOR across shops is impossible (no cross-shop queries) | ✅ | All queries scoped by `shopId` |
| 7.5 | Raw stack traces not exposed to merchants | ✅ | Generic 500 in all handlers |
| 7.6 | No secrets in runtime config payload | ✅ | `RuntimeConfigService` confirmed |
| 7.7 | No Admin API tokens reachable from browser | ✅ | Token only used server-side |
| 7.8 | Runtime endpoints rate-limited | ✅ | `withRuntimeRateLimit` on all 4 routes |
| 7.9 | Bot filter on runtime endpoints | ✅ | UA regex in `withRuntimeAuth` |
| 7.10 | Kill switches available for emergency runtime disable | ✅ | `/api/settings/kill-switches` |

---

## 8. Storefront Runtime

| # | Check | Status | Notes |
|---|---|---|---|
| 8.1 | Runtime config served with `Cache-Control: stale-while-revalidate` | ✅ | `runtime/config` route |
| 8.2 | Runtime health signals tracked in Redis | ✅ | `lib/runtime-health.ts` |
| 8.3 | `/api/runtime/health` shows last-seen timestamps | ✅ | Admin-authed endpoint |
| 8.4 | Runtime tested on Dawn theme (Shopify default) | ⬜ | Manual QA required |
| 8.5 | Runtime tested on at least one custom theme | ⬜ | Manual QA required |

---

## 9. Analytics & Attribution

| # | Check | Status | Notes |
|---|---|---|---|
| 9.1 | Test orders (`source_name=test`) excluded from attribution | ✅ | Phase 18 |
| 9.2 | Attribution debug endpoint available for support | ✅ | `/api/analytics/attribution-debug` |
| 9.3 | Peeking warning shown when winner detected < 7 days | ✅ | `peekingWarning` in analytics service |
| 9.4 | `visitorsNeeded` shown per variant until sample is sufficient | ✅ | Phase 18 |
| 9.5 | Attribution validated with real orders on dev store | ⬜ | Manual QA required |

---

## 10. Known Limitations Documentation

| # | Check | Status | Notes |
|---|---|---|---|
| 10.1 | `lib/limitations.ts` contains all platform + feature limitation cards | ✅ | Phase 22 |
| 10.2 | `/api/limitations` endpoint serves cards to the frontend | ✅ | Phase 22 |
| 10.3 | Limitation cards displayed in relevant wizards | ⬜ | Frontend integration required |
| 10.4 | `REVIEW_INSTRUCTIONS.md` complete and accurate | ✅ | Phase 14 |

---

## 11. Observability

| # | Check | Status | Notes |
|---|---|---|---|
| 11.1 | Sentry configured with DSN in production env | ⬜ | Set `SENTRY_DSN` in Vercel |
| 11.2 | Audit logs written for all destructive actions | ✅ | `AuditLog` model |
| 11.3 | Kill switches audit log written on every change | ✅ | Phase 19 |
| 11.4 | Runtime health visible in Install Health page | ✅ | Phase 21 |

---

## 12. Pre-Submission Smoke Test

Run through `QA_MATRIX.md` sections 1–6 (pre-conditions, install, billing, onboarding, install health, first test) before submitting.

| # | Check | Status |
|---|---|---|
| 12.1 | QA_MATRIX.md sections 1–6 completed on dev store | ⬜ |
| 12.2 | No console errors in embedded app on fresh install | ⬜ |
| 12.3 | No broken API calls (4xx/5xx) during normal merchant flow | ⬜ |
| 12.4 | Shopify App Store review instructions tested end-to-end | ⬜ |

---

## Definition of Ready to Submit

MarginLab is ready to submit to the Shopify App Store when:

- [ ] All ✅ items in this checklist remain passing
- [ ] All ⬜ items above are resolved or explicitly accepted as known gaps
- [ ] `QA_MATRIX.md` pre-submission sections pass
- [ ] `REVIEW_INSTRUCTIONS.md` has been tested by a reviewer who is not the developer
- [ ] No `DEMO_SHOP` hardcodes remain in production API routes
- [ ] Privacy Policy and Terms of Service URLs are live
- [ ] App listing screenshots are real
- [ ] App is set to public distribution in Partner Dashboard
