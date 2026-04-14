import type {
  RunInput,
  FunctionRunResult
} from "../generated/api";
import {
  DiscountApplicationStrategy,
} from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

type Configuration = {
  percentage: number;
};

export function run(input: RunInput): FunctionRunResult {
  const configuration: Configuration = JSON.parse(
    input?.discountNode?.metafield?.jsonValue ?? "{}"
  );

  const percentage = configuration?.percentage;
  if (!percentage || percentage <= 0) {
    return EMPTY_DISCOUNT;
  }

  const targets = input.cart.lines
    .filter((line) => line.attribute?.value === "true")
    .map((line) => ({
      cartLine: {
        id: line.id,
        quantity: line.quantity,
      },
    }));

  if (targets.length === 0) {
    return EMPTY_DISCOUNT;
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [
      {
        targets,
        value: {
          percentage: {
            value: percentage.toFixed(1).toString(),
          },
        },
        message: `${percentage}% off duplicated items`,
      },
    ],
  };
}