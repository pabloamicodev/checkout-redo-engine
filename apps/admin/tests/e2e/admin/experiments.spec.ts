import { test, expect } from "@playwright/test";

/**
 * Admin E2E — Experiment CRUD
 *
 * Prerequisites: local Next.js dev server running on :3457,
 * DEMO_SHOP_DOMAIN env var set to a seeded shop.
 */

test.describe("Experiments list page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/experiments");
  });

  test("renders the experiments heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /experiments/i })).toBeVisible();
  });

  test("shows status filter tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Running" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Draft" })).toBeVisible();
  });

  test("New Experiment button links to /experiments/new", async ({ page }) => {
    const link = page.getByRole("link", { name: /new experiment/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/experiments/new");
  });

  test("filter by DRAFT status triggers a client fetch", async ({ page }) => {
    // Intercept the API call made by ExperimentTypeList when filtering
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/experiments") && r.url().includes("status=DRAFT")
    );
    await page.getByRole("button", { name: "Draft" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
  });
});

test.describe("New Experiment wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/experiments/new");
  });

  test("renders the 5-step wizard", async ({ page }) => {
    // Step indicators 1-5 should be visible
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`text=${i}`).first()).toBeVisible();
    }
  });

  test("Next button is disabled when name is empty", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeDisabled();
  });

  test("can navigate to step 2 after filling name", async ({ page }) => {
    await page.getByPlaceholder(/e\.g\. summer/i).fill("My Test Experiment");
    await page.getByRole("button", { name: /next/i }).click();
    // Step 2 heading
    await expect(page.getByText(/variants/i)).toBeVisible();
  });

  test("shows validation error when allocations do not sum to 100", async ({ page }) => {
    await page.getByPlaceholder(/e\.g\. summer/i).fill("Alloc Test");
    await page.getByRole("button", { name: /next/i }).click();

    // Change control allocation to something that breaks the sum
    const allocationInputs = page.locator('input[type="number"]').filter({ hasText: "" });
    // Set first variant allocation to 30 (so 30 + 50 = 80, not 100)
    await allocationInputs.first().fill("30");
    await expect(page.getByText(/sum to 100/i)).toBeVisible();
  });

  test("cancel returns to previous page", async ({ page }) => {
    await page.getByRole("button", { name: /cancel/i }).click();
    // Should navigate away from /experiments/new
    await expect(page).not.toHaveURL(/\/experiments\/new/);
  });
});

test.describe("Experiment detail page", () => {
  test("404 for non-existent experiment", async ({ page }) => {
    await page.goto("/experiments/nonexistent-id-xyz");
    // Next.js notFound() triggers the 404 page
    await expect(page.getByText(/404|not found/i)).toBeVisible();
  });
});

test.describe("Price tests list page", () => {
  test("renders price tests page with correct heading", async ({ page }) => {
    await page.goto("/price-tests");
    await expect(page.getByRole("heading", { name: /price tests/i })).toBeVisible();
  });

  test("new price test button is visible", async ({ page }) => {
    await page.goto("/price-tests");
    await expect(page.getByRole("link", { name: /new price test/i })).toBeVisible();
  });
});

test.describe("Integrations page", () => {
  test("renders all 8 integration cards", async ({ page }) => {
    await page.goto("/integrations");
    const integrationNames = [
      "Google Analytics 4",
      "Klaviyo",
      "Microsoft Clarity",
      "Heap",
      "Segment",
      "Elevar",
      "Slack",
      "Outbound Webhook",
    ];
    for (const name of integrationNames) {
      await expect(page.getByText(name)).toBeVisible();
    }
  });

  test("expanding GA4 card shows credential fields", async ({ page }) => {
    await page.goto("/integrations");
    // Click the expand button on GA4 card
    await page.getByText("Google Analytics 4").locator("..").locator("..").getByRole("button").last().click();
    await expect(page.getByPlaceholder("G-XXXXXXXXXX")).toBeVisible();
    await expect(page.getByPlaceholder(/measurement protocol secret/i)).toBeVisible();
  });
});

test.describe("Health endpoint", () => {
  test("GET /api/health returns 200 or 503", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("checks");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("version");
  });

  test("health response has db and redis checks", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(body.checks).toHaveProperty("db");
    expect(body.checks).toHaveProperty("redis");
    expect(typeof body.checks.db.ok).toBe("boolean");
    expect(typeof body.checks.redis.ok).toBe("boolean");
  });
});

test.describe("Offers library page", () => {
  test("renders offers library heading", async ({ page }) => {
    await page.goto("/offers-library");
    await expect(page.getByRole("heading", { name: /offers library|offer library/i })).toBeVisible();
  });

  test("new offer button is visible", async ({ page }) => {
    await page.goto("/offers-library");
    await expect(page.getByRole("link", { name: /new offer/i })).toBeVisible();
  });
});
