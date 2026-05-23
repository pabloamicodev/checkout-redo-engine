import { test, expect } from "@playwright/test";

/**
 * Admin E2E — Offer Wizard (5 steps)
 */

test.describe("Offer wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/offers-library/new");
  });

  test("renders step 1 — name + type selector", async ({ page }) => {
    await expect(page.getByText(/offer type|choose a type/i).first()).toBeVisible();
    // 11 offer type cards should be visible
    const typeCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /discount|gift|shipping|bundle|buy/i });
    expect(await typeCards.count()).toBeGreaterThanOrEqual(4);
  });

  test("Next is disabled when name is empty", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeDisabled();
  });

  test("can fill name and select type, then advance", async ({ page }) => {
    await page.getByPlaceholder(/e\.g\. 10%/i).fill("Summer Free Shipping");
    // Select FREE_SHIPPING type (click first type card after filling name)
    await page.locator('[class*="rounded-xl"]').filter({ hasText: /free shipping/i }).first().click();
    await page.getByRole("button", { name: /next/i }).click();
    // Should be on step 2 (discount rules)
    await expect(page.getByText(/discount rules|configure/i)).toBeVisible();
  });

  test("can navigate back from step 2 to step 1", async ({ page }) => {
    await page.getByPlaceholder(/e\.g\. 10%/i).fill("Back Test Offer");
    await page.locator('[class*="rounded-xl"]').filter({ hasText: /percentage/i }).first().click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /back/i }).click();
    // Should be back on step 1
    await expect(page.getByText(/offer type|choose a type/i).first()).toBeVisible();
  });
});

test.describe("Personalization wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/personalizations/new");
  });

  test("renders the new personalization form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /new personalization/i })).toBeVisible();
  });

  test("Save button is disabled with empty name", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /create|save/i }).last();
    await expect(saveBtn).toBeDisabled();
  });
});

test.describe("Price test wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/price-tests/new");
  });

  test("renders setup step", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /new price test/i })).toBeVisible();
    await expect(page.getByText(/test setup/i)).toBeVisible();
  });

  test("Next is disabled when name is empty", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeDisabled();
  });

  test("advancing step shows variants section", async ({ page }) => {
    await page.getByPlaceholder(/e\.g\. summer/i).fill("My Price Test");
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/variants/i)).toBeVisible();
  });

  test("shows allocation warning when sum ≠ 100", async ({ page }) => {
    await page.getByPlaceholder(/e\.g\. summer/i).fill("Price Alloc Test");
    await page.getByRole("button", { name: /next/i }).click();
    // Modify an allocation to break the sum
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.first().fill("30");
    await expect(page.getByText(/sum to 100/i)).toBeVisible();
  });
});

test.describe("Shipping test wizard", () => {
  test("renders shipping test page", async ({ page }) => {
    await page.goto("/shipping-tests/new");
    await expect(page.getByRole("heading", { name: /new shipping test/i })).toBeVisible();
  });
});

test.describe("Checkout blocks wizard", () => {
  test("renders checkout blocks page", async ({ page }) => {
    await page.goto("/checkout-blocks/new");
    await expect(page.getByRole("heading", { name: /new checkout block/i })).toBeVisible();
  });
});
