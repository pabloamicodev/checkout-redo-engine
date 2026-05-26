import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();

// Opt-in uploads: avoids failing production builds when Sentry project/org/token are missing or incorrect.
const sentryUploadEnabled = process.env.SENTRY_ENABLE_UPLOADS === "true";
const canUploadSentryArtifacts =
  sentryUploadEnabled && !!sentryOrg && !!sentryProject && !!sentryAuthToken;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // Shopify App Bridge requires these headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors",
              "https://*.myshopify.com",
              "https://admin.shopify.com",
              "https://partner.shopify.com",
            ].join(" "),
          },
        ],
      },
      // Runtime config endpoint: allow Shopify storefronts to fetch
      {
        source: "/api/runtime/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type,X-Shop-Domain",
          },
        ],
      },
    ];
  },
};

const sentryConfig = {
  // Sentry organisation / project (trim to avoid accidental whitespace/newline issues)
  org: sentryOrg,
  project: sentryProject,
  authToken: sentryAuthToken,

  // Skip Sentry telemetry from build tooling.
  telemetry: false,

  // Keep source maps private (do not upload to CDN)
  sourcemaps: { deleteSourcemapsAfterUpload: canUploadSentryArtifacts },

  // Suppress verbose Sentry build output
  silent: !process.env.CI,

  webpack: {
    // Automatically instrument server-side routes
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
    autoInstrumentAppDirectory: true,
    // Tree-shake the Sentry logger in production
    treeshake: { removeDebugLogging: true },
  },
};

export default canUploadSentryArtifacts
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
