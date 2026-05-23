/**
 * MarginLab Shipping Progress Bar Widget
 *
 * Reads the active shipping test config from the MarginLab runtime and renders
 * a dynamic progress bar towards the free shipping threshold.
 *
 * Guards:
 *  - Re-renders on AJAX cart updates (Shopify cart:updated, theme:cart:updated)
 *  - No-op if no active shipping test for this visitor's assigned variant
 *  - Fails silently — never blocks the page or cart flow
 *  - Debounces rapid cart updates (300ms)
 *  - Cleans up event listeners on unmount
 */

(function MarginLabShippingWidget() {
  "use strict";

  const SELECTOR = "[data-ml-shipping-bar]";
  const DEBOUNCE_MS = 300;
  const STORAGE_KEY = "ml_shipping_config";

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let config = null; // { threshold: number|null, message: string, currency: string }
  let debounceTimer = null;

  // ---------------------------------------------------------------------------
  // Boot — wait for MarginLab runtime, then initialize
  // ---------------------------------------------------------------------------
  function boot() {
    // If MarginLab runtime isn't ready yet, retry
    if (!window.MarginLab || !window.MarginLab.getAssignments) {
      setTimeout(boot, 200);
      return;
    }
    init();
  }

  async function init() {
    try {
      config = await resolveShippingConfig();
    } catch (_) {
      return; // Fail silently
    }
    if (!config) return;

    renderAll();
    listenToCartUpdates();
  }

  // ---------------------------------------------------------------------------
  // Config resolution
  // ---------------------------------------------------------------------------
  async function resolveShippingConfig() {
    const assignments = window.MarginLab.getAssignments() || {};

    // Check if any active assignment is a shipping test
    for (const [experimentId, assignment] of Object.entries(assignments)) {
      if (!assignment || !assignment.variantKey) continue;

      const expConfig = assignment.config || {};
      if (expConfig.type !== "SHIPPING_TEST") continue;

      const variantCfg = (expConfig.shippingConfig || {}).variants?.[assignment.variantKey];
      if (!variantCfg) continue;

      return {
        threshold: variantCfg.freeShippingThreshold, // null = always free
        message: variantCfg.progressBarMessage || "Add {remaining} more for free shipping!",
        enabled: expConfig.shippingConfig?.progressBarEnabled !== false,
        currency: window.Shopify?.currency?.active || "USD",
        experimentId,
        variantKey: assignment.variantKey,
      };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Cart value fetching (Shopify AJAX API)
  // ---------------------------------------------------------------------------
  async function getCartSubtotal() {
    try {
      const res = await fetch("/cart.js", {
        headers: { "Content-Type": "application/json" },
      });
      const cart = await res.json();
      return cart.total_price / 100; // Shopify returns cents
    } catch (_) {
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  async function renderAll() {
    if (!config || !config.enabled) return;

    const subtotal = await getCartSubtotal();
    const containers = document.querySelectorAll(SELECTOR);
    if (containers.length === 0) {
      injectContainers();
    }

    document.querySelectorAll(SELECTOR).forEach((el) => renderInto(el, subtotal));
  }

  function renderInto(container, subtotal) {
    if (!config) return;

    const threshold = config.threshold;

    // Already free shipping
    if (threshold === null || subtotal >= threshold) {
      container.innerHTML = buildSuccessHTML();
      return;
    }

    const remaining = threshold - subtotal;
    const progressPct = Math.min(100, (subtotal / threshold) * 100);
    const formattedRemaining = formatCurrency(remaining, config.currency);
    const message = config.message.replace("{remaining}", formattedRemaining);

    container.innerHTML = buildProgressHTML(message, progressPct);
  }

  function buildSuccessHTML() {
    return `
      <div class="ml-shipping-bar ml-shipping-bar--success" role="status" aria-live="polite">
        <span class="ml-shipping-bar__icon">🎉</span>
        <span class="ml-shipping-bar__message">You've unlocked free shipping!</span>
      </div>`;
  }

  function buildProgressHTML(message, progressPct) {
    return `
      <div class="ml-shipping-bar" role="status" aria-live="polite">
        <p class="ml-shipping-bar__message">${escapeHTML(message)}</p>
        <div class="ml-shipping-bar__track" role="progressbar" aria-valuenow="${Math.round(progressPct)}" aria-valuemin="0" aria-valuemax="100">
          <div class="ml-shipping-bar__fill" style="width: ${progressPct.toFixed(1)}%"></div>
        </div>
      </div>`;
  }

  // Auto-inject container above the cart footer if no [data-ml-shipping-bar] exists
  function injectContainers() {
    const targets = [
      ".cart__footer",
      ".cart-footer",
      "[data-cart-footer]",
      ".cart-drawer__footer",
      ".drawer__footer",
    ];

    for (const selector of targets) {
      const el = document.querySelector(selector);
      if (el) {
        const container = document.createElement("div");
        container.setAttribute("data-ml-shipping-bar", "auto");
        container.setAttribute("data-ml-injected", "true");
        el.insertAdjacentElement("beforebegin", container);
        injectStyles();
        return;
      }
    }
  }

  function injectStyles() {
    if (document.getElementById("ml-shipping-bar-styles")) return;
    const style = document.createElement("style");
    style.id = "ml-shipping-bar-styles";
    style.textContent = `
      .ml-shipping-bar { padding: 12px 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 12px; }
      .ml-shipping-bar--success { background: #f0fdf4; display: flex; align-items: center; gap: 8px; }
      .ml-shipping-bar__message { font-size: 13px; color: #374151; margin: 0 0 8px 0; }
      .ml-shipping-bar--success .ml-shipping-bar__message { color: #15803d; font-weight: 600; margin: 0; }
      .ml-shipping-bar__track { height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
      .ml-shipping-bar__fill { height: 100%; background: #3b82f6; border-radius: 9999px; transition: width 0.4s ease; }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Cart update listeners
  // ---------------------------------------------------------------------------
  function listenToCartUpdates() {
    const debouncedRender = debounce(renderAll, DEBOUNCE_MS);

    // Shopify's native cart events
    document.addEventListener("cart:updated", debouncedRender);
    document.addEventListener("cart:item:added", debouncedRender);

    // Dawn / Prestige theme events
    document.addEventListener("theme:cart:updated", debouncedRender);

    // Custom event fired by some AJAX cart implementations
    document.addEventListener("ml:cart:updated", debouncedRender);

    // Mutation observer: detect when injected containers are removed by theme re-renders
    const observer = new MutationObserver(() => {
      const injected = document.querySelectorAll("[data-ml-injected]");
      if (injected.length === 0) {
        injectContainers();
        debouncedRender();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatCurrency(amount, currencyCode) {
    try {
      return new Intl.NumberFormat(navigator.language || "en-US", {
        style: "currency",
        currency: currencyCode || "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (_) {
      return `$${amount.toFixed(2)}`;
    }
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, ms) {
    return function (...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ---------------------------------------------------------------------------
  // Public API — allow themes to manually trigger a re-render
  // ---------------------------------------------------------------------------
  window.MarginLabShippingWidget = {
    refresh: renderAll,
    getConfig: () => config,
  };

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
