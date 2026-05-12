import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

// ─── Fallback text (used when merchant hasn't configured settings yet) ────────
const FALLBACK_TEXT_BEFORE = "I agree to the";
const FALLBACK_LINK_TEXT   = "Terms and Conditions";
const FALLBACK_TEXT_AFTER  = "for my subscription";

/**
 * Valid values for the `color` attribute of <s-text>.
 */
const VALID_TEXT_COLORS = ["subdued", "base"];

/**
 * Valid values for the `tone` attribute of <s-link>.
 */
const VALID_LINK_TONES = ["auto", "neutral"];

/**
 * Returns the value only if it is a valid s-text color; undefined otherwise.
 * @param {any} val
 * @returns {"subdued" | "base" | undefined}
 */
function toTextColor(val) {
  const v = String(val ?? "").trim().toLowerCase();
  return /** @type {"subdued" | "base" | undefined} */ (VALID_TEXT_COLORS.includes(v) ? v : undefined);
}

/**
 * Returns the value only if it is a valid s-link tone; undefined otherwise.
 * @param {any} val
 * @returns {"auto" | "neutral" | undefined}
 */
function toLinkTone(val) {
  const v = String(val ?? "").trim().toLowerCase();
  return /** @type {"auto" | "neutral" | undefined} */ (VALID_LINK_TONES.includes(v) ? v : undefined);
}

export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const { lines, settings, buyerJourney, i18n } = shopify;

  const termsUrl    = String(settings.current?.terms_url   ?? "");
  const textBefore  = (String(settings.current?.text_before_link ?? "")).trim() || i18n.translate("checkbox.text_before");
  const linkLabel   = (String(settings.current?.link_text  ?? "")).trim() || i18n.translate("checkbox.link_text");
  const textAfter   = (String(settings.current?.text_after_link  ?? "")).trim() || i18n.translate("checkbox.text_after");
  const textColor   = toTextColor(settings.current?.text_color);
  const linkTone    = toLinkTone(settings.current?.link_tone);
  // Always render inside the checkout editor so merchants can configure the block.
  const isInEditor  = shopify.extension.editor != null;

  const [accepted, setAccepted]               = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
    const [shouldShowError, setShouldShowError] = useState(false);


  const acceptedRef        = useRef(/** @type {boolean} */ (false));
  const hasSubscriptionRef = useRef(/** @type {boolean} */ (false));
  acceptedRef.current        = accepted;
  hasSubscriptionRef.current = hasSubscription;

  // ── Subscribe to cart lines ────────────────────────────────────────────────
  useEffect(() => {
    function checkLines() {
      const current = lines.current;

      const hasSub  = current.some((/** @type {any} */ l) => {
        if (l.sellingPlanAllocation != null) return true;
        if (l.sellingPlan != null) return true;
        if (l.merchandise?.sellingPlan != null) return true;
        if (l.merchandise?.product?.requiresSellingPlan === true) return true;
        // Also check bundle line components
        if (Array.isArray(l.lineComponents)) {
          return l.lineComponents.some(
            (/** @type {any} */ c) => c.sellingPlanAllocation != null
          );
        }
        return false;
      });

      setHasSubscription(hasSub);
    }
    checkLines();
    const unsub = lines.subscribe(checkLines);
    return () => unsub();
  }, []);

  useEffect(() => {
    /** @type {(() => void) | null} */
    let cleanup = null;

    buyerJourney
      .intercept(async ({ canBlockProgress }) => {
        const shouldBlock =
          canBlockProgress &&
          hasSubscriptionRef.current &&
          !acceptedRef.current;
        if (shouldBlock) {
          return {
            behavior: "block",
            reason: "Subscription terms not accepted",
            perform: () => {
              setShouldShowError(true);
            },
          };
        }
        return {
          behavior: "allow",
          perform: () => {
            setShouldShowError(false);
          },
        };
      })
      .then((unsub) => {
        cleanup = unsub;
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Only render when there are subscription lines — OR when running inside the checkout editor.
  if (!hasSubscription && !isInEditor) return null;

  function handleChange(/** @type {any} */ event) {
    const isChecked = Boolean(event.target.checked);
    setAccepted(isChecked);
    if (isChecked) setShouldShowError(false);
  }

  return (
    <s-box padding="base">
      <s-stack direction="block" gap="small">

        {/* ── Checkbox row ──────────────────────────────────────────────── */}
        <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", cursor: "pointer" }}>
          <s-checkbox
            checked={accepted}
            onChange={handleChange}
          />
          <s-text color={textColor}>
            {textBefore}{" "}
            <s-link
              href={termsUrl || "#"}
              target="auto"
              tone={linkTone}
            >
              {linkLabel}
            </s-link>
            {textAfter ? ` ${textAfter}` : ""}
          </s-text>
        </label>

        {/* ── Validation banner (shown only after a blocked attempt) ─────────── */}
        {shouldShowError && !accepted && (
          <s-banner tone="critical">
            <s-text>{i18n.translate("errors.must_accept")}</s-text>
          </s-banner>
        )}

      </s-stack>
    </s-box>
  );
}
