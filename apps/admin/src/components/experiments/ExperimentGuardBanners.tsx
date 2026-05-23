"use client";

import { Banner } from "@/components/ui/Banner";
import Link from "next/link";

interface ExperimentLike {
  type: string;
  status: string;
  variants: Array<{
    isControl: boolean;
    modifications?: unknown;
    settings?: unknown;
    discountConfig?: unknown;
  }>;
  discountConfig?: unknown;
  shippingConfig?: unknown;
  splitUrlConfig?: unknown;
  settings?: unknown;
}

interface Props {
  type: string;
  status: string;
  experiment?: ExperimentLike;
}

export function ExperimentGuardBanners({ type, status, experiment }: Props) {
  const isRunning = status === "RUNNING" || status === "ACTIVE";
  const banners: React.ReactNode[] = [];

  // Web Pixel warning — show for any running test
  if (isRunning) {
    banners.push(
      <Banner key="pixel" variant="warning" dismissible>
        <span>Web Pixel may not be active — verify in{" "}
          <Link href="/install-health" className="underline font-medium">Install Health</Link>{" "}
          to ensure conversion events are tracked correctly.
        </span>
      </Banner>
    );
  }

  // Theme App Embed — content tests and split URL tests
  if (isRunning && (type === "CONTENT_TEST" || type === "SPLIT_URL_TEST")) {
    banners.push(
      <Banner key="embed" variant="warning" dismissible>
        Ensure the <strong>Theme App Embed</strong> is enabled in your Shopify theme editor for the storefront script to load.
      </Banner>
    );
  }

  // Extension not installed — checkout tests
  if (type === "CHECKOUT_TEST") {
    banners.push(
      <Banner key="extension" variant="info" dismissible>
        This test requires the <strong>Checkout UI Extension</strong> to be active in your theme.{" "}
        <Link href="/install-health" className="underline font-medium">Check install status →</Link>
      </Banner>
    );
  }

  // Shopify Function — discount and shipping tests
  if (type === "DISCOUNT_TEST" || type === "SHIPPING_TEST") {
    banners.push(
      <Banner key="function" variant="info" dismissible>
        This test requires a <strong>Shopify Function</strong> to be deployed.{" "}
        <Link href="/install-health" className="underline font-medium">Verify deployment →</Link>
      </Banner>
    );
  }

  // Price test risk banner — always visible when running
  if (isRunning && type === "PRICE_TEST") {
    banners.push(
      <Banner key="price-risk" variant="danger">
        <strong>Price test running</strong> — prices are live and visible to all visitors in each variant cohort. Monitor conversion and margin metrics closely.
      </Banner>
    );
  }

  // ── Stale data guards (require experiment object) ──────────────────────────

  if (experiment) {
    // OFFER_TEST: detect archived offers
    if (type === "OFFER_TEST" && isRunning) {
      const ARCHIVED = new Set(["archived", "ARCHIVED", "deleted", "DELETED"]);
      const archivedVariants = experiment.variants.filter(v => {
        const vs = v.settings as Record<string, unknown> | null | undefined;
        const st = String(vs?.offerStatus ?? vs?.status ?? "").toLowerCase();
        return st && ARCHIVED.has(st);
      });
      if (archivedVariants.length > 0) {
        banners.push(
          <Banner key="offer-archived" variant="danger">
            <strong>Archived offer detected</strong> — {archivedVariants.length} variant{archivedVariants.length > 1 ? "s have" : " has"} an archived offer.
            Visitors assigned to {archivedVariants.length > 1 ? "these variants" : "this variant"} won&apos;t receive any offer while the test is running.
          </Banner>
        );
      }
    }

    // DISCOUNT_TEST: stacking conflict warning
    if (type === "DISCOUNT_TEST") {
      const cfg = experiment.discountConfig as Record<string, unknown> | null | undefined;
      const stacking = cfg?.stacking as string | undefined;
      if (stacking === "ALLOW_ALL" || stacking === "allow_all") {
        banners.push(
          <Banner key="discount-stacking" variant="warning" dismissible>
            <strong>Stacking conflict risk</strong> — this discount is configured to combine with all other active discounts, which may inflate the discount amount and skew test results.
          </Banner>
        );
      }
    }

    // CONTENT_TEST: broken selector warning
    if (type === "CONTENT_TEST" && isRunning) {
      let brokenCount = 0;
      for (const v of experiment.variants) {
        if (v.isControl) continue;
        const mods = v.modifications as Array<Record<string, unknown>> | null | undefined;
        if (Array.isArray(mods)) {
          for (const m of mods) {
            const sel = String(m.selector ?? "").trim();
            const ct = String(m.changeType ?? m.type ?? "").trim();
            const needsSelector = ct !== "inject_css" && ct !== "inject_js";
            if (needsSelector && !sel) brokenCount++;
          }
        }
      }
      if (brokenCount > 0) {
        banners.push(
          <Banner key="content-selectors" variant="warning" dismissible>
            <strong>{brokenCount} modification{brokenCount > 1 ? "s" : ""} won&apos;t apply</strong> — empty CSS selector{brokenCount > 1 ? "s" : ""} detected.
            The storefront runtime won&apos;t find these elements.{" "}
            <a href="?tab=modifications" className="underline font-medium">Fix in Modifications →</a>
          </Banner>
        );
      }
    }

    // PRICE_TEST: note about external changes (manual verification)
    if (type === "PRICE_TEST" && isRunning) {
      banners.push(
        <Banner key="price-external" variant="warning" dismissible>
          If prices were changed in Shopify outside of MarginLab, variant prices may be out of sync.{" "}
          <a href="?tab=modifications" className="underline font-medium">Verify in Price Matrix →</a>
        </Banner>
      );
    }

    // SPLIT_URL_TEST: note about URL health (manual verification)
    if (type === "SPLIT_URL_TEST" && isRunning) {
      banners.push(
        <Banner key="spliturl-health" variant="info" dismissible>
          Verify all variant URLs are reachable (return 200 OK). A 404 will break the redirect and expose visitors to an error page.{" "}
          <a href="?tab=modifications" className="underline font-medium">View Routes →</a>
        </Banner>
      );
    }
  }

  if (banners.length === 0) return null;

  return <div className="space-y-2 px-6 pt-4">{banners}</div>;
}
