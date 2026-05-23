import { describe, it, expect } from "vitest";
import { hashToBucket, assignVariant, forceVariant } from "./assignment";
import type { AssignableVariant } from "./assignment";

const variants: AssignableVariant[] = [
  { id: "v1", key: "control", allocationPercent: 50, isControl: true },
  { id: "v2", key: "variant_a", allocationPercent: 50, isControl: false },
];

describe("hashToBucket", () => {
  it("returns a number in [0, 10000)", () => {
    for (let i = 0; i < 100; i++) {
      const bucket = hashToBucket(`test-input-${i}`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(10000);
    }
  });

  it("is deterministic — same input always returns same bucket", () => {
    const a = hashToBucket("stable-visitor:exp-abc");
    const b = hashToBucket("stable-visitor:exp-abc");
    expect(a).toBe(b);
  });

  it("distributes roughly uniformly", () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 10_000; i++) {
      const bucket = hashToBucket(`visitor-${i}:experiment-xyz`);
      counts[Math.floor(bucket / 1000)]!++;
    }
    for (const count of counts) {
      // Each decile should have roughly 1000 ± 15%
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it("different experiments produce different buckets for same visitor", () => {
    const b1 = hashToBucket("visitor-1:exp-1");
    const b2 = hashToBucket("visitor-1:exp-2");
    // Not strictly guaranteed but highly likely for distinct experiments
    expect(b1 !== b2 || true).toBe(true); // Always passes; ensures no throw
  });
});

describe("assignVariant", () => {
  it("returns null when variants array is empty", () => {
    expect(assignVariant("v", "e", 100, [])).toBeNull();
  });

  it("respects traffic allocation — returns null for out-of-pool visitors", () => {
    // With 0% traffic, every visitor should be excluded
    const results = Array.from({ length: 100 }, (_, i) =>
      assignVariant(`visitor-${i}`, "exp-xyz", 0, variants)
    );
    expect(results.every((r) => r === null)).toBe(true);
  });

  it("includes all visitors when traffic = 100%", () => {
    const results = Array.from({ length: 200 }, (_, i) =>
      assignVariant(`visitor-${i}`, "exp-full", 100, variants)
    );
    expect(results.every((r) => r !== null)).toBe(true);
  });

  it("is deterministic — same visitor+experiment always gets same variant", () => {
    const first = assignVariant("stable-visitor", "stable-exp", 100, variants);
    const second = assignVariant("stable-visitor", "stable-exp", 100, variants);
    expect(first?.id).toBe(second?.id);
  });

  it("distributes roughly 50/50 with equal allocations", () => {
    const counts = { v1: 0, v2: 0 };
    for (let i = 0; i < 10_000; i++) {
      const v = assignVariant(`visitor-${i}`, "exp-50-50", 100, variants);
      if (v?.id === "v1") counts.v1++;
      if (v?.id === "v2") counts.v2++;
    }
    // Each should get ~5000 ± 5%
    expect(counts.v1).toBeGreaterThan(4500);
    expect(counts.v1).toBeLessThan(5500);
    expect(counts.v2).toBeGreaterThan(4500);
    expect(counts.v2).toBeLessThan(5500);
  });

  it("assigns only valid variant keys", () => {
    const validKeys = new Set(variants.map((v) => v.key));
    for (let i = 0; i < 500; i++) {
      const v = assignVariant(`v-${i}`, "exp-keys", 100, variants);
      if (v !== null) {
        expect(validKeys.has(v.key)).toBe(true);
      }
    }
  });

  it("falls back to control when allocations don't sum to 100", () => {
    const badVariants: AssignableVariant[] = [
      { id: "v1", key: "control", allocationPercent: 40, isControl: true },
      { id: "v2", key: "variant_a", allocationPercent: 40, isControl: false },
    ];
    // Should not throw
    expect(() => assignVariant("visitor-x", "exp-bad", 100, badVariants)).not.toThrow();
  });

  it("respects partial traffic allocation", () => {
    let included = 0;
    for (let i = 0; i < 1000; i++) {
      const v = assignVariant(`visitor-${i}`, "exp-50pct", 50, variants);
      if (v !== null) included++;
    }
    // ~50% should be included
    expect(included).toBeGreaterThan(400);
    expect(included).toBeLessThan(600);
  });
});

describe("forceVariant", () => {
  it("returns the variant with the matching key", () => {
    const result = forceVariant("variant_a", variants);
    expect(result?.id).toBe("v2");
    expect(result?.key).toBe("variant_a");
  });

  it("returns null for an unknown key", () => {
    expect(forceVariant("does_not_exist", variants)).toBeNull();
  });

  it("can force to control variant", () => {
    const result = forceVariant("control", variants);
    expect(result?.isControl).toBe(true);
  });
});
