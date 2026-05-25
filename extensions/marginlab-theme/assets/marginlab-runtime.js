/**
 * MarginLab Storefront Runtime
 * Vanilla JS — no framework dependencies.
 *
 * Responsibilities:
 * 1. Create/restore visitor ID and session ID
 * 2. Fetch active experiment config from MarginLab API
 * 3. Evaluate targeting rules
 * 4. Assign visitor to experiments (consistent hashing, mirrors server logic)
 * 5. Apply content modifications to the DOM
 * 6. Handle split URL redirects
 * 7. Sync assignments to cart attributes
 * 8. Send events to MarginLab ingest API
 * 9. Expose public JS API (window.MarginLab)
 * 10. Debug overlay
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var APP_KEY = "__marginlab";
  var VISITOR_KEY = "_ml_vid";
  var SESSION_KEY = "_ml_sid";
  var ASSIGNMENT_KEY = "_ml_assignments";
  var DEBUG_PARAM = "marginlab_debug";
  var PREVIEW_PARAM = "marginlab_preview";
  var FORCE_PARAM = "marginlab_force";
  var ANTI_FLICKER_TIMEOUT = 300; // ms
  var CONFIG_TTL = 30000; // 30 seconds

  // ---------------------------------------------------------------------------
  // Runtime state
  // ---------------------------------------------------------------------------
  var state = {
    initialized: false,
    config: null,
    assignments: {},
    events: [],
    flushTimer: null,
    debugMode: false,
    shopDomain: "",
    apiBase: "",
    visitorId: "",
    sessionId: "",
    onReadyCallbacks: [],
  };

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------
  function init() {
    var shopify = window.Shopify;
    if (!shopify || !shopify.shop) {
      return;
    }

    state.shopDomain = shopify.shop;
    state.apiBase = (window.marginlabConfig || {}).apiBase || "";
    state.debugMode = getQueryParam(DEBUG_PARAM) === "true";

    if (!state.apiBase) {
      console.warn("[MarginLab] apiBase not configured. Set window.marginlabConfig.apiBase.");
      return;
    }

    state.visitorId = getOrCreateVisitorId();
    state.sessionId = getOrCreateSessionId();

    // Restore persisted assignments from localStorage
    try {
      var stored = localStorage.getItem(ASSIGNMENT_KEY);
      if (stored) state.assignments = JSON.parse(stored);
    } catch (e) {}

    // Anti-flicker: hide body to prevent content flash during content tests
    applyAntiFlicker();

    // Fetch config and run experiments + personalizations
    fetchConfig().then(function (config) {
      state.config = config;
      runExperiments(config);
      runPersonalizations(config);
      state.initialized = true;
      removeAntiFlicker();
      flushReadyCallbacks();
      trackEvent("page_viewed", "PAGE_VIEW", {});

      // Re-check personalizations periodically so inactivity detection fires
      // even if the user was active when the page first loaded.
      // Runs every 60 s; runPersonalizations is idempotent (session dedup prevents double-show).
      if (config.personalizations && config.personalizations.length) {
        setInterval(function () {
          runPersonalizations(config);
        }, 60000);
      }
    }).catch(function (err) {
      console.error("[MarginLab] Failed to fetch config:", err);
      removeAntiFlicker();
      state.initialized = true;
      flushReadyCallbacks();
    });

    // Listen for cart changes (AJAX cart support)
    listenForCartChanges();

    // Expose public API
    exposePublicAPI();

    if (state.debugMode) {
      scheduleDebugOverlay();
    }
  }

  // ---------------------------------------------------------------------------
  // Visitor / Session identity
  // ---------------------------------------------------------------------------
  function getOrCreateVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = generateUUID();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      return generateUUID();
    }
  }

  function getOrCreateSessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = generateUUID();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return generateUUID();
    }
  }

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ---------------------------------------------------------------------------
  // Config fetch with stale-while-revalidate
  // ---------------------------------------------------------------------------
  function fetchConfig() {
    var url = state.apiBase + "/api/runtime/config?shop=" + encodeURIComponent(state.shopDomain);

    // Check cache
    try {
      var cached = localStorage.getItem("_ml_config");
      var cachedAt = parseInt(localStorage.getItem("_ml_config_at") || "0");
      if (cached && Date.now() - cachedAt < CONFIG_TTL) {
        // Revalidate in background
        setTimeout(function () {
          fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (config) { cacheConfig(config); })
            .catch(function () {});
        }, 0);
        return Promise.resolve(JSON.parse(cached));
      }
    } catch (e) {}

    return fetch(url, {
      headers: { "X-Shop-Domain": state.shopDomain },
    }).then(function (r) {
      if (!r.ok) throw new Error("Config fetch failed: " + r.status);
      return r.json();
    }).then(function (config) {
      cacheConfig(config);
      return config;
    });
  }

  function cacheConfig(config) {
    try {
      localStorage.setItem("_ml_config", JSON.stringify(config));
      localStorage.setItem("_ml_config_at", Date.now().toString());
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Experiment runner
  // ---------------------------------------------------------------------------
  function runExperiments(config) {
    if (!config || !config.experiments) return;

    var ctx = buildTargetingContext();
    var previewParam = getQueryParam(PREVIEW_PARAM); // "expSlug:variantKey"
    var forceParam = getQueryParam(FORCE_PARAM);

    config.experiments.forEach(function (exp) {
      if (!["RUNNING", "PREVIEW", "QA"].includes(exp.status)) return;

      // Skip if already assigned
      if (state.assignments[exp.id]) {
        applyVariantModifications(exp, state.assignments[exp.id]);
        return;
      }

      // Handle force/preview overrides
      var forcedKey = null;
      if (previewParam) {
        var parts = previewParam.split(":");
        if (parts[0] === exp.slug || parts[0] === exp.id) {
          forcedKey = parts[1];
        }
      }
      if (forceParam) {
        var fp = forceParam.split(":");
        if (fp[0] === exp.slug) forcedKey = fp[1];
      }

      // Evaluate targeting
      if (!forcedKey && !evaluateTargeting(exp.targetingRules, ctx)) return;

      // Assign variant
      var variant = forcedKey
        ? exp.variants.find(function (v) { return v.key === forcedKey; })
        : assignVariant(state.visitorId, exp.id, exp.trafficAllocation, exp.variants);

      if (!variant) return;

      // Record assignment
      state.assignments[exp.id] = variant;
      persistAssignments();

      // Apply modifications
      applyVariantModifications(exp, variant);

      // Track assignment event
      trackEvent("experiment_assigned", "CUSTOM", {
        experimentId: exp.id,
        experimentSlug: exp.slug,
        variantId: variant.id,
        variantKey: variant.key,
      });

      // Push to integrations
      pushToIntegrations(exp, variant);
    });
  }

  // ---------------------------------------------------------------------------
  // Consistent hashing (mirrors server-side logic in lib/assignment.ts)
  // ---------------------------------------------------------------------------
  function hashToBucket(input) {
    // djb2 hash (no crypto API needed, deterministic)
    var hash = 5381;
    for (var i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 10000;
  }

  function assignVariant(visitorId, experimentId, trafficAllocation, variants) {
    if (!variants || !variants.length) return null;

    var trafficBucket = hashToBucket(experimentId + ":traffic:" + visitorId);
    var trafficThreshold = Math.floor((trafficAllocation / 100) * 10000);

    if (trafficBucket >= trafficThreshold) return null;

    var variantBucket = hashToBucket(experimentId + ":variant:" + visitorId);
    var variantThreshold = variantBucket % 100;

    var cumulative = 0;
    for (var i = 0; i < variants.length; i++) {
      cumulative += variants[i].allocationPercent;
      if (variantThreshold < cumulative) return variants[i];
    }

    return variants.find(function (v) { return v.isControl; }) || variants[0];
  }

  // ---------------------------------------------------------------------------
  // DOM modifications for content tests
  // ---------------------------------------------------------------------------
  function applyVariantModifications(exp, variant) {
    var modifications = variant.modifications || [];
    if (modifications.length) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          applyMods(modifications, exp, variant);
        });
      } else {
        applyMods(modifications, exp, variant);
      }
    }

    // Apply price overrides for DISPLAY_ONLY price tests
    if (exp.type === "PRICE_TEST" && variant.priceOverrides && variant.priceOverrides.length) {
      var strategy = (exp.priceConfig && exp.priceConfig.enforcementStrategy) || "DISPLAY_ONLY";
      if (strategy === "DISPLAY_ONLY") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function () {
            applyPriceOverrides(variant.priceOverrides);
          });
        } else {
          applyPriceOverrides(variant.priceOverrides);
        }
      }
    }
  }

  // Price override selectors — covers Dawn, Debut, Prestige, and most Shopify themes
  var PRICE_SELECTORS = [
    ".price__regular .price-item--regular",
    ".price .price-item--regular",
    "[data-product-price]",
    ".product__price .money",
    ".product-single__price .money",
    ".price-item--regular",
    ".product__price",
    ".product-price .money",
  ];
  var COMPARE_PRICE_SELECTORS = [
    ".price__sale .price-item--sale",
    "[data-compare-price]",
    ".product__price .price--compare .money",
    ".price-item--sale",
  ];

  function applyPriceOverrides(overrides) {
    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    var product = meta && meta.product;
    if (!product) return;

    // Find if any override matches the currently selected variant
    var selectedVariantId = null;
    try {
      var form = document.querySelector("form[action='/cart/add']");
      var hiddenInput = form && form.querySelector("input[name='id']");
      if (hiddenInput) selectedVariantId = "gid://shopify/ProductVariant/" + hiddenInput.value;
    } catch (e) {}

    overrides.forEach(function (override) {
      if (selectedVariantId && override.shopifyVariantId !== selectedVariantId) return;

      var currency = window.Shopify && window.Shopify.currency && window.Shopify.currency.active || "USD";
      var formattedPrice = formatMoney(parseFloat(override.price), currency);

      PRICE_SELECTORS.forEach(function (sel) {
        querySelectorAll(sel).forEach(function (el) {
          el.textContent = formattedPrice;
          el.setAttribute("data-ml-price-override", "1");
        });
      });

      if (override.compareAtPrice) {
        var formattedCompare = formatMoney(parseFloat(override.compareAtPrice), currency);
        COMPARE_PRICE_SELECTORS.forEach(function (sel) {
          querySelectorAll(sel).forEach(function (el) {
            el.textContent = formattedCompare;
            el.setAttribute("data-ml-price-override", "1");
          });
        });
      }
    });
  }

  function formatMoney(amount, currencyCode) {
    try {
      return new Intl.NumberFormat(navigator.language || "en-US", {
        style: "currency",
        currency: currencyCode || "USD",
      }).format(amount);
    } catch (e) {
      return "$" + amount.toFixed(2);
    }
  }

  function applyMods(mods, exp, variant) {
    mods.forEach(function (mod) {
      try {
        applyMod(mod, exp, variant);
      } catch (e) {
        if (state.debugMode) {
          console.error("[MarginLab] Modification error:", mod, e);
        }
      }
    });

    // Observe dynamic content (for AJAX-rendered sections)
    observeDynamicContent(mods, exp, variant);
  }

  function applyMod(mod, exp, variant) {
    switch (mod.type) {
      case "text_replace":
        querySelectorAll(mod.selector).forEach(function (el) {
          el.textContent = mod.value;
          el.setAttribute("data-ml-modified", "1");
        });
        break;

      case "image_replace":
        querySelectorAll(mod.selector).forEach(function (el) {
          if (el.tagName === "IMG") {
            el.src = mod.value;
            el.setAttribute("data-ml-modified", "1");
          }
        });
        break;

      case "link_replace":
        querySelectorAll(mod.selector).forEach(function (el) {
          if (el.tagName === "A") {
            el.href = mod.value;
            el.setAttribute("data-ml-modified", "1");
          }
        });
        break;

      case "hide_element":
        querySelectorAll(mod.selector).forEach(function (el) {
          el.style.display = "none";
          el.setAttribute("data-ml-modified", "1");
        });
        break;

      case "show_element":
        querySelectorAll(mod.selector).forEach(function (el) {
          el.style.display = "";
          el.setAttribute("data-ml-modified", "1");
        });
        break;

      case "insert_before":
        querySelectorAll(mod.selector).forEach(function (el) {
          var div = document.createElement("div");
          div.innerHTML = sanitizeHTML(mod.value);
          div.setAttribute("data-ml-inserted", "1");
          el.parentNode && el.parentNode.insertBefore(div, el);
        });
        break;

      case "insert_after":
        querySelectorAll(mod.selector).forEach(function (el) {
          var div = document.createElement("div");
          div.innerHTML = sanitizeHTML(mod.value);
          div.setAttribute("data-ml-inserted", "1");
          el.parentNode && el.parentNode.insertBefore(div, el.nextSibling);
        });
        break;

      case "replace_html":
        querySelectorAll(mod.selector).forEach(function (el) {
          el.innerHTML = sanitizeHTML(mod.value);
          el.setAttribute("data-ml-modified", "1");
        });
        break;

      case "add_class":
        querySelectorAll(mod.selector).forEach(function (el) {
          el.classList.add.apply(el.classList, mod.value.split(" "));
        });
        break;

      case "remove_class":
        querySelectorAll(mod.selector).forEach(function (el) {
          el.classList.remove.apply(el.classList, mod.value.split(" "));
        });
        break;

      case "css_inject":
        injectCSS(mod.css || mod.value, exp.id + "-" + variant.id);
        break;

      case "redirect":
        if (mod.url && window.location.href !== mod.url) {
          var targetUrl = mod.url;
          if (mod.preserveQueryParams) {
            var qs = window.location.search;
            if (qs) {
              targetUrl += (mod.url.includes("?") ? "&" : "?") + qs.slice(1);
            }
          }
          // Loop protection: add ml_redirected param
          if (getQueryParam("ml_redirected") !== "1") {
            targetUrl += (targetUrl.includes("?") ? "&" : "?") + "ml_redirected=1";
            window.location.replace(targetUrl);
          }
        }
        break;

      default:
        if (state.debugMode) {
          console.warn("[MarginLab] Unknown modification type:", mod.type);
        }
    }
  }

  function observeDynamicContent(mods, exp, variant) {
    if (typeof MutationObserver === "undefined") return;

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            mods.forEach(function (mod) {
              try {
                applyModToNode(node, mod);
              } catch (e) {}
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Disconnect after 10 seconds to avoid memory leaks
    setTimeout(function () { observer.disconnect(); }, 10000);
  }

  function applyModToNode(root, mod) {
    if (mod.type === "text_replace" && mod.selector) {
      root.querySelectorAll && root.querySelectorAll(mod.selector).forEach(function (el) {
        if (!el.getAttribute("data-ml-modified")) {
          el.textContent = mod.value;
          el.setAttribute("data-ml-modified", "1");
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-flicker
  // ---------------------------------------------------------------------------
  var ANTI_FLICKER_ID = "__ml_af";

  /**
   * Anti-flicker must run BEFORE fetchConfig resolves.
   * We decide whether to hide the body based on the CACHED config from the
   * previous page load (stored in localStorage). If the cache says there are
   * active CONTENT_TEST experiments, we hide the body immediately. The timeout
   * is always set as a safety net so the page is never permanently hidden.
   */
  function applyAntiFlicker() {
    var shouldHide = false;

    try {
      var cached = localStorage.getItem("_ml_config");
      if (cached) {
        var cachedConfig = JSON.parse(cached);
        var settings = cachedConfig && cachedConfig.settings;
        if (settings && settings.antiFlickerEnabled) {
          var hasContentTest = Array.isArray(cachedConfig.experiments) &&
            cachedConfig.experiments.some(function (e) {
              return e.status === "RUNNING" && e.type === "CONTENT_TEST";
            });
          if (hasContentTest) shouldHide = true;
        }
      }
    } catch (e) {}

    if (!shouldHide) return;

    var style = document.createElement("style");
    style.id = ANTI_FLICKER_ID;
    style.textContent = "body { opacity: 0 !important; transition: none !important; }";
    document.head && document.head.appendChild(style);

    // Safety timeout — always remove, even if fetchConfig fails
    var timeout = ANTI_FLICKER_TIMEOUT;
    try {
      var cachedCfg = JSON.parse(localStorage.getItem("_ml_config") || "{}");
      timeout = (cachedCfg && cachedCfg.settings && cachedCfg.settings.antiFlickerTimeout) || ANTI_FLICKER_TIMEOUT;
    } catch (e) {}
    setTimeout(removeAntiFlicker, timeout);
  }

  function removeAntiFlicker() {
    var el = document.getElementById(ANTI_FLICKER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.body && (document.body.style.opacity = "");
  }

  // ---------------------------------------------------------------------------
  // Cart sync
  // ---------------------------------------------------------------------------
  function listenForCartChanges() {
    // Listen for fetch/XHR calls to /cart/add.js, /cart/change.js, /cart/update.js
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var promise = originalFetch.apply(this, arguments);

      if (/\/cart\/(add|change|update)/.test(url)) {
        promise.then(function (response) {
          if (response.ok) {
            response.clone().json().then(function (cartData) {
              syncAssignmentsToCart(cartData.token);
            }).catch(function () {});
          }
        }).catch(function () {});
      }

      return promise;
    };
  }

  function syncAssignmentsToCart(cartToken) {
    if (!cartToken || !Object.keys(state.assignments).length) return;

    var assignmentList = Object.entries(state.assignments).map(function (entry) {
      var expId = entry[0];
      var variant = entry[1];
      return {
        experimentId: expId,
        variantId: variant.id,
        experimentSlug: variant.slug || expId,
        variantKey: variant.key,
      };
    });

    fetch(state.apiBase + "/api/runtime/cart-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shop-Domain": state.shopDomain,
      },
      body: JSON.stringify({
        shopDomain: state.shopDomain,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        cartToken: cartToken,
        assignments: assignmentList,
      }),
    }).catch(function () {});

    // Also write to cart attributes via Shopify AJAX API
    var attributes = { "_ml_visitor_id": state.visitorId };
    assignmentList.forEach(function (a) {
      attributes["_ml_exp_" + a.experimentId.slice(0, 8)] = a.variantKey;
    });

    fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: attributes }),
    }).catch(function () {});
  }

  // ---------------------------------------------------------------------------
  // Event tracking
  // ---------------------------------------------------------------------------
  function trackEvent(eventName, eventType, metadata) {
    var activeAssignments = Object.entries(state.assignments);
    var experimentId = activeAssignments.length > 0 ? activeAssignments[0][0] : undefined;
    var variantId = activeAssignments.length > 0 ? activeAssignments[0][1].id : undefined;

    state.events.push({
      eventName: eventName,
      eventType: eventType,
      experimentId: experimentId,
      variantId: variantId,
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer,
      deviceType: getDeviceType(),
      country: window.Shopify && window.Shopify.country,
      currency: window.Shopify && window.Shopify.currency && window.Shopify.currency.active,
      utmSource: getQueryParam("utm_source"),
      utmMedium: getQueryParam("utm_medium"),
      utmCampaign: getQueryParam("utm_campaign"),
      utmContent: getQueryParam("utm_content"),
      utmTerm: getQueryParam("utm_term"),
      metadata: metadata || {},
      occurredAt: new Date().toISOString(),
    });

    // Debounce flush
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(flushEvents, 2000);
  }

  function flushEvents() {
    if (!state.events.length) return;
    var batch = state.events.slice();
    state.events = [];

    var payload = JSON.stringify({
      shopDomain: state.shopDomain,
      visitorId: state.visitorId,
      sessionId: state.sessionId,
      events: batch,
    });

    // Use sendBeacon when available (page unload safe)
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(state.apiBase + "/api/runtime/events", blob);
    } else {
      fetch(state.apiBase + "/api/runtime/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shop-Domain": state.shopDomain,
        },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // Flush on page unload
  window.addEventListener("beforeunload", flushEvents);
  window.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushEvents();
  });

  // ---------------------------------------------------------------------------
  // Targeting evaluator (mirrors lib/targeting.ts)
  // ---------------------------------------------------------------------------
  function buildTargetingContext() {
    return {
      deviceType: getDeviceType(),
      country: window.Shopify && window.Shopify.country,
      currency: window.Shopify && window.Shopify.currency && window.Shopify.currency.active,
      url: window.location.href,
      path: window.location.pathname,
      utmSource: getQueryParam("utm_source"),
      utmMedium: getQueryParam("utm_medium"),
      utmCampaign: getQueryParam("utm_campaign"),
      isNewVisitor: !localStorage.getItem("_ml_returning"),
      isReturningVisitor: !!localStorage.getItem("_ml_returning"),
      isCustomerLoggedIn: !!(window.Shopify && window.Shopify.customer),
      currentDate: new Date(),
    };
  }

  function evaluateTargeting(rules, ctx) {
    if (!rules || !rules.length) return true;
    return rules.every(function (group) { return evaluateGroup(group, ctx); });
  }

  function evaluateGroup(group, ctx) {
    if (!group.conditions || !group.conditions.length) return true;
    if (group.operator === "OR") {
      return group.conditions.some(function (c) { return evaluateCondition(c, ctx); });
    }
    return group.conditions.every(function (c) { return evaluateCondition(c, ctx); });
  }

  function evaluateCondition(cond, ctx) {
    var actual;
    switch (cond.type) {
      case "device": actual = ctx.deviceType; break;
      case "country": actual = ctx.country; break;
      case "currency": actual = ctx.currency; break;
      case "url_contains": return (ctx.url || "").includes(cond.value);
      case "utm_source": actual = ctx.utmSource; break;
      case "utm_medium": actual = ctx.utmMedium; break;
      case "utm_campaign": actual = ctx.utmCampaign; break;
      case "new_visitor": return cond.operator === "eq" ? ctx.isNewVisitor === cond.value : ctx.isNewVisitor !== cond.value;
      case "returning_visitor": return cond.operator === "eq" ? ctx.isReturningVisitor === cond.value : ctx.isReturningVisitor !== cond.value;
      case "customer_logged_in": return cond.operator === "eq" ? ctx.isCustomerLoggedIn === cond.value : ctx.isCustomerLoggedIn !== cond.value;
      case "date_after": return ctx.currentDate >= new Date(cond.value);
      case "date_before": return ctx.currentDate < new Date(cond.value);
      default: return true;
    }

    if (actual === undefined || actual === null) return false;

    if (cond.operator === "eq") return String(actual).toLowerCase() === String(cond.value).toLowerCase();
    if (cond.operator === "neq") return String(actual).toLowerCase() !== String(cond.value).toLowerCase();
    if (cond.operator === "in") return Array.isArray(cond.value) && cond.value.some(function (v) { return String(actual).toLowerCase() === String(v).toLowerCase(); });
    if (cond.operator === "contains") return String(actual).toLowerCase().includes(String(cond.value).toLowerCase());

    return true;
  }

  // ---------------------------------------------------------------------------
  // Integration hooks
  // ---------------------------------------------------------------------------
  function pushToIntegrations(exp, variant) {
    // Google Analytics / gtag
    if (window.gtag) {
      window.gtag("event", "experiment_impression", {
        experiment_id: exp.id,
        experiment_name: exp.slug,
        variant_id: variant.id,
        variant_name: variant.key,
      });
    }

    // dataLayer (GA4 / GTM)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "marginlab_experiment",
      marginlab_experiment_id: exp.id,
      marginlab_experiment_slug: exp.slug,
      marginlab_variant_id: variant.id,
      marginlab_variant_key: variant.key,
    });

    // Klaviyo
    if (window._learnq) {
      window._learnq.push(["track", "MarginLab Experiment", {
        experimentId: exp.id,
        experimentSlug: exp.slug,
        variantKey: variant.key,
      }]);
    }

    // Microsoft Clarity
    if (window.clarity) {
      window.clarity("set", "ml_experiment", exp.slug);
      window.clarity("set", "ml_variant", variant.key);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function exposePublicAPI() {
    window.MarginLab = {
      getAssignment: function (experimentSlug) {
        if (!state.config) return null;
        var exp = state.config.experiments.find(function (e) {
          return e.slug === experimentSlug || e.id === experimentSlug;
        });
        return exp ? (state.assignments[exp.id] || null) : null;
      },
      getActiveExperiments: function () {
        return Object.keys(state.assignments).map(function (expId) {
          return {
            experimentId: expId,
            variant: state.assignments[expId],
          };
        });
      },
      getConfig: function () { return state.config; },
      track: function (eventName, metadata) {
        trackEvent(eventName, "CUSTOM", metadata || {});
      },
      refresh: function () {
        localStorage.removeItem("_ml_config");
        fetchConfig().then(function (config) {
          state.config = config;
          runExperiments(config);
        });
      },
      onReady: function (callback) {
        if (state.initialized) {
          callback();
        } else {
          state.onReadyCallbacks.push(callback);
        }
      },
      forceVariant: function (experimentSlug, variantKey) {
        if (state.config) {
          var exp = state.config.experiments.find(function (e) {
            return e.slug === experimentSlug || e.id === experimentSlug;
          });
          if (exp) {
            var variant = exp.variants.find(function (v) { return v.key === variantKey; });
            if (variant) {
              state.assignments[exp.id] = variant;
              persistAssignments();
              applyVariantModifications(exp, variant);
            }
          }
        }
      },
      getVisitorId: function () { return state.visitorId; },
      getSessionId: function () { return state.sessionId; },
    };
  }

  function flushReadyCallbacks() {
    state.onReadyCallbacks.forEach(function (cb) {
      try { cb(); } catch (e) {}
    });
    state.onReadyCallbacks = [];
  }

  // ---------------------------------------------------------------------------
  // Debug overlay
  // ---------------------------------------------------------------------------
  function scheduleDebugOverlay() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderDebugOverlay);
    } else {
      setTimeout(renderDebugOverlay, 500);
    }
  }

  function renderDebugOverlay() {
    var overlay = document.createElement("div");
    overlay.id = "__ml_debug";
    overlay.style.cssText = [
      "position: fixed",
      "bottom: 16px",
      "right: 16px",
      "background: rgba(0,0,0,0.85)",
      "color: #fff",
      "font-family: monospace",
      "font-size: 11px",
      "padding: 12px 14px",
      "border-radius: 8px",
      "z-index: 99999",
      "max-width: 280px",
      "line-height: 1.5",
      "box-shadow: 0 4px 16px rgba(0,0,0,0.4)",
    ].join("; ");

    var content = "<strong style='color:#60a5fa'>MarginLab Debug</strong><br>";
    content += "Visitor: " + state.visitorId.slice(0, 8) + "...<br>";
    content += "Shop: " + state.shopDomain + "<br><br>";

    var assignments = Object.entries(state.assignments);
    if (assignments.length === 0) {
      content += "<em style='color:#9ca3af'>No active assignments</em>";
    } else {
      content += "<strong style='color:#a78bfa'>Assignments:</strong><br>";
      assignments.forEach(function (entry) {
        var variant = entry[1];
        content += "• " + (variant.name || variant.key) + " [" + (variant.isControl ? "control" : "variant") + "]<br>";
      });
    }

    // Add close button
    content += "<br><button onclick=\"document.getElementById('__ml_debug').remove()\" style='background:#374151;border:none;color:#d1d5db;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;'>Close</button>";

    overlay.innerHTML = content;
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function querySelectorAll(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function getQueryParam(name) {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || "";
  }

  function getDeviceType() {
    var ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod/.test(ua)) return "mobile";
    if (/tablet|ipad/.test(ua)) return "tablet";
    return "desktop";
  }

  function injectCSS(css, id) {
    var existingId = "__ml_css_" + id;
    if (document.getElementById(existingId)) return;
    var style = document.createElement("style");
    style.id = existingId;
    style.textContent = css;
    document.head && document.head.appendChild(style);
  }

  // HTML sanitization — uses DOMPurify if available, then Sanitizer API,
  // then a template-element + allowlist walk as a final fallback.
  var SAFE_TAGS = new Set([
    "a", "b", "br", "caption", "code", "del", "div", "em", "figure", "figcaption",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p",
    "pre", "s", "small", "span", "strong", "sub", "sup", "table", "tbody", "td",
    "tfoot", "th", "thead", "tr", "u", "ul",
  ]);
  // Attributes allowed per-element (null = allowed on any element)
  var SAFE_ATTRS = new Set([
    "alt", "class", "colspan", "dir", "height", "href", "id", "lang",
    "rel", "rowspan", "src", "style", "target", "title", "width",
  ]);
  var UNSAFE_ATTR_PATTERN = /^(on|data-on)/i;
  var UNSAFE_HREF_PATTERN = /^\s*(javascript|vbscript|data):/i;

  function sanitizeNode(node) {
    var toRemove = [];
    // Walk all descendants
    var walker = document.createTreeWalker(node, 5 /* SHOW_ELEMENT | SHOW_TEXT */);
    var current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === 1) { // Element
        var tag = current.tagName.toLowerCase();
        if (!SAFE_TAGS.has(tag)) {
          toRemove.push(current);
          continue;
        }
        // Strip unsafe attributes
        var attrNames = Array.prototype.slice.call(current.attributes).map(function (a) { return a.name; });
        attrNames.forEach(function (attr) {
          if (!SAFE_ATTRS.has(attr) || UNSAFE_ATTR_PATTERN.test(attr)) {
            current.removeAttribute(attr);
            return;
          }
          if (attr === "href" || attr === "src") {
            var val = current.getAttribute(attr) || "";
            if (UNSAFE_HREF_PATTERN.test(val)) current.removeAttribute(attr);
          }
          if (attr === "target") {
            // Force _blank links to be safe
            if (current.getAttribute("target") === "_blank") {
              var rel = current.getAttribute("rel") || "";
              if (!rel.includes("noopener")) {
                current.setAttribute("rel", (rel + " noopener noreferrer").trim());
              }
            }
          }
        });
      }
    }
    toRemove.forEach(function (el) {
      // Replace removed elements with their text content to preserve visible text
      var text = document.createTextNode(el.textContent || "");
      el.parentNode && el.parentNode.replaceChild(text, el);
    });
    return node;
  }

  function sanitizeHTML(html) {
    if (!html) return "";
    // 1. DOMPurify (if loaded by the theme or another app)
    if (typeof window.DOMPurify !== "undefined" && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }
    // 2. Sanitizer API (Chrome 116+, Edge)
    if (typeof window.Sanitizer !== "undefined") {
      try {
        var tmp = document.createElement("div");
        tmp.setHTML(html, new window.Sanitizer());
        return tmp.innerHTML;
      } catch (e) {}
    }
    // 3. Template element + allowlist walk
    try {
      var tmpl = document.createElement("template");
      tmpl.innerHTML = html;
      var frag = tmpl.content;
      sanitizeNode(frag);
      var out = document.createElement("div");
      out.appendChild(frag.cloneNode(true));
      return out.innerHTML;
    } catch (e) {}
    // 4. Last resort: strip all tags
    return String(html).replace(/<[^>]*>/g, "");
  }

  function persistAssignments() {
    try {
      localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(state.assignments));
      // Mark as returning visitor
      localStorage.setItem("_ml_returning", "1");
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Personalization engine
  // ---------------------------------------------------------------------------

  // Storage keys for abandoned-cart detection
  var LAST_ACTIVE_KEY = "_ml_last_active";
  var CART_ITEMS_KEY = "_ml_cart_items";
  var ACR_SHOWN_KEY = "_ml_acr_shown"; // set of personalizationIds shown this session

  /**
   * Detect whether the current visitor qualifies as a "cart abandoner" for a
   * given set of targeting rules.
   *
   * Targeting rule fields supported:
   *   cart_has_items      : boolean
   *   inactivity_minutes  : number (gte)
   *   cart_value          : number (gte, requires Shopify cart API)
   *   visitor_type        : "returning" | "new"
   */
  function evaluatePersonalizationRules(rules, context) {
    if (!rules || rules.length === 0) return true;
    return rules.every(function (rule) {
      var field = rule.field;
      var op = rule.operator;
      var val = rule.value;

      if (field === "cart_has_items") {
        var hasItems = context.cartItemCount > 0;
        return op === "equals" ? hasItems === val : !hasItems === val;
      }
      if (field === "inactivity_minutes") {
        var lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || "0", 10);
        var inactiveMs = Date.now() - lastActive;
        var inactiveMin = inactiveMs / 60000;
        if (op === "gte") return inactiveMin >= val;
        if (op === "lte") return inactiveMin <= val;
      }
      if (field === "cart_value") {
        var cartVal = context.cartValue || 0;
        if (op === "gte") return cartVal >= val;
        if (op === "lte") return cartVal <= val;
      }
      if (field === "visitor_type") {
        var isReturning = !!localStorage.getItem("_ml_returning");
        var visitorType = isReturning ? "returning" : "new";
        return op === "equals" ? visitorType === val : visitorType !== val;
      }
      // Unknown rule — pass through
      return true;
    });
  }

  /**
   * Apply an ABANDONED_CART modification to the DOM.
   * Looks for the Shopify announcement bar and replaces its content,
   * or creates a floating banner if no announcement bar is found.
   */
  function applyAbandonedCartModification(mod, personalizationId) {
    if (!mod || mod.type !== "announcement_bar") return;

    var message = mod.message || "";
    var subtext = mod.subtext || "";
    var ctaLabel = mod.ctaLabel || "Complete your order";
    var ctaUrl = mod.ctaUrl || "/cart";

    // Track impression
    trackEvent("personalization_view", "PAGE_VIEW", { personalizationId: personalizationId });

    // Mark as shown this session
    try {
      var shown = JSON.parse(sessionStorage.getItem(ACR_SHOWN_KEY) || "[]");
      shown.push(personalizationId);
      sessionStorage.setItem(ACR_SHOWN_KEY, JSON.stringify(shown));
    } catch (e) {}

    // Try to find existing announcement bar (common Shopify theme selectors)
    var announcementBar =
      document.querySelector(".announcement-bar") ||
      document.querySelector(".announcement-bar__message") ||
      document.querySelector("[data-announcement-bar]") ||
      document.querySelector(".shopify-section-announcement");

    if (announcementBar) {
      // Inject into existing bar
      var inner = document.createElement("span");
      inner.setAttribute("data-ml-acr", "1");
      inner.innerHTML =
        '<span style="font-weight:600">' + escapeHtml(message) + "</span>" +
        (subtext ? ' <span style="opacity:0.8">' + escapeHtml(subtext) + "</span>" : "") +
        ' <a href="' + escapeHtml(ctaUrl) + '" style="text-decoration:underline;margin-left:8px">' +
        escapeHtml(ctaLabel) + "</a>";

      // Don't inject twice
      if (!announcementBar.querySelector("[data-ml-acr]")) {
        announcementBar.prepend(inner);
      }
    } else {
      // Create floating banner
      if (document.getElementById("ml-acr-banner")) return;

      var banner = document.createElement("div");
      banner.id = "ml-acr-banner";
      banner.setAttribute("data-ml-acr", "1");
      banner.style.cssText = [
        "position:fixed", "top:0", "left:0", "right:0", "z-index:99999",
        "background:#1a56db", "color:#fff", "padding:10px 16px",
        "font-size:14px", "display:flex", "align-items:center",
        "justify-content:center", "gap:12px", "box-shadow:0 2px 8px rgba(0,0,0,0.15)",
      ].join(";");

      var content = document.createElement("span");
      content.innerHTML =
        '<strong>' + escapeHtml(message) + "</strong>" +
        (subtext ? " &mdash; " + escapeHtml(subtext) : "");

      var cta = document.createElement("a");
      cta.href = ctaUrl;
      cta.textContent = ctaLabel;
      cta.style.cssText =
        "background:#fff;color:#1a56db;padding:4px 12px;border-radius:4px;font-weight:600;text-decoration:none;font-size:13px";
      cta.addEventListener("click", function () {
        trackEvent("personalization_click", "CLICK", { personalizationId: personalizationId });
      });

      var close = document.createElement("button");
      close.textContent = "×";
      close.style.cssText =
        "background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:0.7;margin-left:8px;padding:0 4px";
      close.addEventListener("click", function () {
        banner.remove();
      });

      banner.appendChild(content);
      banner.appendChild(cta);
      banner.appendChild(close);
      document.body.prepend(banner);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Main personalization runner — called after config is loaded.
   *
   * Priority: lower number = evaluated first. First matching personalization wins
   * for each modification type (announcement_bar).
   */
  function runPersonalizations(config) {
    if (!config || !config.personalizations || !config.personalizations.length) return;

    // Build visitor context
    var cartItemCount = getCartItemCount();
    var cartValue = getCartValue();
    var context = { cartItemCount: cartItemCount, cartValue: cartValue };

    // ACR personalizations already sorted by priority (asc) from server
    var acrPersonalizations = config.personalizations.filter(function (p) {
      return p.type === "ABANDONED_CART";
    });

    // Track which modification types have already been applied (one per type)
    var appliedTypes = {};

    // Deduplicate: don't show same personalization twice in one session
    var shownThisSession = [];
    try {
      shownThisSession = JSON.parse(sessionStorage.getItem(ACR_SHOWN_KEY) || "[]");
    } catch (e) {}

    // Check schedule validity
    var now = Date.now();

    for (var i = 0; i < acrPersonalizations.length; i++) {
      var p = acrPersonalizations[i];

      // Skip if already shown this session
      if (shownThisSession.indexOf(p.id) !== -1) continue;

      // Skip if outside schedule window
      if (p.startsAt && new Date(p.startsAt).getTime() > now) continue;
      if (p.endsAt && new Date(p.endsAt).getTime() < now) continue;

      // Evaluate targeting rules
      if (!evaluatePersonalizationRules(p.targetingRules, context)) continue;

      // Apply modifications (first winner per type)
      var mods = p.modifications || [];
      for (var j = 0; j < mods.length; j++) {
        var mod = mods[j];
        var modType = mod.type || "unknown";
        if (appliedTypes[modType]) continue; // already applied this type
        applyAbandonedCartModification(mod, p.id);
        appliedTypes[modType] = true;
      }
    }
  }

  /**
   * Get current cart item count.
   * Tries multiple signals in order of reliability.
   */
  function getCartItemCount() {
    // 1. Shopify global cart object (set by themes via window.theme or window.cart)
    if (window.theme && window.theme.cartItemCount) return window.theme.cartItemCount;
    if (window.cart && window.cart.item_count) return window.cart.item_count;

    // 2. Cart count DOM elements
    var el =
      document.querySelector("[data-cart-count]") ||
      document.querySelector(".cart-count") ||
      document.querySelector(".cart__count") ||
      document.querySelector("[data-item-count]");
    if (el) {
      var n = parseInt(el.textContent || el.getAttribute("data-cart-count") || "0", 10);
      if (!isNaN(n)) return n;
    }

    // 3. Cached value from last cart update
    try {
      var cached = parseInt(localStorage.getItem(CART_ITEMS_KEY) || "0", 10);
      if (!isNaN(cached)) return cached;
    } catch (e) {}

    return 0;
  }

  /**
   * Get current cart value (in subunits or currency units depending on theme).
   * Returns 0 if unavailable — ACR will still trigger, just without the cart_value rule.
   */
  function getCartValue() {
    if (window.cart && window.cart.total_price) {
      return window.cart.total_price / 100; // Shopify uses cents
    }
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta) {
      var meta = window.ShopifyAnalytics.meta;
      if (meta.cart && meta.cart.total_price) return meta.cart.total_price / 100;
    }
    return 0;
  }

  /**
   * Update last-active timestamp on every user interaction.
   * This is what we compare against inactivity_minutes targeting rule.
   */
  function trackLastActive() {
    try {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch (e) {}
  }

  // Track user activity for inactivity detection
  ["mousemove", "keydown", "scroll", "touchstart", "click"].forEach(function (evt) {
    document.addEventListener(evt, trackLastActive, { passive: true });
  });

  // Initialize last-active if not set
  try {
    if (!localStorage.getItem(LAST_ACTIVE_KEY)) {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    }
  } catch (e) {}

  // Mark returning visitors: set a flag on first visit; on subsequent loads the flag exists
  try {
    var ML_RETURNING_KEY = "_ml_returning";
    if (localStorage.getItem(ML_RETURNING_KEY)) {
      // already set — visitor has been here before (returning)
    } else {
      // first visit — mark for next session
      localStorage.setItem(ML_RETURNING_KEY, "1");
    }
  } catch (e) {}

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
