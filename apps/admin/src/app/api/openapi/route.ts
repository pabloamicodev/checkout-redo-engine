/**
 * GET /api/openapi
 *
 * Returns the OpenAPI 3.1 specification for the MarginLab Admin API.
 * Useful for SDK generation, Postman import, and partner documentation.
 *
 * This spec is generated statically from the Zod schemas defined in
 * src/lib/zod-schemas.ts. Update this file whenever new endpoints are added.
 */

import { NextResponse } from "next/server";

const shopHeader = {
  name: "X-Shop-Domain",
  in: "header",
  required: false,
  description: "Merchant shop domain (dev fallback when no App Bridge JWT is present)",
  schema: { type: "string", example: "my-store.myshopify.com" },
};

const bearerAuth = {
  bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
};

const spec = {
  openapi: "3.1.0",
  info: {
    title: "MarginLab Admin API",
    version: "1.0.0",
    description:
      "Internal REST API for the MarginLab Shopify app. All authenticated routes require a Shopify App Bridge session token in the Authorization header.",
    contact: { name: "MarginLab Engineering", email: "eng@marginlab.io" },
  },
  servers: [{ url: "/api", description: "Current deployment" }],
  components: {
    securitySchemes: bearerAuth,
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "object", additionalProperties: true },
        },
        required: ["error"],
      },
      ExperimentStatus: {
        type: "string",
        enum: ["DRAFT", "RUNNING", "PAUSED", "COMPLETED", "ARCHIVED", "SCHEDULED", "STOPPED", "WINNER_SELECTED"],
      },
      ExperimentType: {
        type: "string",
        enum: ["PRICE_TEST", "HEADLINE_TEST", "DESCRIPTION_TEST", "IMAGE_TEST", "LAYOUT_TEST", "COLOR_TEST", "CTA_TEST", "BUNDLE_TEST", "SHIPPING_TEST", "PAYMENT_METHOD_TEST", "CHECKOUT_FLOW_TEST", "THEME_TEST"],
      },
      PersonalizationType: {
        type: "string",
        enum: ["PRODUCT_RECOMMENDATION", "UPSELL", "CROSS_SELL", "BUNDLE", "DISCOUNT", "CONTENT", "LAYOUT", "POST_PURCHASE"],
      },
      TargetingRules: {
        type: "object",
        properties: {
          countries: { type: "array", items: { type: "string" } },
          devices: { type: "array", items: { type: "string", enum: ["desktop", "mobile", "tablet"] } },
          customerTags: { type: "array", items: { type: "string" } },
          newVsReturning: { type: "string", enum: ["new", "returning", "all"] },
          minCartValue: { type: "number" },
          maxCartValue: { type: "number" },
          urlContains: { type: "string" },
          utmSource: { type: "string" },
          utmMedium: { type: "string" },
          utmCampaign: { type: "string" },
        },
      },
      Variant: {
        type: "object",
        properties: {
          id: { type: "string", format: "cuid" },
          name: { type: "string" },
          trafficWeight: { type: "number", minimum: 0, maximum: 100 },
          modifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                target: { type: "string" },
                value: { type: "string" },
              },
              required: ["type", "target", "value"],
            },
          },
        },
        required: ["id", "name", "trafficWeight"],
      },
      Experiment: {
        type: "object",
        properties: {
          id: { type: "string", format: "cuid" },
          name: { type: "string" },
          status: { $ref: "#/components/schemas/ExperimentStatus" },
          type: { $ref: "#/components/schemas/ExperimentType" },
          trafficSplit: { type: "number", minimum: 0, maximum: 100 },
          startDate: { type: "string", format: "date-time", nullable: true },
          endDate: { type: "string", format: "date-time", nullable: true },
          targetingRules: { $ref: "#/components/schemas/TargetingRules" },
          variants: { type: "array", items: { $ref: "#/components/schemas/Variant" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "status", "type", "trafficSplit"],
      },
      CreateExperiment: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          type: { $ref: "#/components/schemas/ExperimentType" },
          trafficSplit: { type: "number", minimum: 0, maximum: 100, default: 50 },
          startDate: { type: "string", format: "date-time", nullable: true },
          endDate: { type: "string", format: "date-time", nullable: true },
          targetingRules: { $ref: "#/components/schemas/TargetingRules" },
          variants: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                trafficWeight: { type: "number" },
                modifications: { type: "array", items: { type: "object" } },
              },
              required: ["name", "trafficWeight"],
            },
          },
        },
        required: ["name", "type"],
      },
      RuntimeEvent: {
        type: "object",
        properties: {
          eventType: { type: "string" },
          experimentId: { type: "string" },
          variantId: { type: "string" },
          sessionId: { type: "string" },
          visitorId: { type: "string" },
          shopDomain: { type: "string" },
          revenue: { type: "number", nullable: true },
          currency: { type: "string", nullable: true },
          metadata: { type: "object", additionalProperties: true, nullable: true },
        },
        required: ["eventType", "experimentId", "variantId", "sessionId", "shopDomain"],
      },
      AssignmentRequest: {
        type: "object",
        properties: {
          experimentId: { type: "string" },
          visitorId: { type: "string" },
          sessionId: { type: "string" },
          shopDomain: { type: "string" },
          context: {
            type: "object",
            properties: {
              country: { type: "string" },
              device: { type: "string" },
              customerTags: { type: "array", items: { type: "string" } },
              cartValue: { type: "number" },
              url: { type: "string" },
              utmSource: { type: "string" },
              utmMedium: { type: "string" },
              utmCampaign: { type: "string" },
            },
          },
        },
        required: ["experimentId", "visitorId", "sessionId", "shopDomain"],
      },
      ShopSettings: {
        type: "object",
        properties: {
          timezone: { type: "string" },
          currency: { type: "string" },
          defaultTrafficSplit: { type: "number", minimum: 0, maximum: 100 },
          minimumSampleSize: { type: "number", minimum: 100 },
          confidenceThreshold: { type: "number", minimum: 0.8, maximum: 0.99 },
          enableAutoWinner: { type: "boolean" },
          webhookUrl: { type: "string", format: "uri", nullable: true },
          slackWebhookUrl: { type: "string", format: "uri", nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // -----------------------------------------------------------------------
    // Experiments
    // -----------------------------------------------------------------------
    "/experiments": {
      get: {
        operationId: "listExperiments",
        summary: "List all experiments for the authenticated shop",
        tags: ["Experiments"],
        parameters: [
          shopHeader,
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/ExperimentStatus" } },
          { name: "type", in: "query", schema: { $ref: "#/components/schemas/ExperimentType" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          "200": {
            description: "Paginated list of experiments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    experiments: { type: "array", items: { $ref: "#/components/schemas/Experiment" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    pageSize: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        operationId: "createExperiment",
        summary: "Create a new experiment",
        tags: ["Experiments"],
        parameters: [shopHeader],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateExperiment" } } },
        },
        responses: {
          "201": { description: "Created experiment", content: { "application/json": { schema: { $ref: "#/components/schemas/Experiment" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized" },
          "402": { description: "Plan limit reached" },
        },
      },
    },
    "/experiments/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "getExperiment",
        summary: "Get a single experiment by ID",
        tags: ["Experiments"],
        responses: {
          "200": { description: "Experiment", content: { "application/json": { schema: { $ref: "#/components/schemas/Experiment" } } } },
          "404": { description: "Not found" },
        },
      },
      patch: {
        operationId: "updateExperiment",
        summary: "Update an experiment",
        tags: ["Experiments"],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateExperiment" } } } },
        responses: {
          "200": { description: "Updated experiment", content: { "application/json": { schema: { $ref: "#/components/schemas/Experiment" } } } },
          "404": { description: "Not found" },
        },
      },
      delete: {
        operationId: "deleteExperiment",
        summary: "Archive / delete an experiment",
        tags: ["Experiments"],
        responses: { "204": { description: "Deleted" }, "404": { description: "Not found" } },
      },
    },
    "/experiments/{id}/launch": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      post: {
        operationId: "launchExperiment",
        summary: "Launch a DRAFT experiment to RUNNING",
        tags: ["Experiments"],
        responses: { "200": { description: "Launched" }, "409": { description: "Invalid state transition" } },
      },
    },
    "/experiments/{id}/pause": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      post: {
        operationId: "pauseExperiment",
        summary: "Pause a RUNNING experiment",
        tags: ["Experiments"],
        responses: { "200": { description: "Paused" } },
      },
    },
    "/experiments/{id}/analytics": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "getExperimentAnalytics",
        summary: "Get analytics / statistical results for an experiment",
        tags: ["Experiments"],
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { "200": { description: "Analytics data" } },
      },
    },
    // -----------------------------------------------------------------------
    // Runtime (storefront-facing, CORS-enabled)
    // -----------------------------------------------------------------------
    "/runtime/assign": {
      post: {
        operationId: "assignVariant",
        summary: "Assign a visitor to an experiment variant",
        tags: ["Runtime"],
        security: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AssignmentRequest" } } } },
        responses: {
          "200": {
            description: "Variant assignment",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    variantId: { type: "string" },
                    modifications: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "404": { description: "Experiment not found or not running" },
        },
      },
    },
    "/runtime/event": {
      post: {
        operationId: "trackEvent",
        summary: "Track a conversion or engagement event from the storefront",
        tags: ["Runtime"],
        security: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RuntimeEvent" } } } },
        responses: { "200": { description: "Event recorded" } },
      },
    },
    "/runtime/config": {
      get: {
        operationId: "getRuntimeConfig",
        summary: "Fetch active experiments for a shop (used by the storefront SDK)",
        tags: ["Runtime"],
        security: [],
        parameters: [{ name: "shop", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Active experiments and variants",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    experiments: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    // -----------------------------------------------------------------------
    // Personalizations
    // -----------------------------------------------------------------------
    "/personalizations": {
      get: {
        operationId: "listPersonalizations",
        summary: "List active personalizations",
        tags: ["Personalizations"],
        responses: { "200": { description: "List of personalizations" } },
      },
      post: {
        operationId: "createPersonalization",
        summary: "Create a new personalization",
        tags: ["Personalizations"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { $ref: "#/components/schemas/PersonalizationType" },
                  targetingRules: { $ref: "#/components/schemas/TargetingRules" },
                  content: { type: "object", additionalProperties: true },
                },
                required: ["name", "type"],
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/personalizations/post-purchase": {
      get: {
        operationId: "listPostPurchasePersonalizations",
        summary: "List POST_PURCHASE personalizations (used by checkout extension)",
        tags: ["Personalizations"],
        security: [],
        parameters: [{ name: "shop", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "List of post-purchase offers" } },
      },
    },
    // -----------------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------------
    "/settings": {
      get: {
        operationId: "getSettings",
        summary: "Get shop settings",
        tags: ["Settings"],
        responses: { "200": { description: "Shop settings", content: { "application/json": { schema: { $ref: "#/components/schemas/ShopSettings" } } } } },
      },
      patch: {
        operationId: "updateSettings",
        summary: "Update shop settings",
        tags: ["Settings"],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ShopSettings" } } } },
        responses: { "200": { description: "Updated settings" } },
      },
    },
    "/settings/pause-all-experiments": {
      post: {
        operationId: "pauseAllExperiments",
        summary: "Emergency stop — pause all running experiments for the shop",
        tags: ["Settings"],
        responses: { "200": { description: "All experiments paused" } },
      },
    },
    // -----------------------------------------------------------------------
    // Webhooks
    // -----------------------------------------------------------------------
    "/webhooks/shopify": {
      post: {
        operationId: "shopifyWebhook",
        summary: "Receive Shopify webhook events (HMAC-verified)",
        tags: ["Webhooks"],
        security: [],
        parameters: [
          { name: "X-Shopify-Topic", in: "header", required: true, schema: { type: "string" } },
          { name: "X-Shopify-Shop-Domain", in: "header", required: true, schema: { type: "string" } },
          { name: "X-Shopify-Hmac-Sha256", in: "header", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Webhook processed" } },
      },
    },
    // -----------------------------------------------------------------------
    // OpenAPI
    // -----------------------------------------------------------------------
    "/openapi": {
      get: {
        operationId: "getOpenApiSpec",
        summary: "This OpenAPI specification",
        tags: ["Meta"],
        security: [],
        responses: {
          "200": {
            description: "OpenAPI 3.1 JSON spec",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
