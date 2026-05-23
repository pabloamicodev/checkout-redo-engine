/**
 * Deterministic variant assignment using consistent hashing.
 *
 * Same visitor + same experiment always maps to same bucket (0-99),
 * making assignments stable without requiring server-side state lookup
 * on every request (though state is still persisted for attribution).
 */

import { createHash } from "crypto";

export interface AssignableVariant {
  id: string;
  key: string;
  allocationPercent: number;
  isControl: boolean;
}

/**
 * Hash a string to a deterministic integer in [0, 10000).
 * Uses SHA-256, reads the first 4 bytes as a big-endian uint32, then mod 10000.
 * 10000 buckets gives 0.01% granularity for traffic allocation.
 */
export function hashToBucket(input: string): number {
  const hash = createHash("sha256").update(input).digest();
  // Read first 4 bytes as big-endian uint32
  const uint32 =
    ((hash[0]! << 24) |
      (hash[1]! << 16) |
      (hash[2]! << 8) |
      hash[3]!) >>>
    0; // unsigned right shift to ensure positive
  return uint32 % 10000;
}

/**
 * Assign a visitor to a variant given:
 * - visitorId: stable identifier for the visitor
 * - experimentId: the experiment being evaluated
 * - trafficAllocation: what % of total traffic is even eligible (0-100)
 * - variants: array with allocationPercent that sums to 100
 *
 * Returns the assigned variant, or null if visitor is not in the traffic allocation.
 */
export function assignVariant(
  visitorId: string,
  experimentId: string,
  trafficAllocation: number,
  variants: AssignableVariant[]
): AssignableVariant | null {
  if (!variants.length) return null;

  // Step 1: Determine if visitor is in the traffic pool
  const trafficBucket = hashToBucket(`${experimentId}:traffic:${visitorId}`);
  const trafficThreshold = Math.floor((trafficAllocation / 100) * 10000);

  if (trafficBucket >= trafficThreshold) {
    return null; // visitor is excluded from this experiment's traffic
  }

  // Step 2: Assign to a variant within the traffic pool
  const variantBucket = hashToBucket(`${experimentId}:variant:${visitorId}`);
  const variantThreshold = Math.floor(variantBucket / 100); // 0-99 range

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.allocationPercent;
    if (variantThreshold < cumulative) {
      return variant;
    }
  }

  // Fallback: return control (should never happen if allocations sum to 100)
  return variants.find((v) => v.isControl) ?? variants[0] ?? null;
}

/**
 * Force a specific variant assignment (used for preview and QA).
 */
export function forceVariant(
  variantKey: string,
  variants: AssignableVariant[]
): AssignableVariant | null {
  return variants.find((v) => v.key === variantKey) ?? null;
}

/**
 * Generate a stable visitor ID from a fingerprint.
 * In production the storefront creates this client-side using a UUID v4
 * stored in localStorage, so this server helper is mainly for attribution.
 */
export function generateVisitorId(): string {
  const bytes = createHash("sha256")
    .update(Math.random().toString() + Date.now().toString())
    .digest("hex")
    .slice(0, 32);
  // Format as UUID v4-ish
  return [
    bytes.slice(0, 8),
    bytes.slice(8, 12),
    "4" + bytes.slice(13, 16),
    bytes.slice(16, 20),
    bytes.slice(20, 32),
  ].join("-");
}
