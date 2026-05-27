import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Admin E2E — Full experiment lifecycle: create → launch → results → archive
 *
 * Uses the `request` fixture (direct API calls) for state mutations and
 * the `page` fixture for UI verification.
 *
 * Auth: relies on the dev-mode fallback in withShopAuth, which reads
 * X-Shop-Domain when NODE_ENV !== "production". Set DEMO_SHOP_DOMAIN in .env.test
 * to point at a seeded shop record.
 */

const SHOP_DOMAIN = process.env.DEMO_SHOP_DOMAIN || "demo.myshopify.com";
const AUTH_HEADERS = { "X-Shop-Domain": SHOP_DOMAIN };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createExperiment(request: APIRequestContext, name: string) {
  const res = await request.post("/api/experiments", {
    headers: AUTH_HEADERS,
    data: {
      name,
      type: "CONTENT_TEST",
      trafficAllocation: 100,
      assignmentStrategy: "VISITOR",
      goals: [{ type: "CONVERSION", metric: "revenue" }],
      variants: [
        {
          key: "control",
          name: "Control",
          allocationPercent: 50,
          isControl: true,
          modifications: [],
        },
        {
          key: "variant_b",
          name: "Variant B",
          allocationPercent: 50,
          isControl: false,
          modifications: [
            { selector: "#headline", type: "text", value: "New Headline" },
          ],
        },
      ],
    },
  });
  return res;
}

async function deleteExperiment(request: APIRequestContext, id: string) {
  await request.delete(`/api/experiments/${id}/delete`, {
    headers: AUTH_HEADERS,
  });
}

// ---------------------------------------------------------------------------
// API lifecycle suite
// ---------------------------------------------------------------------------

test.describe("Experiment API lifecycle", () => {
  let experimentId: string;

  test.afterEach(async ({ request }) => {
    if (experimentId) {
      await deleteExperiment(request, experimentId);
      experimentId = "";
    }
  });

  test("POST /api/experiments creates a DRAFT experiment", async ({ request }) => {
    const res = await createExperiment(request, `e2e-create-${Date.now()}`);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.status).toBe("DRAFT");
    expect(body.variants).toHaveLength(2);
    experimentId = body.id;
  });

  test("GET /api/experiments/:id returns the experiment", async ({ request }) => {
    const create = await createExperiment(request, `e2e-get-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    const res = await request.get(`/api/experiments/${id}`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.status).toBe("DRAFT");
  });

  test("PATCH /api/experiments/:id updates the experiment name", async ({ request }) => {
    const create = await createExperiment(request, `e2e-patch-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    const newName = `Updated-${Date.now()}`;
    const res = await request.patch(`/api/experiments/${id}`, {
      headers: AUTH_HEADERS,
      data: { name: newName },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(newName);
  });

  test("POST /api/experiments/:id/launch transitions to RUNNING", async ({ request }) => {
    const create = await createExperiment(request, `e2e-launch-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    const res = await request.post(`/api/experiments/${id}/launch`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("RUNNING");
    expect(body.startedAt).toBeTruthy();
  });

  test("POST /api/experiments/:id/pause transitions RUNNING → PAUSED", async ({ request }) => {
    const create = await createExperiment(request, `e2e-pause-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    await request.post(`/api/experiments/${id}/launch`, { headers: AUTH_HEADERS });

    const res = await request.post(`/api/experiments/${id}/pause`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PAUSED");
  });

  test("POST /api/experiments/:id/complete transitions to COMPLETED", async ({ request }) => {
    const create = await createExperiment(request, `e2e-complete-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    await request.post(`/api/experiments/${id}/launch`, { headers: AUTH_HEADERS });

    const res = await request.post(`/api/experiments/${id}/complete`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("COMPLETED");
  });

  test("POST /api/experiments/:id/archive transitions to ARCHIVED", async ({ request }) => {
    const create = await createExperiment(request, `e2e-archive-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    const res = await request.post(`/api/experiments/${id}/archive`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ARCHIVED");
  });

  test("POST /api/experiments/:id/duplicate creates a copy", async ({ request }) => {
    const create = await createExperiment(request, `e2e-dupe-source-${Date.now()}`);
    const { id } = await create.json();
    experimentId = id;

    const res = await request.post(`/api/experiments/${id}/duplicate`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status()).toBe(201);
    const copy = await res.json();
    expect(copy.id).not.toBe(id);
    expect(copy.status).toBe("DRAFT");

    // Clean up the copy too
    await deleteExperiment(request, copy.id);
  });

  test("DELETE /api/experiments/:id/delete removes the experiment", async ({ request }) => {
    const create = await createExperiment(request, `e2e-delete-${Date.now()}`);
    const { id } = await create.json();

    const del = await request.delete(`/api/experiments/${id}/delete`, {
      headers: AUTH_HEADERS,
    });
    expect([200, 204]).toContain(del.status());

    // Verify gone
    const get = await request.get(`/api/experiments/${id}`, {
      headers: AUTH_HEADERS,
    });
    expect(get.status()).toBe(404);
    experimentId = ""; // already deleted
  });
});

// ---------------------------------------------------------------------------
// Full end-to-end flow: create → launch → ingest events → analytics
// ---------------------------------------------------------------------------

test.describe("Full experiment flow: create → launch → ingest → results", () => {
  let experimentId: string;
  let variantId: string;

  test.afterEach(async ({ request }) => {
    if (experimentId) {
      await deleteExperiment(request, experimentId);
      experimentId = "";
    }
  });

  test("complete happy-path flow", async ({ request, page }) => {
    // Step 1: Create
    const create = await createExperiment(request, `e2e-flow-${Date.now()}`);
    expect(create.status()).toBe(201);
    const exp = await create.json();
    experimentId = exp.id;
    variantId = exp.variants.find((v: { isControl: boolean }) => !v.isControl)?.id;
    expect(variantId).toBeTruthy();

    // Step 2: Launch
    const launch = await request.post(`/api/experiments/${experimentId}/launch`, {
      headers: AUTH_HEADERS,
    });
    expect(launch.status()).toBe(200);
    expect((await launch.json()).status).toBe("RUNNING");

    // Step 3: Simulate visitor assignment via runtime
    const assignRes = await request.post("/api/runtime/assignment", {
      headers: { "X-Shop-Domain": SHOP_DOMAIN },
      data: {
        shopDomain: SHOP_DOMAIN,
        visitorId: `e2e-visitor-${Date.now()}`,
        sessionId: `e2e-session-${Date.now()}`,
        experimentId,
        variantId,
        cartToken: null,
        checkoutToken: null,
        customerId: null,
      },
    });
    // Assignment endpoint accepts 200 or 204
    expect([200, 201, 204]).toContain(assignRes.status());

    // Step 4: Ingest a page_view event
    const eventRes = await request.post("/api/runtime/events", {
      headers: { "X-Shop-Domain": SHOP_DOMAIN },
      data: {
        shopDomain: SHOP_DOMAIN,
        visitorId: `e2e-visitor-${Date.now()}`,
        sessionId: `e2e-session-${Date.now()}`,
        events: [
          {
            type: "PAGE_VIEW",
            name: "page_viewed",
            url: "https://fixture.myshopify.com/",
            properties: {},
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });
    expect([200, 202, 204]).toContain(eventRes.status());

    // Step 5: Verify experiment detail page loads
    await page.goto(`/experiments/${experimentId}`);
    await expect(page.getByText(/running/i)).toBeVisible({ timeout: 10_000 });

    // Step 6: Analytics page loads without error
    await page.goto(`/experiments/${experimentId}/analytics`);
    // Page should load (not 404 / error boundary)
    await expect(page).not.toHaveURL(/\/404/);
    // Heading or data area should be visible
    await expect(
      page.locator("main, [data-testid='analytics'], h1, h2").first()
    ).toBeVisible({ timeout: 10_000 });

    // Step 7: Complete the experiment
    const complete = await request.post(`/api/experiments/${experimentId}/complete`, {
      headers: AUTH_HEADERS,
    });
    expect(complete.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// UI-level list filtering and pagination
// ---------------------------------------------------------------------------

test.describe("Experiments list UI", () => {
  let experimentId: string;

  test.afterEach(async ({ request }) => {
    if (experimentId) {
      await deleteExperiment(request, experimentId);
      experimentId = "";
    }
  });

  test("newly created experiment appears in list with DRAFT badge", async ({ request, page }) => {
    const name = `e2e-ui-list-${Date.now()}`;
    const create = await createExperiment(request, name);
    expect(create.status()).toBe(201);
    const { id } = await create.json();
    experimentId = id;

    await page.goto("/experiments");
    // Wait for list to settle
    await page.waitForLoadState("networkidle");

    // Experiment name should appear somewhere on the page
    // (may require scrolling or filtering — try DRAFT tab first)
    await page.getByRole("button", { name: /draft/i }).click();
    await page.waitForTimeout(500);

    // Verify the experiment appears
    await expect(page.getByText(name)).toBeVisible({ timeout: 8_000 });
  });

  test("RUNNING filter shows launched experiments", async ({ request, page }) => {
    const name = `e2e-running-filter-${Date.now()}`;
    const create = await createExperiment(request, name);
    const { id } = await create.json();
    experimentId = id;

    await request.post(`/api/experiments/${id}/launch`, { headers: AUTH_HEADERS });

    await page.goto("/experiments");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /running/i }).click();

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/experiments") && r.url().includes("status=RUNNING")
    );
    const filterResponse = await responsePromise;
    expect(filterResponse.status()).toBe(200);
    const body = await filterResponse.json();
    expect(body).toHaveProperty("items");
  });
});

// ---------------------------------------------------------------------------
// Runtime config endpoint smoke test
// ---------------------------------------------------------------------------

test.describe("Runtime config endpoint", () => {
  test("GET /api/runtime/config returns config shape for seeded shop", async ({ request }) => {
    const res = await request.get(`/api/runtime/config?shop=${SHOP_DOMAIN}`);
    // May 200 or 401 depending on whether DEMO_SHOP_DOMAIN is seeded
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("experiments");
      expect(body).toHaveProperty("offers");
      expect(body).toHaveProperty("killSwitches");
      expect(Array.isArray(body.experiments)).toBe(true);
    } else {
      // If 401, the shop domain isn't seeded — that's acceptable for CI without seed
      expect([401, 404]).toContain(res.status());
    }
  });
});

// ---------------------------------------------------------------------------
// Webhook endpoint smoke test (HMAC is required; test the 401 path)
// ---------------------------------------------------------------------------

test.describe("Shopify webhook endpoint", () => {
  test("POST /api/webhooks/shopify returns 401 without valid HMAC", async ({ request }) => {
    const res = await request.post("/api/webhooks/shopify", {
      headers: {
        "X-Shopify-Topic": "orders/paid",
        "X-Shopify-Hmac-Sha256": "invalid-hmac",
        "X-Shopify-Shop-Domain": SHOP_DOMAIN,
        "Content-Type": "application/json",
      },
      data: { id: 12345, test: true },
    });
    // Should reject invalid HMAC
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Retention cron endpoint smoke test
// ---------------------------------------------------------------------------

test.describe("Retention cron endpoint", () => {
  test("GET /api/cron/retention-cleanup requires CRON_SECRET", async ({ request }) => {
    const res = await request.get("/api/cron/retention-cleanup");
    // Without CRON_SECRET header it should be 401
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/cron/retention-cleanup with valid secret returns counts", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      test.skip();
      return;
    }
    const res = await request.get("/api/cron/retention-cleanup", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("deletedEvents");
    expect(body).toHaveProperty("deletedAssignments");
  });
});
