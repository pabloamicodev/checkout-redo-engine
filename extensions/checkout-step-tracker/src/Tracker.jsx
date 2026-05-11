import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";

export default function () {
  render(<Tracker />, document.body);
}

/**
 * Step rank — used to avoid overwriting a more-advanced step
 * if the buyer navigates back.
 * @type {Record<string, number>}
 */
const STEP_RANK = {
  contact:  1,
  shipping: 2,
  payment:  3,
  review:   4,
};

/**
 * Maps the raw step string from `buyerJourney.intercept` to a
 * normalized key + friendly label.
 *
 * Shopify step values (2026-01):
 *   "contact_information" | "shipping_method" | "payment_method" | "review"
 *
 * @param {unknown} rawStep
 * @returns {{ key: string; label: string } | null}
 */
function normalizeStep(rawStep) {
  if (!rawStep) return null;
  const s = String(rawStep).toLowerCase();
  if (s.includes("contact"))  return { key: "contact",  label: "Contact Information" };
  if (s.includes("shipping")) return { key: "shipping", label: "Shipping" };
  if (s.includes("payment"))  return { key: "payment",  label: "Payment" };
  if (s.includes("review"))   return { key: "review",   label: "Review" };
  return { key: s, label: String(rawStep) };
}

/**
 * Returns the traffic source for this checkout session:
 * 1. utm_source query param (most reliable for paid / email campaigns)
 * 2. Referrer hostname  (organic / social)
 * 3. "direct"
 *
 * @returns {string}
 */
function getSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get("utm_source");
    if (utm) return utm;
    const ref = document.referrer;
    if (ref) {
      try { return new URL(ref).hostname; } catch { return ref; }
    }
  } catch { /* extension sandbox may restrict window */ }
  return "direct";
}

function Tracker() {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { buyerJourney, applyAttributeChange } = shopify;

  /**
   * Track the two most recent steps reached.
   * - highestRankWritten: prevents going backwards
   * - previousStep: label of the step before the current one
   */
  const highestRankWritten = useRef(0);
  const previousStep = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    // ── Source / referrer (captured once on mount) ──────────────────────────
    applyAttributeChange({
      type:  "updateAttribute",
      key:   "_checkout_source",
      value: getSource(),
    });

    // ── Buyer identity (email preferred, phone fallback) ────────────────────
    const identity = /** @type {any} */ (shopify).buyerIdentity;

    /**
     * Write the buyer identifier as an order attribute.
     * @param {unknown} val
     */
    function writeBuyer(val) {
      const str = val ? String(val).trim() : "";
      if (str) {
        applyAttributeChange({
          type:  "updateAttribute",
          key:   "_checkout_buyer",
          value: str,
        });
      }
    }

    /** @type {(() => void) | null} */
    let emailUnsub = null;
    /** @type {(() => void) | null} */
    let phoneUnsub = null;

    if (identity?.email?.subscribe) {
      emailUnsub = identity.email.subscribe(writeBuyer);
    } else if (identity?.email?.current) {
      writeBuyer(identity.email.current);
    }

    // Phone only as fallback when no email is available
    if (identity?.phone?.subscribe) {
      phoneUnsub = identity.phone.subscribe((/** @type {unknown} */ phone) => {
        if (phone && !identity?.email?.current) writeBuyer(phone);
      });
    } else if (identity?.phone?.current && !identity?.email?.current) {
      writeBuyer(identity.phone.current);
    }

    // ── Step tracking ────────────────────────────────────────────────────────
    /** @type {(() => void) | null} */
    let stepCleanup = null;

    buyerJourney
      .intercept(async (/** @type {any} */ details) => {
        const normalized = normalizeStep(details?.step ?? details?.currentStep);
        if (normalized) {
          const rank = STEP_RANK[normalized.key] ?? 0;

          if (rank > highestRankWritten.current) {
            // Shift: current last_step becomes previous_step
            if (highestRankWritten.current > 0) {
              applyAttributeChange({
                type:  "updateAttribute",
                key:   "_checkout_previous_step",
                value: previousStep.current ?? "",
              });
            }

            highestRankWritten.current = rank;
            previousStep.current = normalized.label;

            applyAttributeChange({
              type:  "updateAttribute",
              key:   "_checkout_last_step",
              value: normalized.label,
            });

            applyAttributeChange({
              type:  "updateAttribute",
              key:   "_checkout_step_at",
              value: new Date().toISOString(),
            });
          }
        }

        // This tracker never blocks — always allow.
        return { behavior: "allow" };
      })
      .then((unsub) => {
        stepCleanup = unsub;
      });

    return () => {
      if (stepCleanup)  stepCleanup();
      if (emailUnsub)   emailUnsub();
      if (phoneUnsub)   phoneUnsub();
    };
  }, []);

  return null;
}
