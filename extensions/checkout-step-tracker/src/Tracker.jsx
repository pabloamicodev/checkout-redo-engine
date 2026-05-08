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

function Tracker() {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { buyerJourney, applyAttributeChange } = shopify;

  /**
   * Track the highest step rank already written so we never overwrite
   * with a less-advanced step when the buyer navigates back.
   */
  const highestRankWritten = useRef(0);

  useEffect(() => {
    /** @type {(() => void) | null} */
    let cleanup = null;

    buyerJourney
      .intercept(async (/** @type {any} */ details) => {
        const normalized = normalizeStep(details?.step ?? details?.currentStep);
        if (normalized) {
          const rank = STEP_RANK[normalized.key] ?? 0;

          if (rank > highestRankWritten.current) {
            highestRankWritten.current = rank;

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
        cleanup = unsub;
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return null;
}
