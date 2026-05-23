/**
 * Statistical significance engine.
 * Frequentist two-proportion z-test for conversion rates.
 * Welch's t-test approximation for continuous metrics (AOV, RPV).
 */

export interface VariantStats {
  visitors: number;
  conversions: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface ZTestResult {
  controlConversionRate: number;
  variantConversionRate: number;
  absoluteLift: number;
  relativeLift: number;
  zScore: number;
  pValue: number;
  confidenceLevel: number; // 0.90 | 0.95 | 0.99
  isSignificant: boolean;
  confidenceInterval: [number, number]; // 95% CI for the lift
  recommendation: "control" | "variant" | "insufficient_data" | "no_winner";
}

export interface ContinuousTestResult {
  controlMean: number;
  variantMean: number;
  absoluteLift: number;
  relativeLift: number;
  tScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: [number, number];
  recommendation: "control" | "variant" | "insufficient_data" | "no_winner";
}

const CONFIDENCE_LEVELS = {
  0.9: 1.6449,
  0.95: 1.96,
  0.99: 2.5758,
} as const;

// Normal distribution CDF approximation (Abramowitz and Stegun)
function normalCDF(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);
  const t = 1.0 / (1.0 + p * absZ);
  const poly =
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const erf = 1 - poly * Math.exp(-absZ * absZ);

  return 0.5 * (1.0 + sign * erf);
}

// Two-tailed p-value from z-score
function zToPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

export function twoProportionZTest(
  control: VariantStats,
  variant: VariantStats,
  confidenceLevel: 0.9 | 0.95 | 0.99 = 0.95
): ZTestResult {
  const { visitors: n1, conversions: c1 } = control;
  const { visitors: n2, conversions: c2 } = variant;

  const MIN_VISITORS = 100;
  const MIN_CONVERSIONS = 10;

  if (
    n1 < MIN_VISITORS ||
    n2 < MIN_VISITORS ||
    c1 < MIN_CONVERSIONS ||
    c2 < MIN_CONVERSIONS
  ) {
    return {
      controlConversionRate: n1 > 0 ? c1 / n1 : 0,
      variantConversionRate: n2 > 0 ? c2 / n2 : 0,
      absoluteLift: 0,
      relativeLift: 0,
      zScore: 0,
      pValue: 1,
      confidenceLevel,
      isSignificant: false,
      confidenceInterval: [0, 0],
      recommendation: "insufficient_data",
    };
  }

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const z = se === 0 ? 0 : (p2 - p1) / se;
  const pValue = zToPValue(z);

  const absoluteLift = p2 - p1;
  const relativeLift = p1 === 0 ? 0 : (p2 - p1) / p1;

  // 95% CI for the difference in proportions
  const margin =
    CONFIDENCE_LEVELS[confidenceLevel] *
    Math.sqrt(
      (p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2
    );
  const ci: [number, number] = [absoluteLift - margin, absoluteLift + margin];

  const criticalValue = CONFIDENCE_LEVELS[confidenceLevel];
  const isSignificant = Math.abs(z) >= criticalValue;

  let recommendation: ZTestResult["recommendation"] = "no_winner";
  if (!isSignificant) {
    recommendation = "no_winner";
  } else if (absoluteLift > 0) {
    recommendation = "variant";
  } else {
    recommendation = "control";
  }

  return {
    controlConversionRate: p1,
    variantConversionRate: p2,
    absoluteLift,
    relativeLift,
    zScore: z,
    pValue,
    confidenceLevel,
    isSignificant,
    confidenceInterval: ci,
    recommendation,
  };
}

// Welch's t-test for continuous metrics
export function welchTTest(
  controlMean: number,
  controlVariance: number,
  controlN: number,
  variantMean: number,
  variantVariance: number,
  variantN: number,
  confidenceLevel: 0.9 | 0.95 | 0.99 = 0.95
): ContinuousTestResult {
  const MIN_N = 30;

  if (controlN < MIN_N || variantN < MIN_N) {
    return {
      controlMean,
      variantMean,
      absoluteLift: variantMean - controlMean,
      relativeLift: controlMean === 0 ? 0 : (variantMean - controlMean) / controlMean,
      tScore: 0,
      pValue: 1,
      isSignificant: false,
      confidenceInterval: [0, 0],
      recommendation: "insufficient_data",
    };
  }

  const se = Math.sqrt(controlVariance / controlN + variantVariance / variantN);
  const t = se === 0 ? 0 : (variantMean - controlMean) / se;

  // For large samples, t-distribution ≈ normal
  const pValue = zToPValue(t);
  const absoluteLift = variantMean - controlMean;
  const relativeLift = controlMean === 0 ? 0 : absoluteLift / controlMean;

  const criticalValue = CONFIDENCE_LEVELS[confidenceLevel];
  const margin = criticalValue * se;
  const ci: [number, number] = [absoluteLift - margin, absoluteLift + margin];
  const isSignificant = Math.abs(t) >= criticalValue;

  let recommendation: ContinuousTestResult["recommendation"] = "no_winner";
  if (!isSignificant) recommendation = "no_winner";
  else if (absoluteLift > 0) recommendation = "variant";
  else recommendation = "control";

  return {
    controlMean,
    variantMean,
    absoluteLift,
    relativeLift,
    tScore: t,
    pValue,
    isSignificant,
    confidenceInterval: ci,
    recommendation,
  };
}

export function minimumSampleSize(
  baselineConversionRate: number,
  minimumDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.8
): number {
  const za = CONFIDENCE_LEVELS[0.95]; // for alpha = 0.05 two-tailed
  const zb = 0.842; // for power = 0.8

  const p1 = baselineConversionRate;
  const p2 = baselineConversionRate * (1 + minimumDetectableEffect);

  const numerator =
    (za * Math.sqrt(2 * p1 * (1 - p1)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2;
  const denominator = (p2 - p1) ** 2;

  return Math.ceil(numerator / denominator);
}

export function bayesianProbabilityToBeatControl(
  control: VariantStats,
  variant: VariantStats
): number {
  // Beta distribution approximation using Monte Carlo sampling
  // In production, use a proper Beta distribution CDF
  const alpha1 = control.conversions + 1;
  const beta1 = control.visitors - control.conversions + 1;
  const alpha2 = variant.conversions + 1;
  const beta2 = variant.visitors - variant.conversions + 1;

  // Analytical formula for P(B > A) where A ~ Beta(a1,b1) and B ~ Beta(a2,b2)
  // Using approximation: if means are far apart, return 0 or 1
  const mean1 = alpha1 / (alpha1 + beta1);
  const mean2 = alpha2 / (alpha2 + beta2);

  // Simplified: return frequentist p-value based probability for now
  const result = twoProportionZTest(control, variant);
  if (mean2 > mean1) {
    return 1 - result.pValue / 2;
  }
  return result.pValue / 2;
}
