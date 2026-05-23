# MarginLab — App Store Critical Path QA Matrix

> **Purpose:** End-to-end validation of every MarginLab feature from a clean install, using only Shopify Admin and the embedded app. Zero CLI, developer dashboard, or code changes required.
>
> **How to use:** Run in order, top to bottom. Check each box when the expected result is confirmed. Any unchecked box at the end = blocking for App Store submission.

---

## Critical Path

```
Install → Billing → Onboarding → [Create Test → Launch → Assign → Render → Event → Analytics → Pause/Archive] × 9 test types → Personalizations → Analytics → COGS → Uninstall → Reinstall → GDPR
```

---

## 0 — Pre-conditions

| # | Check | Expected |
|---|---|---|
| 0.1 | Development store available | Store is on any Shopify plan with at least one product |
| 0.2 | Active published theme | Dawn or equivalent |
| 0.3 | At least one product with a variant | Required for Price, Discount, Offer tests |
| 0.4 | MarginLab NOT installed | Clean install test |
| 0.5 | Using incognito window for storefront testing | Prevents cookie contamination |

---

## 1 — Install & Auth

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 1.1 | Visit App Store listing → click **Add app** | Shopify OAuth consent screen shows | ☐ |
| 1.2 | Review permissions on consent screen | All listed scopes match SCOPES.md | ☐ |
| 1.3 | Click **Install app** | Redirected to MarginLab embedded admin | ☐ |
| 1.4 | First page shown is Onboarding | Setup checklist visible | ☐ |
| 1.5 | Reload the page | App stays authenticated — no re-OAuth loop | ☐ |
| 1.6 | Open a second browser tab to the same app URL | Session works in both tabs | ☐ |
| 1.7 | Navigate to a non-existent route (e.g. `/unknown`) | 404 page, does not crash | ☐ |

---

## 2 — Billing

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 2.1 | Go to **Settings → Billing** | Plan selection screen shown | ☐ |
| 2.2 | Select **Growth** plan | Shopify billing confirmation screen shows "14-day free trial" | ☐ |
| 2.3 | Click **Approve** | Returned to MarginLab with plan = Growth, trial = active | ☐ |
| 2.4 | Billing page shows plan name and trial end date | Correct plan displayed | ☐ |
| 2.5 | Create a test (any type) while on Growth plan | Allowed — no billing block | ☐ |
| 2.6 | Cancel subscription via **Settings → Billing → Cancel** | Plan downgrades to Free immediately | ☐ |
| 2.7 | Try to create a test on Free plan that exceeds Free limits | Blocked with plan upgrade CTA | ☐ |
| 2.8 | Re-subscribe to Growth plan | Plan active again | ☐ |

---

## 3 — Onboarding

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 3.1 | Open Onboarding page | Checklist visible; uncompleted steps shown | ☐ |
| 3.2 | No billing active → banner shown | Billing warning banner visible | ☐ |
| 3.3 | Go to Theme Editor → App Embeds → enable MarginLab → Save | Return to onboarding; "Storefront tracking" step detects as active within 60s | ☐ |
| 3.4 | Go to Settings → Customer Events → connect MarginLab pixel | Return to onboarding; "Web Pixel" step detects activity after first storefront visit | ☐ |
| 3.5 | Click **Skip for now** | Onboarding dismisses; CTA reappears in sidebar | ☐ |
| 3.6 | Reload page | Previous step progress preserved (localStorage) | ☐ |
| 3.7 | Complete all detectable steps | All available checkmarks shown as green | ☐ |

---

## 4 — Install Health (Setup & Health)

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 4.1 | Click **Setup & Health** in sidebar | Health page loads with 7 checks | ☐ |
| 4.2 | App Installed check | Shows ✅ with install date | ☐ |
| 4.3 | Billing check (plan active) | Shows ✅ with plan name | ☐ |
| 4.4 | Storefront tracking check (embed on) | Shows ✅ | ☐ |
| 4.5 | Web Pixel check (pixel connected) | Shows ✅ or ⚠️ with fix CTA | ☐ |
| 4.6 | Order attribution check | Shows current attribution status | ☐ |
| 4.7 | Active experiment check | Shows ✅ or ⬜ with "Create" CTA | ☐ |
| 4.8 | App permissions check | Shows ✅ | ☐ |
| 4.9 | Click **Show technical details** on any check | Developer detail expands below | ☐ |
| 4.10 | Click **Refresh** | Checks reload and timestamp updates | ☐ |
| 4.11 | All check labels are merchant-friendly | Zero CLI/developer wording visible | ☐ |

---

## 5 — Content Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 5.1 | Content Tests → **New Content Test** | Create form opens | ☐ |
| 5.2 | Add name, select a page (e.g. Home) | Saved | ☐ |
| 5.3 | Add text replacement variant | CSS selector + replacement value saved | ☐ |
| 5.4 | Add image replacement variant | Image URL/upload saved | ☐ |
| 5.5 | Add CSS injection variant | CSS saved | ☐ |
| 5.6 | Attempt JS injection | Warning shown; injection blocked or sanitized | ☐ |
| 5.7 | Click **Preview** | Storefront opens with variant active | ☐ |
| 5.8 | Click **Launch** | Test status = Running | ☐ |
| 5.9 | Visit storefront in incognito | Visitor is assigned to a variant | ☐ |
| 5.10 | Content changes render correctly | Text/image/CSS matches configured variant | ☐ |
| 5.11 | Anti-flicker: page does not flash original content | No visible FOUC | ☐ |
| 5.12 | Mobile render | Changes render correctly on mobile viewport | ☐ |
| 5.13 | Desktop render | Changes render correctly on desktop viewport | ☐ |
| 5.14 | Cart drawer still functional | Adding to cart works | ☐ |
| 5.15 | Complete a purchase | `conversion` event fires | ☐ |
| 5.16 | Analytics tab shows variant data | CVR and revenue per visitor visible | ☐ |
| 5.17 | Click **Pause** | Variants stop rendering; storefront shows original | ☐ |
| 5.18 | Click **Archive** | Test status = Archived; historical data retained | ☐ |

---

## 6 — Split URL Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 6.1 | Split URL Tests → **New Split URL Test** | Create form opens | ☐ |
| 6.2 | Enter control URL (e.g. `/products/shirt`) | Saved | ☐ |
| 6.3 | Add variant URL (e.g. `/products/shirt-v2`) | Saved | ☐ |
| 6.4 | Enter duplicate URL for a second variant | Validation error shown | ☐ |
| 6.5 | Enter a cart/checkout path as variant URL | Validation error shown | ☐ |
| 6.6 | Set traffic percentages; click **Launch** | Test status = Running | ☐ |
| 6.7 | Visit control URL in incognito (multiple times) | Some visits redirect to variant URL | ☐ |
| 6.8 | Visit `/cart` directly | No redirect occurs | ☐ |
| 6.9 | Visit `/checkout` directly | No redirect occurs | ☐ |
| 6.10 | UTM params preserved after redirect | `?utm_source=...` survives in variant URL | ☐ |
| 6.11 | Complete a purchase from variant URL | Order attributed to variant | ☐ |
| 6.12 | Analytics show data by variant/landing URL | CVR visible per variant | ☐ |
| 6.13 | Click **Pause** | Redirects stop; all traffic goes to control URL | ☐ |

---

## 7 — Offer Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 7.1 | Offer Tests → **New Offer Test** | Create form opens | ☐ |
| 7.2 | Configure free shipping threshold offer | Threshold amount saved | ☐ |
| 7.3 | Configure free gift offer (with product selection) | Product selected and saved | ☐ |
| 7.4 | Configure volume discount | Tiers saved | ☐ |
| 7.5 | Select placement: product page | Saved | ☐ |
| 7.6 | Select placement: cart drawer | Saved | ☐ |
| 7.7 | Click **Preview** | Storefront preview shows offer in context | ☐ |
| 7.8 | Click **Launch** | Test status = Running | ☐ |
| 7.9 | Visit product page in incognito | Offer renders for assigned visitors | ☐ |
| 7.10 | Open cart drawer | Offer visible in cart drawer | ☐ |
| 7.11 | Add qualifying items; go to checkout | Discount applied in checkout | ☐ |
| 7.12 | Free gift: qualifying item added to cart | Free gift auto-added to cart | ☐ |
| 7.13 | `offer_view` event fires | Visible in analytics | ☐ |
| 7.14 | `offer_claim` event fires on qualifying action | Visible in analytics | ☐ |
| 7.15 | Complete order | Order attributed to test variant | ☐ |
| 7.16 | Analytics shows offer claim rate and revenue | Data visible | ☐ |

---

## 8 — Checkout Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 8.1 | Confirm Checkout UI Extension is active in theme | Visible in Checkout Editor | ☐ |
| 8.2 | Checkout Tests → **New Checkout Test** | Create form opens | ☐ |
| 8.3 | Select block type (e.g. banner) and placement | Saved | ☐ |
| 8.4 | Configure variant content | Content saved per variant | ☐ |
| 8.5 | Click **Launch** | Test status = Running | ☐ |
| 8.6 | Add product to cart → proceed to checkout | Checkout block renders in correct placement | ☐ |
| 8.7 | Mobile checkout layout | Block renders correctly on mobile | ☐ |
| 8.8 | Desktop checkout layout | Block renders correctly on desktop | ☐ |
| 8.9 | Attempt unsafe HTML/JS in block content | Sanitized — no script injection | ☐ |
| 8.10 | Complete purchase | `checkout_completed` attribution event fires | ☐ |
| 8.11 | Order failure scenario (declined card) | Checkout block does not interfere with error handling | ☐ |
| 8.12 | Analytics shows checkout block impressions and CVR | Data visible | ☐ |

---

## 9 — Discount Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 9.1 | Confirm Shopify Function (discount) is active | Visible in Shopify Admin → Settings → Functions | ☐ |
| 9.2 | Discount Tests → **New Discount Test** | Create form opens | ☐ |
| 9.3 | Configure percentage discount (e.g. 10%) | Saved | ☐ |
| 9.4 | Set eligibility: minimum subtotal | Saved | ☐ |
| 9.5 | Set stacking rule (exclusive) | Saved | ☐ |
| 9.6 | Click **Launch** | Test status = Running | ☐ |
| 9.7 | Add qualifying items to cart → checkout | Discount line appears: "10% off" | ☐ |
| 9.8 | Cart below eligibility threshold | No discount applied | ☐ |
| 9.9 | Stacking: apply a manual Shopify discount code | Exclusive rule blocks stacking | ☐ |
| 9.10 | Complete order | Order attributed with discount amount | ☐ |
| 9.11 | Analytics shows discount cost and profit impact | Data visible | ☐ |
| 9.12 | Configure fixed amount discount | Saved and applied correctly | ☐ |
| 9.13 | Click **Pause** | Discount stops applying at checkout | ☐ |

---

## 10 — Shipping Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 10.1 | Confirm Shopify Functions (delivery + shipping discount) are active | Visible in Functions admin | ☐ |
| 10.2 | Shipping Tests → **New Shipping Test** | Create form opens | ☐ |
| 10.3 | Configure free shipping threshold (e.g. $50) | Saved | ☐ |
| 10.4 | Configure progress bar | Saved with placement | ☐ |
| 10.5 | Click **Launch** | Test status = Running | ☐ |
| 10.6 | Open cart with subtotal below threshold | Progress bar shows: "Add $X more for free shipping" | ☐ |
| 10.7 | Bring cart above threshold | Progress bar shows: "You unlocked free shipping!" | ☐ |
| 10.8 | Proceed to checkout | Free shipping method appears | ☐ |
| 10.9 | Configure method rename (e.g. "Standard" → "Eco Delivery") | Renamed method appears in checkout | ☐ |
| 10.10 | Configure method hide | Hidden method not visible in checkout | ☐ |
| 10.11 | At least one method always remains visible | Confirmed — checkout not left with zero methods | ☐ |
| 10.12 | Complete order | Order attributed | ☐ |
| 10.13 | Analytics shows AOV, CVR, shipping revenue | Data visible | ☐ |

---

## 11 — Price Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 11.1 | Price Tests → **New Price Test** | Create form opens | ☐ |
| 11.2 | Select a product variant | Product/variant loaded | ☐ |
| 11.3 | Set control price and two test prices | Saved | ☐ |
| 11.4 | Multi-currency warning shown if store uses multi-currency | Warning visible | ☐ |
| 11.5 | Select display surfaces: PDP + collection + cart | Saved | ☐ |
| 11.6 | Click **Launch** | Test status = Running | ☐ |
| 11.7 | Visit PDP in incognito | Test price renders in variant | ☐ |
| 11.8 | Add to cart — cart shows test price | Correct price in cart | ☐ |
| 11.9 | Proceed to checkout — confirm displayed vs. charged price | Matches configured enforcement mode | ☐ |
| 11.10 | Complete purchase | Revenue tracked for variant | ☐ |
| 11.11 | Analytics shows revenue and profit per variant | Data visible | ☐ |
| 11.12 | Click **Roll Out** winning variant | Double confirmation dialog shown | ☐ |
| 11.13 | Confirm rollout | Shopify product price backup created; price updated | ☐ |
| 11.14 | Click **Rollback** within 7 days | Original price restored from backup | ☐ |
| 11.15 | Attempt rollback after 7 days | Rollback blocked; audit log shows expiration | ☐ |
| 11.16 | Audit log shows all price change events | Log visible with timestamps | ☐ |

---

## 12 — Template Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 12.1 | Template Tests → **New Template Test** | Create form opens | ☐ |
| 12.2 | Available templates loaded from Shopify theme | Template list populated | ☐ |
| 12.3 | Select a template and configure traffic | Saved | ☐ |
| 12.4 | Click **Launch** | Test status = Running | ☐ |
| 12.5 | Try to launch a second conflicting template test for same products | Conflict warning shown | ☐ |
| 12.6 | Visit page in incognito | Assigned template renders | ☐ |
| 12.7 | Analytics shows impressions per template | Data visible | ☐ |

---

## 13 — Theme Test

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 13.1 | Publish a second theme in Shopify Admin | Theme visible in Themes list | ☐ |
| 13.2 | Theme Tests → **New Theme Test** | Create form opens | ☐ |
| 13.3 | Risk review step shown | Warning about manual setup visible | ☐ |
| 13.4 | Select control (active) and variant (alternate) theme | Themes loaded from Shopify | ☐ |
| 13.5 | Snippet generation shown | Snippet code provided with installation steps | ☐ |
| 13.6 | Install snippet in variant theme | Confirmed | ☐ |
| 13.7 | Click **Launch** | Test status = Running | ☐ |
| 13.8 | Visit storefront in incognito | Assigned theme renders | ☐ |
| 13.9 | Publish a different theme while test is running | Test auto-pauses; merchant notified | ☐ |
| 13.10 | Analytics shows theme assignment data | Data visible | ☐ |

---

## 14 — Personalization

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 14.1 | Personalizations → **New Personalization** | Create form opens | ☐ |
| 14.2 | Select audience: returning customers | Saved | ☐ |
| 14.3 | Configure experience (e.g. content swap) | Saved | ☐ |
| 14.4 | Set priority (higher than default) | Saved | ☐ |
| 14.5 | Conflict with running test detected | Conflict warning shown | ☐ |
| 14.6 | Click **Activate** | Personalization status = Active | ☐ |
| 14.7 | Visit storefront matching audience condition | Personalized content renders | ☐ |
| 14.8 | Visit storefront NOT matching condition | Default content renders | ☐ |
| 14.9 | `impression` event fires for served personalization | Visible in analytics | ☐ |
| 14.10 | Analytics shows impression count and conversions | Data visible | ☐ |

---

## 15 — Post-Purchase Personalization

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 15.1 | Store plan supports post-purchase extension | Confirmed in Shopify Admin | ☐ |
| 15.2 | Post-purchase Personalizations → **New** | Create form opens | ☐ |
| 15.3 | Configure audience and offer | Saved | ☐ |
| 15.4 | Click **Activate** | Status = Active | ☐ |
| 15.5 | Complete a purchase matching the audience | Personalized block appears on order confirmation page | ☐ |
| 15.6 | Complete a purchase NOT matching | Block does not appear | ☐ |
| 15.7 | Store plan does NOT support post-purchase extension | Feature clearly marked as unavailable | ☐ |
| 15.8 | Attribution tracked | Visible in analytics | ☐ |

---

## 16 — Analytics & COGS

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 16.1 | Open any running test → **Analytics** tab | CVR, RPV, confidence visible per variant | ☐ |
| 16.2 | Click **Profit Analytics** tab | Profit metrics shown (may show "COGS not configured") | ☐ |
| 16.3 | Go to **COGS** in sidebar | COGS import page opens | ☐ |
| 16.4 | Upload valid CSV (`variant_id, cost_per_unit`) | Import succeeds; confirmation shown | ☐ |
| 16.5 | Upload invalid CSV (missing columns) | Validation error shown | ☐ |
| 16.6 | Return to Profit Analytics | Margin and profit per variant now visible | ☐ |
| 16.7 | Statistical confidence shown per variant | Confidence % or "not enough data" shown | ☐ |

---

## 17 — Pause, Archive & Data Retention

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 17.1 | Pause a running test | Variant assignment stops immediately | ☐ |
| 17.2 | Resume paused test | Assignment resumes from previous traffic split | ☐ |
| 17.3 | Archive a test | Status = Archived; historical data still visible | ☐ |
| 17.4 | Archived test data visible in analytics | CVR and revenue data intact | ☐ |
| 17.5 | No new assignments for archived test | Storefront shows control only | ☐ |

---

## 18 — Uninstall & GDPR

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 18.1 | Shopify Admin → Settings → Apps → MarginLab → **Delete** | Removal confirmation shown | ☐ |
| 18.2 | Confirm removal | App uninstalled; app embed deactivated | ☐ |
| 18.3 | Visit storefront | MarginLab script no longer runs | ☐ |
| 18.4 | MarginLab sends `shop/redact` webhook (within 48h) | All shop data deleted from MarginLab DB | ☐ |
| 18.5 | `customers/data_request` webhook — simulate via API | HTTP 200 returned; request logged | ☐ |
| 18.6 | `customers/redact` webhook — simulate via API | HTTP 200; customer events nullified | ☐ |
| 18.7 | `shop/redact` webhook — simulate via API | HTTP 200; all shop data cascade-deleted | ☐ |
| 18.8 | All three webhooks are idempotent | Re-sending same payload → HTTP 200, no error | ☐ |

---

## 19 — Reinstall

| # | Step | Expected Result | Pass |
|---|---|---|---|
| 19.1 | Reinstall from App Store listing | OAuth consent screen shown | ☐ |
| 19.2 | Complete install | New merchant record created | ☐ |
| 19.3 | Onboarding checklist shown | Fresh state — no previous experiments listed | ☐ |
| 19.4 | Previous experiment history NOT restored | Confirmed — data was deleted on redact | ☐ |
| 19.5 | Billing screen shown again | New billing confirmation required | ☐ |

---

## 20 — Production-Ready Gates

All items below must be ✅ before App Store submission.

| Gate | Status |
|---|---|
| Install → no re-OAuth loop | ☐ |
| Billing confirmation flow complete | ☐ |
| No feature accessible without billing where required | ☐ |
| All 9 test types create, launch, assign, and attribute | ☐ |
| Storefront never broken by MarginLab (cart, checkout, redirect safety) | ☐ |
| No JS injection possible in any content input | ☐ |
| All events fire and reach analytics | ☐ |
| COGS import works | ☐ |
| All 3 GDPR webhooks verified | ☐ |
| Uninstall cleans up storefront scripts | ☐ |
| Reinstall creates fresh state | ☐ |
| Zero CLI/developer wording visible to merchants | ☐ |
| `tsc --noEmit` passes with zero errors | ☐ |
| REVIEW_INSTRUCTIONS.md matches actual app behavior | ☐ |

---

*Last updated: 2026-05-22*
