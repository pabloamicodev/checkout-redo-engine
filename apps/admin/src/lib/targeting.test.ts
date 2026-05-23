import { describe, it, expect } from "vitest";
import { evaluateTargetingRules } from "./targeting";
import type { TargetingGroup, EvaluationContext } from "./targeting";

describe("evaluateTargetingRules", () => {
  it("returns true when rules array is empty (match everyone)", () => {
    expect(evaluateTargetingRules([], {})).toBe(true);
  });

  describe("device type", () => {
    const rule: TargetingGroup[] = [
      { operator: "AND", conditions: [{ type: "device", operator: "eq", value: "mobile" }] },
    ];

    it("matches mobile visitor", () => {
      expect(evaluateTargetingRules(rule, { deviceType: "mobile" })).toBe(true);
    });

    it("does not match desktop visitor", () => {
      expect(evaluateTargetingRules(rule, { deviceType: "desktop" })).toBe(false);
    });
  });

  describe("country targeting", () => {
    const rule: TargetingGroup[] = [
      { operator: "AND", conditions: [{ type: "country", operator: "in", value: ["US", "CA"] }] },
    ];

    it("matches US visitor", () => {
      expect(evaluateTargetingRules(rule, { country: "US" })).toBe(true);
    });

    it("matches CA visitor", () => {
      expect(evaluateTargetingRules(rule, { country: "CA" })).toBe(true);
    });

    it("does not match GB visitor", () => {
      expect(evaluateTargetingRules(rule, { country: "GB" })).toBe(false);
    });
  });

  describe("URL conditions", () => {
    const rule: TargetingGroup[] = [
      { operator: "AND", conditions: [{ type: "url_contains", operator: "contains", value: "/products/" }] },
    ];

    it("matches product page URL", () => {
      expect(evaluateTargetingRules(rule, { url: "https://shop.com/products/shirt" })).toBe(true);
    });

    it("does not match homepage", () => {
      expect(evaluateTargetingRules(rule, { url: "https://shop.com/" })).toBe(false);
    });
  });

  describe("URL regex match", () => {
    const rule: TargetingGroup[] = [
      { operator: "AND", conditions: [{ type: "url_matches", operator: "eq", value: "^/collections/[a-z]+$" }] },
    ];

    it("matches collection path", () => {
      expect(evaluateTargetingRules(rule, { url: "/collections/shirts" })).toBe(true);
    });

    it("does not match product path", () => {
      expect(evaluateTargetingRules(rule, { url: "/products/shirt" })).toBe(false);
    });

    it("handles invalid regex gracefully", () => {
      const badRule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "url_matches", operator: "eq", value: "[invalid(" }] },
      ];
      expect(evaluateTargetingRules(badRule, { url: "/anything" })).toBe(false);
    });
  });

  describe("cart value", () => {
    it("matches cart value above threshold", () => {
      const rule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "cart_value_gte", operator: "gte", value: 50 }] },
      ];
      expect(evaluateTargetingRules(rule, { cartValue: 75 })).toBe(true);
      expect(evaluateTargetingRules(rule, { cartValue: 50 })).toBe(true);
      expect(evaluateTargetingRules(rule, { cartValue: 49 })).toBe(false);
    });

    it("treats missing cart value as 0", () => {
      const rule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "cart_value_gte", operator: "gte", value: 1 }] },
      ];
      expect(evaluateTargetingRules(rule, {})).toBe(false);
    });
  });

  describe("customer segment conditions", () => {
    it("new_visitor eq true", () => {
      const rule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "new_visitor", operator: "eq", value: true }] },
      ];
      expect(evaluateTargetingRules(rule, { isNewVisitor: true })).toBe(true);
      expect(evaluateTargetingRules(rule, { isNewVisitor: false })).toBe(false);
      expect(evaluateTargetingRules(rule, {})).toBe(false);
    });

    it("customer_tag in array", () => {
      const rule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "customer_tag", operator: "in", value: ["vip", "wholesale"] }] },
      ];
      expect(evaluateTargetingRules(rule, { customerTags: ["vip"] })).toBe(true);
      expect(evaluateTargetingRules(rule, { customerTags: ["retail"] })).toBe(false);
    });
  });

  describe("date conditions", () => {
    it("date_after matches future date threshold", () => {
      const rule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "date_after", operator: "gte", value: "2020-01-01" }] },
      ];
      expect(evaluateTargetingRules(rule, { currentDate: new Date("2025-06-01") })).toBe(true);
    });

    it("date_before excludes dates after threshold", () => {
      const rule: TargetingGroup[] = [
        { operator: "AND", conditions: [{ type: "date_before", operator: "lt", value: "2020-01-01" }] },
      ];
      expect(evaluateTargetingRules(rule, { currentDate: new Date("2025-06-01") })).toBe(false);
    });
  });

  describe("OR group", () => {
    const rule: TargetingGroup[] = [
      {
        operator: "OR",
        conditions: [
          { type: "device", operator: "eq", value: "mobile" },
          { type: "country", operator: "eq", value: "US" },
        ],
      },
    ];

    it("passes if at least one condition matches", () => {
      expect(evaluateTargetingRules(rule, { deviceType: "desktop", country: "US" })).toBe(true);
      expect(evaluateTargetingRules(rule, { deviceType: "mobile", country: "GB" })).toBe(true);
    });

    it("fails if no condition matches", () => {
      expect(evaluateTargetingRules(rule, { deviceType: "desktop", country: "GB" })).toBe(false);
    });
  });

  describe("multiple AND groups", () => {
    const rules: TargetingGroup[] = [
      { operator: "AND", conditions: [{ type: "device", operator: "eq", value: "mobile" }] },
      { operator: "AND", conditions: [{ type: "country", operator: "eq", value: "US" }] },
    ];

    it("requires all groups to pass", () => {
      expect(evaluateTargetingRules(rules, { deviceType: "mobile", country: "US" })).toBe(true);
      expect(evaluateTargetingRules(rules, { deviceType: "desktop", country: "US" })).toBe(false);
      expect(evaluateTargetingRules(rules, { deviceType: "mobile", country: "GB" })).toBe(false);
    });
  });

  describe("UTM conditions", () => {
    const rule: TargetingGroup[] = [
      { operator: "AND", conditions: [{ type: "utm_source", operator: "eq", value: "google" }] },
    ];

    it("matches utm_source", () => {
      expect(evaluateTargetingRules(rule, { utmSource: "google" })).toBe(true);
      expect(evaluateTargetingRules(rule, { utmSource: "facebook" })).toBe(false);
    });

    it("returns false when utm_source not present", () => {
      expect(evaluateTargetingRules(rule, {})).toBe(false);
    });
  });

  describe("unknown condition type", () => {
    it("passes by default for unknown condition types", () => {
      const rule: TargetingGroup[] = [
        {
          operator: "AND",
          conditions: [{ type: "js_api" as never, operator: "eq", value: "custom" }],
        },
      ];
      expect(evaluateTargetingRules(rule, {})).toBe(true);
    });
  });

  describe("empty conditions group", () => {
    it("empty conditions group passes", () => {
      const rule: TargetingGroup[] = [{ operator: "AND", conditions: [] }];
      expect(evaluateTargetingRules(rule, {})).toBe(true);
    });
  });
});
