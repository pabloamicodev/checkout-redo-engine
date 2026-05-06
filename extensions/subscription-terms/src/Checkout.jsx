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
  // When true: block always renders regardless of cart contents (use in editor to preview/configure).
  const alwaysVisible = settings.current?.always_visible === true;

  const [accepted, setAccepted]               = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [blocked, setBlocked]                 = useState(false);


  const acceptedRef        = useRef(/** @type {boolean} */ (false));
  const hasSubscriptionRef = useRef(/** @type {boolean} */ (false));
  acceptedRef.current        = accepted;
  hasSubscriptionRef.current = hasSubscription;

  // ── Subscribe to cart lines ────────────────────────────────────────────────
  useEffect(() => {
    function checkLines() {
      const current = lines.current;
      const hasSub  = current.some(
        (/** @type {any} */ l) => l.sellingPlanAllocation != null
      );
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
        if (canBlockProgress && hasSubscriptionRef.current && !acceptedRef.current) {
          setBlocked(true);
          return {
            behavior: "block",
            reason: "Subscription terms not accepted",
            errors: [
              { message: i18n.translate("errors.must_accept") },
            ],
          };
        }
        setBlocked(false);
        return { behavior: "allow" };
      })
      .then((unsub) => {
        cleanup = unsub;
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Only render when there are subscription lines — OR when always_visible is on (editor preview).
  if (!hasSubscription && !alwaysVisible) return null;

  function handleChange(/** @type {any} */ event) {
    const isChecked = Boolean(event.target.checked);
    setAccepted(isChecked);
    if (isChecked) setBlocked(false);
  }

  return (
    <s-box padding="base">
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="small" alignItems="center">
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
        </s-stack>
        {blocked && !accepted && (
          <s-banner tone="critical">
            <s-text>{i18n.translate("errors.must_accept")}</s-text>
          </s-banner>
        )}

      </s-stack>
    </s-box>
  );
}
