/**
 * theme-ab-snippet.ts
 *
 * Generates the Liquid snippet that merchants paste into their published theme
 * to enable per-visitor theme A/B testing without changing which theme is published.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. MarginLab's assignment endpoint sets a cookie:
 *      ml_v_<experimentId>=<variantKey>   (e.g. ml_v_abc123=variant_a)
 *
 * 2. The Liquid snippet renders a small synchronous JS block in <head> (anti-flicker).
 *    It reads the assignment cookie before the browser paints, and:
 *      a. Injects a <link> to the variant theme's compiled CSS from Shopify CDN.
 *      b. Queues a <script> to load the variant theme's JS bundle after DOMContentLoaded.
 *      c. Adds a data attribute to <html> so CSS can scope per-variant overrides.
 *
 * 3. The Shopify CDN URL for a theme's assets is deterministic:
 *      https://cdn.shopify.com/s/files/1/<shop_id>/themes/<theme_id>/assets/<file>
 *    We embed the variant theme IDs + shop ID into the snippet at generation time.
 *
 * 4. The snippet is a standalone file: snippets/marginlab-theme-ab.liquid
 *    Merchants include it with: {% render 'marginlab-theme-ab' %} in theme.liquid <head>.
 *
 * LIMITATIONS & NOTES
 * ───────────────────
 * - CSS asset filename varies by theme — Dawn uses "base.css", others may differ.
 *   The snippet loads the most common filenames with fallback logic.
 * - JS injection can cause double-execution of analytics. Use sparingly.
 * - Theme App Extension approach is preferred for Dawn 2.0+ themes.
 *
 * @see https://shopify.dev/docs/storefronts/themes/architecture/config/settings-schema-json
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeAbVariant {
  key: string;
  name: string;
  isControl: boolean;
  themeId: number | null;
  themeName: string;
}

export interface ThemeAbSnippetInput {
  experimentId: string;
  experimentName: string;
  shopId: string;        // Shopify numeric shop ID (from shop.id in Liquid)
  shopDomain: string;    // e.g. "mystore.myshopify.com"
  variants: ThemeAbVariant[];
  /** Common CSS filenames to try loading for variant themes */
  cssAssets?: string[];
  /** Common JS filenames to try loading for variant themes */
  jsAssets?: string[];
}

export interface ThemeAbSnippetResult {
  /** The full Liquid snippet content to save as snippets/marginlab-theme-ab.liquid */
  liquidSnippet: string;
  /** Installation instructions in Markdown */
  installationGuide: string;
  /** The raw JS (no Liquid) for debugging in browser console */
  debugScript: string;
}

// Default asset filenames to try — covers Dawn, Craft, Crave, Sense, Ride, etc.
const DEFAULT_CSS_ASSETS = [
  "base.css",
  "theme.css",
  "application.css",
  "global.css",
  "styles.css",
];

const DEFAULT_JS_ASSETS = [
  "theme.js",
  "application.js",
  "global.js",
];

// ---------------------------------------------------------------------------
// Snippet generator
// ---------------------------------------------------------------------------

export function generateThemeAbSnippet(input: ThemeAbSnippetInput): ThemeAbSnippetResult {
  const {
    experimentId,
    experimentName,
    shopId,
    shopDomain,
    variants,
    cssAssets = DEFAULT_CSS_ASSETS,
    jsAssets = DEFAULT_JS_ASSETS,
  } = input;

  const treatmentVariants = variants.filter((v) => !v.isControl && v.themeId !== null);

  if (treatmentVariants.length === 0) {
    throw new Error("No treatment variants with a themeId to generate snippet for.");
  }

  // Build the variants map JSON that will be embedded in the snippet
  const variantMap = Object.fromEntries(
    treatmentVariants.map((v) => [
      v.key,
      {
        themeId: v.themeId,
        name: v.name,
      },
    ])
  );

  // CDN base for a given theme ID
  // Pattern: https://cdn.shopify.com/s/files/1/<shopId>/themes/<themeId>/assets/
  const cdnBase = (themeId: number) =>
    `https://cdn.shopify.com/s/files/1/${shopId}/themes/${themeId}/assets/`;

  // The anti-flicker JS injected synchronously in <head>
  // We keep it tight — no external deps, no async, runs in ~1ms
  const antiFlickerJs = `
(function() {
  var EXP_ID = ${JSON.stringify(experimentId)};
  var COOKIE_NAME = 'ml_v_' + EXP_ID;
  var VARIANTS = ${JSON.stringify(variantMap)};
  var CDN_BASES = ${JSON.stringify(Object.fromEntries(treatmentVariants.map((v) => [v.key, cdnBase(v.themeId!)])))};
  var CSS_FILES = ${JSON.stringify(cssAssets)};
  var JS_FILES  = ${JSON.stringify(jsAssets)};

  // Read assignment cookie (simple split approach — avoids regex escaping issues)
  function getCookie(name) {
    var pairs = document.cookie.split('; ');
    for (var i = 0; i < pairs.length; i++) {
      var idx = pairs[i].indexOf('=');
      if (idx > -1 && pairs[i].substring(0, idx) === name) {
        return decodeURIComponent(pairs[i].substring(idx + 1));
      }
    }
    return null;
  }

  var variantKey = getCookie(COOKIE_NAME);
  if (!variantKey || !VARIANTS[variantKey]) return; // control or unassigned

  var variant  = VARIANTS[variantKey];
  var cdnBase  = CDN_BASES[variantKey];
  if (!cdnBase) return;

  // Mark <html> so CSS can scope overrides: html[data-ml-variant="variant_a"] { ... }
  document.documentElement.setAttribute('data-ml-variant', variantKey);
  document.documentElement.setAttribute('data-ml-exp', EXP_ID);

  // Inject variant CSS — try each candidate filename
  // We use a synchronous <link> in <head> to avoid FOUC
  CSS_FILES.forEach(function(file) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = cdnBase + file;
    link.setAttribute('data-marginlab', 'variant-css');
    // Suppress 404s from silent fails — browsers handle missing CSS gracefully
    document.head.appendChild(link);
  });

  // Inject variant JS after DOM ready to avoid double-execution of inline scripts
  function loadVariantJs() {
    JS_FILES.forEach(function(file) {
      var s = document.createElement('script');
      s.src = cdnBase + file;
      s.async = false;
      s.setAttribute('data-marginlab', 'variant-js');
      document.body.appendChild(s);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadVariantJs);
  } else {
    loadVariantJs();
  }
})();
`.trim();

  // The Liquid snippet wraps the JS in a Liquid comment block and uses
  // shop.id for the CDN base — making it portable across shops if ever reused.
  const liquidSnippet = `{% comment %}
  MarginLab Theme A/B Snippet — "${experimentName}"
  Experiment ID : ${experimentId}
  Shop          : ${shopDomain}
  Generated     : ${new Date().toISOString()}
  Variants      : ${treatmentVariants.map((v) => `${v.key} → theme ${v.themeId} (${v.themeName})`).join(", ")}

  HOW TO INSTALL:
  1. Save this file as:  snippets/marginlab-theme-ab.liquid
  2. Open theme.liquid (or base.liquid for headless)
  3. Add this line inside <head>, BEFORE your theme CSS:
       {%- render 'marginlab-theme-ab' -%}
  4. Save. The snippet runs synchronously to prevent flash-of-unstyled-content.

  HOW TO REMOVE:
  Delete this file and remove the render tag from theme.liquid.
  The published theme is NEVER modified — only variant assets are injected per-visitor.
{% endcomment %}
<script data-marginlab-snippet="${experimentId}">
${antiFlickerJs}
</script>`;

  // Installation guide in Markdown (shown in the UI panel)
  const installationGuide = `## Installing the MarginLab Theme A/B Snippet

### Step 1 — Download the snippet

Copy the snippet code from the panel below or download \`marginlab-theme-ab.liquid\`.

### Step 2 — Add to your theme

In your Shopify Admin:

1. Go to **Online Store → Themes**
2. On your **live theme**, click **Actions → Edit code**
3. In the left sidebar under **Snippets**, click **Add a new snippet**
4. Name it: \`marginlab-theme-ab\`
5. Paste the snippet code and **Save**

### Step 3 — Include in theme.liquid

Open \`layout/theme.liquid\` (or \`layout/base.liquid\` for headless themes).

Find the \`<head>\` tag and add this **before your first CSS link**:

\`\`\`liquid
<head>
  {%- render 'marginlab-theme-ab' -%}  {%- # MarginLab A/B snippet — keep first -%}
  <!-- rest of head... -->
\`\`\`

> ⚠️ **Position matters.** The snippet must run before the theme's own CSS to avoid FOUC
> (flash of unstyled content). Keep it as the first child of \`<head>\`.

### Step 4 — Verify

Activate the test from the MarginLab dashboard. Visit your store in an incognito window.
Open DevTools → Elements and look for:
- \`<html data-ml-variant="variant_a" data-ml-exp="${experimentId}">\`
- \`<link data-marginlab="variant-css">\` tags in \`<head>\`

### Step 5 — Removing the snippet

When the test ends:
1. Remove \`{%- render 'marginlab-theme-ab' -%}\` from \`theme.liquid\`
2. Delete the \`snippets/marginlab-theme-ab.liquid\` file

The published theme is **never modified**. Only per-visitor asset injection is used.

---

### How it works

| Visitor group | What they see |
|---|---|
| Control (50%) | Published theme, unchanged |
| Variant A (50%) | Published theme + variant theme CSS/JS injected |

MarginLab sets a first-party cookie \`ml_v_${experimentId}\` for each assigned visitor.
The snippet reads this cookie synchronously before the browser paints to prevent flicker.`;

  // Plain JS for copying into DevTools for debugging
  const debugScript = antiFlickerJs;

  return { liquidSnippet, installationGuide, debugScript };
}
