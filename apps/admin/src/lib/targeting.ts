/**
 * Targeting rule evaluator.
 * Rules are evaluated client-side in the storefront runtime AND server-side
 * in the assignment API for secondary validation.
 *
 * Rule schema (JSON array):
 * [
 *   {
 *     "operator": "AND" | "OR",
 *     "conditions": [
 *       { "type": "device", "operator": "eq", "value": "mobile" },
 *       { "type": "country", "operator": "in", "value": ["US", "CA"] },
 *       { "type": "url_contains", "operator": "contains", "value": "/products/" },
 *       { "type": "utm_source", "operator": "eq", "value": "google" },
 *       { "type": "cart_value_gte", "operator": "gte", "value": 50 },
 *       { "type": "new_visitor", "operator": "eq", "value": true },
 *       { "type": "returning_visitor", "operator": "eq", "value": true },
 *       { "type": "customer_logged_in", "operator": "eq", "value": true },
 *       { "type": "date_after", "operator": "gte", "value": "2025-01-01" },
 *       { "type": "date_before", "operator": "lt", "value": "2025-12-31" },
 *     ]
 *   }
 * ]
 */

export interface TargetingCondition {
  type: TargetingConditionType;
  operator: "eq" | "neq" | "contains" | "not_contains" | "in" | "not_in" | "gte" | "lte" | "gt" | "lt";
  value: string | number | boolean | string[] | number[];
}

export type TargetingConditionType =
  | "device"
  | "country"
  | "currency"
  | "url_contains"
  | "url_matches"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "cart_value_gte"
  | "cart_value_lte"
  | "cart_contains_product"
  | "cart_contains_collection"
  | "new_visitor"
  | "returning_visitor"
  | "customer_logged_in"
  | "customer_tag"
  | "date_after"
  | "date_before"
  | "hour_of_day"
  | "day_of_week"
  | "page_type"
  | "product_viewed"
  | "collection_viewed"
  | "js_api";

export interface TargetingGroup {
  operator: "AND" | "OR";
  conditions: TargetingCondition[];
}

export interface EvaluationContext {
  deviceType?: string;
  country?: string;
  currency?: string;
  url?: string;
  path?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  cartValue?: number;
  cartProductIds?: string[];
  cartCollectionIds?: string[];
  isNewVisitor?: boolean;
  isReturningVisitor?: boolean;
  isCustomerLoggedIn?: boolean;
  customerTags?: string[];
  currentDate?: Date;
  pageType?: string;
  viewedProductIds?: string[];
  viewedCollectionIds?: string[];
}

function evaluateCondition(
  condition: TargetingCondition,
  ctx: EvaluationContext
): boolean {
  const { type, operator, value } = condition;

  switch (type) {
    case "device":
      return compare(ctx.deviceType, operator, value as string);
    case "country":
      return compareArrayInclusion(ctx.country, operator, value as string | string[]);
    case "currency":
      return compare(ctx.currency, operator, value as string);
    case "url_contains":
      return compare(ctx.url ?? ctx.path ?? "", operator, value as string);
    case "url_matches":
      try {
        const regex = new RegExp(value as string);
        const matches = regex.test(ctx.url ?? ctx.path ?? "");
        return operator === "eq" ? matches : !matches;
      } catch {
        return false;
      }
    case "utm_source":
      return compare(ctx.utmSource, operator, value as string);
    case "utm_medium":
      return compare(ctx.utmMedium, operator, value as string);
    case "utm_campaign":
      return compare(ctx.utmCampaign, operator, value as string);
    case "utm_content":
      return compare(ctx.utmContent, operator, value as string);
    case "utm_term":
      return compare(ctx.utmTerm, operator, value as string);
    case "cart_value_gte":
      return (ctx.cartValue ?? 0) >= (value as number);
    case "cart_value_lte":
      return (ctx.cartValue ?? 0) <= (value as number);
    case "cart_contains_product":
      return (ctx.cartProductIds ?? []).includes(value as string);
    case "cart_contains_collection":
      return (ctx.cartCollectionIds ?? []).includes(value as string);
    case "new_visitor":
      return operator === "eq" ? !!ctx.isNewVisitor === value : !!ctx.isNewVisitor !== value;
    case "returning_visitor":
      return operator === "eq" ? !!ctx.isReturningVisitor === value : !!ctx.isReturningVisitor !== value;
    case "customer_logged_in":
      return operator === "eq" ? !!ctx.isCustomerLoggedIn === value : !!ctx.isCustomerLoggedIn !== value;
    case "customer_tag": {
      const tags = ctx.customerTags ?? [];
      if (Array.isArray(value)) {
        const included = (value as string[]).some((t) => tags.includes(t));
        return operator === "in" ? included : !included;
      }
      const included = tags.includes(value as string);
      return operator === "eq" ? included : !included;
    }
    case "date_after": {
      const now = ctx.currentDate ?? new Date();
      const target = new Date(value as string);
      return now >= target;
    }
    case "date_before": {
      const now = ctx.currentDate ?? new Date();
      const target = new Date(value as string);
      return now < target;
    }
    case "hour_of_day": {
      const hour = (ctx.currentDate ?? new Date()).getHours();
      return compare(hour, operator, value as number);
    }
    case "day_of_week": {
      const day = (ctx.currentDate ?? new Date()).getDay();
      return compareArrayInclusion(day.toString(), operator, value as string | string[]);
    }
    case "page_type":
      return compareArrayInclusion(ctx.pageType ?? "", operator, value as string | string[]);
    case "product_viewed":
      return (ctx.viewedProductIds ?? []).includes(value as string);
    case "collection_viewed":
      return (ctx.viewedCollectionIds ?? []).includes(value as string);
    default:
      return false; // Unknown condition types fail-safe (deny rather than allow)
  }
}

function compare(
  actual: string | number | undefined,
  operator: string,
  expected: string | number
): boolean {
  if (actual === undefined) return false;
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "contains":
      return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    case "not_contains":
      return !String(actual).toLowerCase().includes(String(expected).toLowerCase());
    case "gte":
      return Number(actual) >= Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

function compareArrayInclusion(
  actual: string | undefined,
  operator: string,
  expected: string | string[]
): boolean {
  if (actual === undefined) return false;
  const values = Array.isArray(expected) ? expected : [expected];
  const included = values.some(
    (v) => String(actual).toLowerCase() === String(v).toLowerCase()
  );
  if (operator === "in" || operator === "eq") return included;
  if (operator === "not_in" || operator === "neq") return !included;
  return compare(actual, operator, values[0] ?? "");
}

export function evaluateTargetingRules(
  rules: TargetingGroup[],
  ctx: EvaluationContext
): boolean {
  // Empty rules = target everyone
  if (!rules.length) return true;

  // Top-level groups are AND-combined
  for (const group of rules) {
    const groupResult = evaluateGroup(group, ctx);
    if (!groupResult) return false;
  }
  return true;
}

function evaluateGroup(
  group: TargetingGroup,
  ctx: EvaluationContext
): boolean {
  if (!group.conditions.length) return true;

  if (group.operator === "OR") {
    return group.conditions.some((c) => evaluateCondition(c, ctx));
  }
  // AND
  return group.conditions.every((c) => evaluateCondition(c, ctx));
}
