import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";

const BLOCK_HANDLE = "redo-offer";
const APP_HANDLE = "checkout-redo-engine";

// Fallback por si el merchant no configuró el setting aún
const FALLBACK_VARIANT_ID = "gid://shopify/ProductVariant/45066643996809";
const FALLBACK_PRICE = "2.98";

export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const { applyCartLinesChange, applyAttributeChange, lines, analytics, checkoutToken, settings } = shopify;

  // Lee el variant ID del setting configurado por el merchant en el editor de checkout
  // Si no está configurado, usa el fallback (HPN por defecto)
  const REDO_VARIANT_ID = String(settings.current?.redo_variant_id ?? FALLBACK_VARIANT_ID);
  const REDO_PRICE = String(settings.current?.redo_price ?? FALLBACK_PRICE);

  const [redoInCart, setRedoInCart] = useState(false);
  const [redoLineId, setRedoLineId] = useState("");
  const [loading, setLoading] = useState(false);

  // Subscribe to cart lines changes
  useEffect(() => {
    function checkRedo() {
      const currentLines = lines.current;
      const redoLine = currentLines.find(
        (line) => line.merchandise?.id === REDO_VARIANT_ID
      );
      setRedoInCart(!!redoLine);
      setRedoLineId(redoLine ? redoLine.id : "");
    }

    checkRedo();
    const unsubscribe = lines.subscribe(checkRedo);
    return () => unsubscribe();
  }, []);

  // Capa 1: cuando Redo pasa a estar en el carrito, graba el atributo en la orden
  // Este atributo persiste en el pedido y es visible en Shopify Admin y via Admin API
  useEffect(() => {
    if (!redoInCart) return;

    const token = checkoutToken?.value ?? checkoutToken ?? "unknown";
    const timestamp = new Date().toISOString();

    applyAttributeChange({
      type: "updateAttribute",
      key: "_redo_added_via",
      value: `block:${BLOCK_HANDLE}|app:${APP_HANDLE}|ts:${timestamp}`,
    }).catch((err) => console.error("[redo-tracking] attribute error:", err));
  }, [redoInCart]);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    try {
      if (redoInCart && redoLineId) {
        await applyCartLinesChange({
          type: "removeCartLine",
          id: redoLineId,
          quantity: 1,
        });
      } else {
        // Capa 2: evento analytics al momento exacto del click
        // Propagado a todos los Web Pixels (GA4, Segment, etc.)
        const token = checkoutToken?.value ?? checkoutToken ?? "unknown";
        analytics
          .publish("redo_protection_added", {
            extensionBlock: BLOCK_HANDLE,
            app: APP_HANDLE,
            variantId: REDO_VARIANT_ID,
            checkoutToken: token,
            timestamp: new Date().toISOString(),
          })
          .catch((err) => console.error("[redo-tracking] analytics error:", err));

        await applyCartLinesChange({
          type: "addCartLine",
          merchandiseId: REDO_VARIANT_ID,
          quantity: 1,
        });
      }
    } catch (error) {
      console.error("Redo cart change error:", error);
    }
    setLoading(false);
  }, [redoInCart, redoLineId]);

  // No mostrar nada si Redo ya está en el carrito
  if (redoInCart) {
    return null;
  }

  return (
    <s-box
      border="base"
      borderRadius="base"
      padding="base"
      background="base"
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type="check-circle" tone="success" size="large" />
          <s-stack direction="block" gap="small-100">
            <s-heading>Redo Order Protection</s-heading>
            <s-text color="subdued" type="small">
              Protect your order against loss, theft, or damage
            </s-text>
          </s-stack>
        </s-stack>

        <s-divider />

        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-text>✓ Free returns & exchanges</s-text>
            <s-text>✓ Worry-free returns</s-text>
          </s-stack>

          <s-stack direction="block" gap="small-100" alignItems="end">
            <s-text type="strong">${REDO_PRICE}</s-text>
            <s-button
              variant="primary"
              disabled={loading}
              onClick={handleToggle}
            >
              {loading ? "..." : redoInCart ? "✓ Added" : "Add Protection"}
            </s-button>
          </s-stack>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
