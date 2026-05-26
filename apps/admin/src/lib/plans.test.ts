import { describe, expect, it } from "vitest";
import {
  getPlan,
  isPaidPlan,
  minimumPlanForFeature,
  planHasFeature,
} from "./plans";

describe("plans helpers", () => {
  it("falls back to free plan for unknown plan keys", () => {
    const plan = getPlan("not-real");
    expect(plan.key).toBe("free");
    expect(plan.maxRunningExperiments).toBe(1);
  });

  it("detects paid/free plans correctly", () => {
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("growth")).toBe(true);
  });

  it("checks feature gates by plan", () => {
    expect(planHasFeature("free", "advancedAnalytics")).toBe(false);
    expect(planHasFeature("growth", "advancedAnalytics")).toBe(true);
    expect(planHasFeature("pro", "webhookIntegrations")).toBe(true);
  });

  it("returns minimum plan required for each feature", () => {
    expect(minimumPlanForFeature("advancedAnalytics")).toBe("growth");
    expect(minimumPlanForFeature("prioritySupport")).toBe("enterprise");
  });
});
