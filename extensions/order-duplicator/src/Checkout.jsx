import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";

const FALLBACK_DISCOUNT_LABEL = "10%";
const FALLBACK_REDO_VARIANT_ID = "gid://shopify/ProductVariant/45066643996809";

export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const {
    lines,
    settings,
    applyCartLinesChange,
    query,
    i18n,
  } = shopify;

  const DISCOUNT_LABEL = String(
    settings.current?.discount_label ?? FALLBACK_DISCOUNT_LABEL
  );
  const REDO_VARIANT_ID = String(
    settings.current?.redo_variant_id ?? FALLBACK_REDO_VARIANT_ID
  );

  // cartLines = only eligible (non-free, non-Redo) lines — these get duplicated
  const [cartLines, setCartLines] = useState(/** @type {any[]} */ ([]));
  // allLines = every line in cart (for the preview display)
  const [allLines, setAllLines] = useState(/** @type {any[]} */ ([]));
  const [productImages, setProductImages] = useState(/** @type {Record<string, {imageUrl: string|null, altText: string}>} */ (Object.create(null)));
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  /** @param {any} line */
  function isFreeItem(line) {
    const amt = parseFloat(line.cost?.totalAmount?.amount ?? "1");
    return amt === 0;
  }

  /** @param {any} line */
  function isRedoItem(line) {
    return line.merchandise?.id === REDO_VARIANT_ID;
  }

  // Subscribe to cart line changes
  useEffect(() => {
    function update() {
      const current = lines.current;
      setAllLines(current);
      setCartLines(current.filter((/** @type {any} */ l) => !isFreeItem(l) && !isRedoItem(l)));
    }
    update();
    const unsub = lines.subscribe(update);
    return () => unsub();
  }, []);

  // Fetch product images for ALL lines (including freebies and Redo)
  useEffect(() => {
    if (allLines.length === 0) return;

    const variantIds = allLines
      .map((l) => l.merchandise?.id)
      .filter(Boolean);

    if (variantIds.length === 0) return;

    const idsArg = variantIds.map((id) => `"${id}"`).join(", ");

    query(
      `{
        nodes(ids: [${idsArg}]) {
          ... on ProductVariant {
            id
            image {
              url(transform: { maxWidth: 120, maxHeight: 120 })
              altText
            }
            product {
              title
            }
          }
        }
      }`
    )
      .then((/** @type {any} */ result) => {
        /** @type {Record<string, {imageUrl: string|null, altText: string}>} */
        const map = {};
        /** @type {any[]} */ (result?.data?.nodes ?? []).forEach((/** @type {any} */ node) => {
          if (node?.id) {
            map[node.id] = {
              imageUrl: node.image?.url ?? null,
              altText: node.image?.altText ?? node.product?.title ?? "",
            };
          }
        });
        setProductImages(/** @type {any} */ (map));
      })
      .catch(() => {
        // Images are non-critical, silently fail
      });
  }, [allLines.length]);

  const handleDuplicate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Add duplicate lines marked with _duplicated attribute
      // so the Shopify Function can identify and discount them automatically
      for (const line of cartLines) {
        await applyCartLinesChange({
          type: "addCartLine",
          merchandiseId: line.merchandise.id,
          quantity: line.quantity,
          attributes: [{ key: "_duplicated", value: "true" }],
        });
      }

      setDone(true);
    } catch (err) {
      console.error("[order-duplicator] error:", err);
      setError(i18n.translate("error.generic"));
    }

    setLoading(false);
  }, [cartLines]);

  // Don't render if no eligible lines
  if (cartLines.length === 0) return null;

  // Compute totals for the preview summary
  const discountPercent = parseFloat(DISCOUNT_LABEL.replace("%", "")) || 0;

  // Full price = sum of all lines at their FINAL (duplicated) quantity, at full price
  const fullTotal = allLines.reduce((/** @type {number} */ acc, /** @type {any} */ line) => {
    const isFree = isFreeItem(line);
    const isRedo = isRedoItem(line);
    const qty = (!isFree && !isRedo) ? line.quantity * 2 : line.quantity;
    const unitPrice = isFree ? 0 : parseFloat(line.cost?.totalAmount?.amount ?? "0") / (line.quantity || 1);
    return acc + unitPrice * qty;
  }, 0);

  // Final price = fullTotal minus the discount applied only on the duplicated (eligible) items
  const eligibleTotal = cartLines.reduce((/** @type {number} */ acc, /** @type {any} */ line) => {
    return acc + parseFloat(line.cost?.totalAmount?.amount ?? "0");
  }, 0);
  const discountAmount = eligibleTotal * (discountPercent / 100);
  const finalTotal = fullTotal - discountAmount;

  // Success state
  if (done) {
    return (
      <s-box
        border="base"
        borderRadius="large"
        padding="base"
        background="subdued"
      >
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type="check-circle" tone="success" size="large" />
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">{i18n.translate("success.title")}</s-text>
            <s-text color="subdued" type="small">
            {i18n.translate("success.subtitle", { discount_label: DISCOUNT_LABEL })}
            </s-text>
          </s-stack>
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box
      border="base"
      borderRadius="large"
      padding="base"
      background="base"
    >
      <s-stack direction="block" gap="base">

        {/* Header */}
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type="reorder" tone="info" size="large" />
          <s-stack direction="block" gap="small-100">
            <s-heading>{i18n.translate("header.title", { discount_label: DISCOUNT_LABEL })}</s-heading>
            <s-text color="subdued" type="small">
              {i18n.translate("header.subtitle", { discount_label: DISCOUNT_LABEL })}
            </s-text>
          </s-stack>
        </s-stack>

        <s-divider />

        {/* Product list — shows projected final cart after duplication, sorted by price desc */}
        <s-stack direction="block" gap="small">
          {[...allLines]
            .sort((/** @type {any} */ a, /** @type {any} */ b) => {
              const priceA = parseFloat(a.cost?.totalAmount?.amount ?? "0") / (a.quantity || 1);
              const priceB = parseFloat(b.cost?.totalAmount?.amount ?? "0") / (b.quantity || 1);
              return priceB - priceA;
            })
            .map((line) => {
            const variantId = line.merchandise?.id;
            const imgData = productImages[variantId];
            const title =
              line.merchandise?.product?.title ??
              line.merchandise?.title ??
              i18n.translate("product.default_title");
            const isFree = isFreeItem(line);
            const isRedo = isRedoItem(line);
            const isDuplicated = !isFree && !isRedo;
            const originalQty = line.quantity;
            const finalQty = isDuplicated ? originalQty * 2 : originalQty;
            const unitPrice = isFree
              ? null
              : line.cost?.totalAmount
              ? parseFloat(line.cost.totalAmount.amount) / originalQty
              : null;
            const finalPrice = unitPrice !== null
              ? `$${(unitPrice * finalQty).toFixed(2)}`
              : null;

            return (
              <s-box
                key={variantId}
                borderRadius="base"
                padding="small"
                background="subdued"
              >
                <s-grid gridTemplateColumns="60px 1fr" gap="base">
                  {/* Fixed-size image container — always 60×60, never wraps */}
                  {imgData?.imageUrl ? (
                    <s-box
                      inlineSize="60px"
                      blockSize="60px"
                      minInlineSize="60px"
                      borderRadius="base"
                      overflow="hidden"
                    >
                      <s-image
                        src={imgData.imageUrl}
                        alt={imgData.altText}
                        aspectRatio="1/1"
                        objectFit="cover"
                        inlineSize="fill"
                      />
                    </s-box>
                  ) : (
                    <s-box
                      inlineSize="60px"
                      blockSize="60px"
                      minInlineSize="60px"
                      borderRadius="base"
                      background="base"
                      padding="small"
                    >
                      <s-icon type="image" size="large" tone="neutral" />
                    </s-box>
                  )}

                  {/* Text content — always in second column, never pushed below image */}
                  <s-stack direction="block" gap="small-100">
                    <s-text type="strong">{title}</s-text>
                    <s-stack direction="inline" gap="small" alignItems="center">
                      {isDuplicated ? (
                        <>
                          <s-badge tone="neutral">×{originalQty} → ×{finalQty}</s-badge>
                          {finalPrice && (
                            <s-text color="subdued" type="small">{finalPrice}</s-text>
                          )}
                        </>
                      ) : (
                        <>
                          <s-badge tone="neutral">×{finalQty}</s-badge>
                          <s-badge tone="neutral">{isFree ? i18n.translate("badge.free") : i18n.translate("badge.redo")}</s-badge>
                        </>
                      )}
                    </s-stack>
                  </s-stack>
                </s-grid>
              </s-box>
            );
          })}
        </s-stack>

        <s-divider />

        {/* Order preview summary */}
        <s-stack direction="block" gap="small-100">
          <s-text color="subdued" type="small">
            <s-text type="emphasis">{i18n.translate("preview.notice")}</s-text>
          </s-text>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-text color="subdued" type="redundant">
              ${fullTotal.toFixed(2)}
            </s-text>
            <s-text type="strong">
              ${finalTotal.toFixed(2)}
            </s-text>
            <s-badge tone="neutral">{i18n.translate("preview.discount_badge", { discount_label: DISCOUNT_LABEL })}</s-badge>
          </s-stack>
        </s-stack>

        <s-divider />
        <s-stack direction="block" gap="small">
          {error && (
            <s-banner tone="critical">
              <s-text>{error}</s-text>
            </s-banner>
          )}
          <s-button
            variant="primary"
            disabled={loading}
            onClick={handleDuplicate}
          >
            {loading
              ? i18n.translate("cta.button_loading")
              : i18n.translate("cta.button_idle", { discount_label: DISCOUNT_LABEL })}
          </s-button>
          <s-text color="subdued" type="small">
            {i18n.translate("cta.code_notice", { discount_label: DISCOUNT_LABEL })}
          </s-text>
        </s-stack>

      </s-stack>
    </s-box>
  );
}
