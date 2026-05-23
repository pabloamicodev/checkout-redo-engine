export type StepState = "pending" | "active" | "complete" | "error";

export interface StepTheme {
  numberBg: string;
  numberText: string;
  numberBorder: string;
  labelColor: string;
  connectorColor: string;
}

export function getStepTheme(state: StepState, accentHex = "#6366f1"): StepTheme {
  switch (state) {
    case "active":
      return {
        numberBg: accentHex,
        numberText: "#ffffff",
        numberBorder: accentHex,
        labelColor: "#111827",
        connectorColor: "#e5e7eb",
      };
    case "complete":
      return {
        numberBg: "#f0fdf4",
        numberText: "#16a34a",
        numberBorder: "#86efac",
        labelColor: "#374151",
        connectorColor: "#86efac",
      };
    case "error":
      return {
        numberBg: "#fef2f2",
        numberText: "#dc2626",
        numberBorder: "#fca5a5",
        labelColor: "#dc2626",
        connectorColor: "#e5e7eb",
      };
    case "pending":
    default:
      return {
        numberBg: "#f9fafb",
        numberText: "#9ca3af",
        numberBorder: "#e5e7eb",
        labelColor: "#9ca3af",
        connectorColor: "#e5e7eb",
      };
  }
}
