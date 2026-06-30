import { describe, expect, it } from "vitest";
import {
  DiscountApplicationStrategy,
  type FunctionRunResult,
  type RunInput,
} from "../generated/api";
import { run } from "./run";

type CartLine = RunInput["cart"]["lines"][number];
type ProductVariantLine = Extract<
  CartLine,
  { merchandise: { __typename: "ProductVariant" } }
>;
type CustomProductLine = Extract<
  CartLine,
  { merchandise: { __typename?: "CustomProduct" } }
>;
type TierConfig = {
  qty: number;
  percent: number;
  discount_label?: string;
};

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.All,
  discounts: [],
};

const DEFAULT_TIERS = [
  { qty: 1, percent: 0, discount_label: "" },
  { qty: 2, percent: 15, discount_label: "2+ for 15% off" },
  { qty: 3, percent: 20, discount_label: "3+ for 20% off" },
] satisfies TierConfig[];

function productLine({
  id,
  productId,
  quantity = 1,
  total,
  tiers = DEFAULT_TIERS,
  bundleItem = false,
}: {
  id: string;
  productId: string;
  quantity?: number;
  total: string;
  tiers?: unknown;
  bundleItem?: boolean;
}): ProductVariantLine {
  return {
    __typename: "CartLine",
    id,
    quantity,
    cost: {
      __typename: "CartLineCost",
      totalAmount: {
        __typename: "MoneyV2",
        amount: total,
      },
    },
    bundleItem: bundleItem
      ? {
          __typename: "Attribute",
          value: "true",
        }
      : null,
    merchandise: {
      __typename: "ProductVariant",
      product: {
        __typename: "Product",
        id: productId,
        metafield:
          tiers == null
            ? null
            : {
                __typename: "Metafield",
                jsonValue: tiers,
              },
      },
    },
  };
}

function customProductLine(id: string, quantity = 1, total = "10.00"): CustomProductLine {
  return {
    __typename: "CartLine",
    id,
    quantity,
    cost: {
      __typename: "CartLineCost",
      totalAmount: {
        __typename: "MoneyV2",
        amount: total,
      },
    },
    bundleItem: null,
    merchandise: {
      __typename: "CustomProduct",
    },
  };
}

function input(lines: CartLine[]): RunInput {
  return {
    __typename: "Input",
    cart: {
      __typename: "Cart",
      lines,
    },
  };
}

function discount(lineId: string, amount: string, message: string) {
  return {
    targets: [{ cartLine: { id: lineId } }],
    value: { fixedAmount: { amount } },
    message,
  };
}

describe("volume discount", () => {
  describe("tier selection", () => {
    it("does not discount a single eligible item because the qty 1 tier is 0%", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
            }),
          ]),
        ),
      ).toEqual(EMPTY_DISCOUNT);
    });

    it("applies the qty 2 tier across different eligible products", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "20.00",
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "1.50", "2+ for 15% off"),
          discount("line-2", "3.00", "2+ for 15% off"),
        ],
      });
    });

    it("applies the qty 3 tier across different eligible products", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "20.00",
            }),
            productLine({
              id: "line-3",
              productId: "product-3",
              total: "30.00",
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "2.00", "3+ for 20% off"),
          discount("line-2", "4.00", "3+ for 20% off"),
          discount("line-3", "6.00", "3+ for 20% off"),
        ],
      });
    });

    it("counts quantity on a single eligible line toward the global quantity", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              quantity: 2,
              total: "30.00",
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [discount("line-1", "4.50", "2+ for 15% off")],
      });
    });

    it("accepts metafield tiers when Shopify returns jsonValue as a JSON string", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              tiers: JSON.stringify(DEFAULT_TIERS),
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "10.00",
              tiers: JSON.stringify(DEFAULT_TIERS),
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "1.50", "2+ for 15% off"),
          discount("line-2", "1.50", "2+ for 15% off"),
        ],
      });
    });

    it("chooses the highest matching quantity even when tiers are unsorted", () => {
      const unsortedTiers = [
        { qty: 3, percent: 20, discount_label: "3+ for 20% off" },
        { qty: 1, percent: 0, discount_label: "" },
        { qty: 2, percent: 15, discount_label: "2+ for 15% off" },
      ] satisfies TierConfig[];

      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              tiers: unsortedTiers,
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "10.00",
              tiers: unsortedTiers,
            }),
            productLine({
              id: "line-3",
              productId: "product-3",
              total: "10.00",
              tiers: unsortedTiers,
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "2.00", "3+ for 20% off"),
          discount("line-2", "2.00", "3+ for 20% off"),
          discount("line-3", "2.00", "3+ for 20% off"),
        ],
      });
    });

    it("uses the highest percent when two matching tiers have the same quantity", () => {
      const duplicateQtyTiers = [
        { qty: 2, percent: 10, discount_label: "2+ for 10% off" },
        { qty: 2, percent: 15, discount_label: "2+ for 15% off" },
      ] satisfies TierConfig[];

      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              tiers: duplicateQtyTiers,
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "10.00",
              tiers: duplicateQtyTiers,
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "1.50", "2+ for 15% off"),
          discount("line-2", "1.50", "2+ for 15% off"),
        ],
      });
    });
  });

  describe("eligibility guards", () => {
    it("does not count lines without the volume discount metafield", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "20.00",
              tiers: null,
            }),
          ]),
        ),
      ).toEqual(EMPTY_DISCOUNT);
    });

    it("does not count bundle builder lines even when their products have volume tiers", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              bundleItem: true,
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "20.00",
              bundleItem: true,
            }),
          ]),
        ),
      ).toEqual(EMPTY_DISCOUNT);
    });

    it("applies volume tiers to non-bundle lines while ignoring bundle builder lines in the same cart", () => {
      expect(
        run(
          input([
            productLine({
              id: "bundle-line-1",
              productId: "bundle-product-1",
              total: "10.00",
              bundleItem: true,
            }),
            productLine({
              id: "bundle-line-2",
              productId: "bundle-product-2",
              total: "20.00",
              bundleItem: true,
            }),
            productLine({
              id: "pdp-line-1",
              productId: "pdp-product-1",
              total: "10.00",
            }),
            productLine({
              id: "pdp-line-2",
              productId: "pdp-product-2",
              total: "20.00",
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("pdp-line-1", "1.50", "2+ for 15% off"),
          discount("pdp-line-2", "3.00", "2+ for 15% off"),
        ],
      });
    });

    it("skips non ProductVariant merchandise", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
            }),
            customProductLine("line-2"),
          ]),
        ),
      ).toEqual(EMPTY_DISCOUNT);
    });

    it("ignores invalid JSON tier config", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              tiers: "{not valid json",
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "10.00",
            }),
          ]),
        ),
      ).toEqual(EMPTY_DISCOUNT);
    });

    it("filters malformed tiers and only uses valid tier objects", () => {
      const mixedTiers = [
        null,
        { qty: "2", percent: 15, discount_label: "bad qty" },
        { qty: 2, percent: "15", discount_label: "bad percent" },
        { qty: 2, percent: -15, discount_label: "bad negative percent" },
        { qty: 2, percent: 15, discount_label: "2+ for 15% off" },
      ];

      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              tiers: mixedTiers,
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "10.00",
              tiers: mixedTiers,
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "1.50", "2+ for 15% off"),
          discount("line-2", "1.50", "2+ for 15% off"),
        ],
      });
    });

    it("skips lines with zero, negative, or non-numeric totals", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "0.00",
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "-1.00",
            }),
            productLine({
              id: "line-3",
              productId: "product-3",
              total: "not-a-number",
            }),
            productLine({
              id: "line-4",
              productId: "product-4",
              total: "10.00",
            }),
          ]),
        ),
      ).toEqual(EMPTY_DISCOUNT);
    });
  });

  describe("discount allocation", () => {
    it("allocates discount proportionally by line total", () => {
      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "25.00",
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "75.00",
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "3.75", "2+ for 15% off"),
          discount("line-2", "11.25", "2+ for 15% off"),
        ],
      });
    });

    it("keeps rounding remainder on the last eligible line so the total discount is exact", () => {
      const result = run(
        input([
          productLine({
            id: "line-1",
            productId: "product-1",
            total: "0.01",
          }),
          productLine({
            id: "line-2",
            productId: "product-2",
            total: "0.01",
          }),
          productLine({
            id: "line-3",
            productId: "product-3",
            total: "0.01",
          }),
        ]),
      );

      expect(result).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "0.00", "3+ for 20% off"),
          discount("line-2", "0.00", "3+ for 20% off"),
          discount("line-3", "0.01", "3+ for 20% off"),
        ],
      });

      const appliedTotal = result.discounts.reduce((sum, current) => {
        const amount = current.value.fixedAmount?.amount;
        return sum + Number(amount ?? 0);
      }, 0);

      expect(appliedTotal).toBeCloseTo(0.01);
    });

    it("uses a fallback message when the selected tier has no label", () => {
      const tiersWithoutLabel = [
        { qty: 2, percent: 15 },
      ] satisfies TierConfig[];

      expect(
        run(
          input([
            productLine({
              id: "line-1",
              productId: "product-1",
              total: "10.00",
              tiers: tiersWithoutLabel,
            }),
            productLine({
              id: "line-2",
              productId: "product-2",
              total: "10.00",
              tiers: tiersWithoutLabel,
            }),
          ]),
        ),
      ).toEqual({
        discountApplicationStrategy: DiscountApplicationStrategy.All,
        discounts: [
          discount("line-1", "1.50", "15% off"),
          discount("line-2", "1.50", "15% off"),
        ],
      });
    });
  });
});
