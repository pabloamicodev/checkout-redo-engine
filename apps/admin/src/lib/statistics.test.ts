import { describe, it, expect } from "vitest";
import {
  twoProportionZTest,
  welchTTest,
  minimumSampleSize,
  bayesianProbabilityToBeatControl,
} from "./statistics";
import type { VariantStats } from "./statistics";

describe("twoProportionZTest", () => {
  const controlLarge: VariantStats = { visitors: 10000, conversions: 300, totalRevenue: 9000, totalProfit: 3000 };
  const variantWinner: VariantStats = { visitors: 10000, conversions: 390, totalRevenue: 11700, totalProfit: 3900 };
  const variantLoser: VariantStats = { visitors: 10000, conversions: 210, totalRevenue: 6300, totalProfit: 2100 };

  it("returns insufficient_data when sample sizes are too small", () => {
    const result = twoProportionZTest(
      { visitors: 50, conversions: 2, totalRevenue: 100, totalProfit: 40 },
      { visitors: 50, conversions: 3, totalRevenue: 150, totalProfit: 60 }
    );
    expect(result.recommendation).toBe("insufficient_data");
    expect(result.isSignificant).toBe(false);
  });

  it("detects significant winner with large positive lift", () => {
    const result = twoProportionZTest(controlLarge, variantWinner);
    expect(result.isSignificant).toBe(true);
    expect(result.recommendation).toBe("variant");
    expect(result.relativeLift).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("detects significant loser with large negative lift", () => {
    const result = twoProportionZTest(controlLarge, variantLoser);
    expect(result.isSignificant).toBe(true);
    expect(result.recommendation).toBe("control");
    expect(result.relativeLift).toBeLessThan(0);
  });

  it("conversion rates are computed correctly", () => {
    const result = twoProportionZTest(controlLarge, variantWinner);
    expect(result.controlConversionRate).toBeCloseTo(0.03, 3);
    expect(result.variantConversionRate).toBeCloseTo(0.039, 3);
  });

  it("lift is computed correctly", () => {
    const result = twoProportionZTest(controlLarge, variantWinner);
    expect(result.absoluteLift).toBeCloseTo(0.009, 3);
    expect(result.relativeLift).toBeCloseTo(0.3, 2);
  });

  it("confidence interval lower bound < upper bound", () => {
    const result = twoProportionZTest(controlLarge, variantWinner);
    expect(result.confidenceInterval[0]).toBeLessThan(result.confidenceInterval[1]);
  });

  it("returns no_winner for statistically tied variants", () => {
    const tied: VariantStats = { visitors: 10000, conversions: 301, totalRevenue: 9030, totalProfit: 3010 };
    const result = twoProportionZTest(controlLarge, tied);
    expect(result.isSignificant).toBe(false);
    expect(result.recommendation).toBe("no_winner");
  });

  it("handles zero conversion control gracefully", () => {
    const zeroControl: VariantStats = { visitors: 200, conversions: 10, totalRevenue: 500, totalProfit: 200 };
    const someVariant: VariantStats = { visitors: 200, conversions: 20, totalRevenue: 1000, totalProfit: 400 };
    expect(() => twoProportionZTest(zeroControl, someVariant)).not.toThrow();
  });

  it("respects 99% confidence level", () => {
    const result99 = twoProportionZTest(controlLarge, variantWinner, 0.99);
    const result95 = twoProportionZTest(controlLarge, variantWinner, 0.95);
    // 99% threshold is harder to pass — p-value is same but critical value is higher
    expect(result99.confidenceLevel).toBe(0.99);
    expect(result95.confidenceLevel).toBe(0.95);
  });
});

describe("welchTTest", () => {
  it("returns insufficient_data for small samples", () => {
    const result = welchTTest(10, 4, 20, 12, 5, 25);
    expect(result.recommendation).toBe("insufficient_data");
  });

  it("detects significant difference for large samples", () => {
    const result = welchTTest(
      10.0, 4.0, 1000,
      13.0, 4.5, 1000
    );
    expect(result.isSignificant).toBe(true);
    expect(result.recommendation).toBe("variant");
    expect(result.absoluteLift).toBeCloseTo(3.0, 1);
  });

  it("computes relative lift correctly", () => {
    const result = welchTTest(10.0, 1.0, 500, 12.0, 1.0, 500);
    expect(result.relativeLift).toBeCloseTo(0.2, 2);
  });

  it("handles zero control mean without throwing", () => {
    expect(() => welchTTest(0, 1, 500, 2, 1, 500)).not.toThrow();
    const result = welchTTest(0, 1, 500, 2, 1, 500);
    expect(result.relativeLift).toBe(0); // 0-mean guard
  });

  it("detects control wins with negative lift", () => {
    const result = welchTTest(15.0, 3.0, 1000, 10.0, 3.0, 1000);
    expect(result.isSignificant).toBe(true);
    expect(result.recommendation).toBe("control");
    expect(result.absoluteLift).toBeLessThan(0);
  });
});

describe("minimumSampleSize", () => {
  it("returns a positive integer", () => {
    const n = minimumSampleSize(0.03, 0.1);
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it("requires larger sample for smaller MDE", () => {
    const n5pct = minimumSampleSize(0.03, 0.05);
    const n20pct = minimumSampleSize(0.03, 0.2);
    expect(n5pct).toBeGreaterThan(n20pct);
  });

  it("requires larger sample for lower baseline conversion rate", () => {
    const nLow = minimumSampleSize(0.01, 0.1);
    const nHigh = minimumSampleSize(0.1, 0.1);
    expect(nLow).toBeGreaterThan(nHigh);
  });

  it("produces realistic numbers for e-commerce scenarios", () => {
    // 3% baseline, 10% MDE → typically 40k-60k per variant at 95% confidence
    const n = minimumSampleSize(0.03, 0.1);
    expect(n).toBeGreaterThan(1000);
    expect(n).toBeLessThan(100000);
  });
});

describe("bayesianProbabilityToBeatControl", () => {
  const controlLarge: VariantStats = { visitors: 10000, conversions: 300, totalRevenue: 9000, totalProfit: 3000 };
  const clearWinner: VariantStats = { visitors: 10000, conversions: 390, totalRevenue: 11700, totalProfit: 3900 };
  const clearLoser: VariantStats = { visitors: 10000, conversions: 210, totalRevenue: 6300, totalProfit: 2100 };

  it("returns a probability in [0, 1]", () => {
    const p = bayesianProbabilityToBeatControl(controlLarge, clearWinner);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it("returns high probability for clear winner", () => {
    const p = bayesianProbabilityToBeatControl(controlLarge, clearWinner);
    expect(p).toBeGreaterThan(0.9);
  });

  it("returns low probability for clear loser", () => {
    const p = bayesianProbabilityToBeatControl(controlLarge, clearLoser);
    expect(p).toBeLessThan(0.1);
  });

  it("returns ~0.5 for identical stats", () => {
    const p = bayesianProbabilityToBeatControl(controlLarge, controlLarge);
    // Should be close to 50% since they're identical
    expect(p).toBeGreaterThan(0.3);
    expect(p).toBeLessThan(0.7);
  });
});
