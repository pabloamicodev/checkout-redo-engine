export interface MetricConfig {
  label: string;
  shortLabel: string;
  description: string;
  hex: string;
  format: "percent" | "currency" | "number" | "duration";
  higherIsBetter: boolean;
}

export const METRIC_THEME: Record<string, MetricConfig> = {
  conversion_rate:       { label: "Conversion Rate",       shortLabel: "CVR",    description: "% of visitors who purchased",                 hex: "#10b981", format: "percent",  higherIsBetter: true  },
  revenue_per_visitor:   { label: "Revenue per Visitor",   shortLabel: "RPV",    description: "Average revenue generated per unique visitor", hex: "#6366f1", format: "currency", higherIsBetter: true  },
  average_order_value:   { label: "Average Order Value",   shortLabel: "AOV",    description: "Average value of completed orders",            hex: "#0ea5e9", format: "currency", higherIsBetter: true  },
  profit_per_visitor:    { label: "Profit per Visitor",    shortLabel: "PPV",    description: "Gross profit per unique visitor",              hex: "#059669", format: "currency", higherIsBetter: true  },
  gross_profit:          { label: "Gross Profit",          shortLabel: "GP",     description: "Total gross profit attributed",                hex: "#059669", format: "currency", higherIsBetter: true  },
  add_to_cart_rate:      { label: "Add to Cart Rate",      shortLabel: "ATC",    description: "% of visitors who added to cart",             hex: "#f59e0b", format: "percent",  higherIsBetter: true  },
  checkout_completion:   { label: "Checkout Completion",   shortLabel: "CKO",    description: "% of checkout starts that completed",         hex: "#4f46e5", format: "percent",  higherIsBetter: true  },
  discount_cost:         { label: "Discount Cost",         shortLabel: "DC",     description: "Total discount value given",                  hex: "#ef4444", format: "currency", higherIsBetter: false },
  claim_rate:            { label: "Claim Rate",            shortLabel: "CR",     description: "% of eligible visitors who claimed offer",    hex: "#10b981", format: "percent",  higherIsBetter: true  },
  shipping_revenue:      { label: "Shipping Revenue",      shortLabel: "SR",     description: "Total revenue from shipping",                 hex: "#0891b2", format: "currency", higherIsBetter: true  },
  gross_margin:          { label: "Gross Margin",          shortLabel: "GM",     description: "Gross profit as % of revenue",                hex: "#059669", format: "percent",  higherIsBetter: true  },
  impressions:           { label: "Impressions",           shortLabel: "Imp",    description: "Total block views",                           hex: "#94a3b8", format: "number",   higherIsBetter: true  },
  sessions:              { label: "Sessions",              shortLabel: "Sess",   description: "Unique visitor sessions",                     hex: "#94a3b8", format: "number",   higherIsBetter: true  },
};

export function getMetricTheme(key: string): MetricConfig {
  return METRIC_THEME[key] ?? {
    label: key,
    shortLabel: key,
    description: "",
    hex: "#94a3b8",
    format: "number",
    higherIsBetter: true,
  };
}
