/**
 * CogsService — manages Product Cost (COGS) records.
 *
 * Three ingestion paths:
 *  1. syncFromShopify  — pulls costPerItem from Shopify inventoryItem API
 *  2. importCsv        — parses uploaded CSV with variant_id + cost columns
 *  3. update (manual)  — single-variant manual entry / override
 *
 * Guards:
 *  - GUARD: CSV > 10,000 rows requires force=true (pre-confirmation from UI)
 *  - GUARD: cost must be a positive finite number
 *  - GUARD: MANUAL source entries are not overwritten by Shopify sync or CSV
 *    unless the caller explicitly sets overwriteManual=true
 *  - GUARD: shopifyVariantId is always stored as a full GID
 */

import { prisma } from "@/lib/prisma";
import { getShopifyAdminClient } from "@/lib/shopify";
import { logger } from "@/lib/logger";

const GIDS_PREFIX = "gid://shopify/ProductVariant/";
const CSV_MAX_ROWS_WITHOUT_FORCE = 10_000;

function toVariantGid(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("gid://") ? trimmed : `${GIDS_PREFIX}${trimmed}`;
}

function isPositiveFinite(n: number) {
  return Number.isFinite(n) && n > 0;
}

// Simple CSV parser — no external dependency
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const rows = lines.slice(1).map((line) => {
    // Handle simple quoted fields (commas inside quotes not supported on purpose — COGS CSVs don't need them)
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]!] = values[i] ?? "";
    }
    return row;
  });

  return { headers, rows };
}

export interface CogsListItem {
  id: string;
  shopifyVariantId: string;
  sku: string | null;
  cost: number;
  currencyCode: string;
  source: string;
  updatedAt: Date;
}

export interface CogsCoverage {
  totalProductCosts: number;
  ordersLast30Days: number;
  ordersWithCogs: number;
  coveragePct: number;
  belowWarningThreshold: boolean;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  requiresConfirmation?: boolean;
  rowCount?: number;
}

// Shopify GraphQL response shape
interface ProductsGqlResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      id: string;
      variants: {
        nodes: Array<{
          id: string;
          sku: string | null;
          inventoryItem: {
            unitCost: { amount: string; currencyCode: string } | null;
          } | null;
        }>;
      };
    }>;
  };
}

const PRODUCTS_COST_QUERY = `
  query GetProductCosts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        variants(first: 100) {
          nodes {
            id
            sku
            inventoryItem {
              unitCost {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

export class CogsService {
  async list(
    shopId: string,
    opts: { search?: string; page?: number; limit?: number } = {}
  ): Promise<{ items: CogsListItem[]; total: number }> {
    const limit = opts.limit ?? 50;
    const page = Math.max(0, (opts.page ?? 1) - 1);
    const skip = page * limit;

    const search = opts.search?.trim();
    const where = {
      shopId,
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" as const } },
              { shopifyVariantId: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.productCost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          shopifyVariantId: true,
          sku: true,
          cost: true,
          currencyCode: true,
          source: true,
          updatedAt: true,
        },
      }),
      prisma.productCost.count({ where }),
    ]);

    return { items, total };
  }

  async getCoverage(shopId: string): Promise<CogsCoverage> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalProductCosts, ordersLast30Days, ordersWithCogs] = await Promise.all([
      prisma.productCost.count({ where: { shopId } }),
      prisma.orderAttribution.count({
        where: { shopId, attributedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: thirtyDaysAgo },
          cogs: { not: null, gt: 0 },
        },
      }),
    ]);

    const coveragePct =
      ordersLast30Days > 0
        ? Math.round((ordersWithCogs / ordersLast30Days) * 100)
        : 100;

    return {
      totalProductCosts,
      ordersLast30Days,
      ordersWithCogs,
      coveragePct,
      // GUARD: warn merchant if < 80% of recent orders lacked COGS data
      belowWarningThreshold: ordersLast30Days > 0 && coveragePct < 80,
    };
  }

  // Pull costPerItem from Shopify inventoryItem API.
  // GUARD: requires read_inventory scope — returns error count if scope is missing.
  // GUARD: never overwrites MANUAL entries unless overwriteManual=true.
  async syncFromShopify(
    shopId: string,
    shopDomain: string,
    overwriteManual = false
  ): Promise<SyncResult> {
    const client = await getShopifyAdminClient(shopDomain);

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      let response: { data: ProductsGqlResponse };
      try {
        const raw = await client.request<ProductsGqlResponse>(PRODUCTS_COST_QUERY, {
          variables: { cursor },
        });
        if (!raw.data) throw new Error("Empty GraphQL response from Shopify");
        response = { data: raw.data };
      } catch (err) {
        logger.error("[CogsService.syncFromShopify] GraphQL error", err instanceof Error ? err : undefined);
        errors++;
        break;
      }

      const { nodes, pageInfo } = response.data.products;
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      for (const product of nodes) {
        for (const variant of product.variants.nodes) {
          const unitCost = variant.inventoryItem?.unitCost;
          if (!unitCost) {
            skipped++;
            continue;
          }

          const cost = parseFloat(unitCost.amount);
          if (!isPositiveFinite(cost)) {
            skipped++;
            continue;
          }

          const variantGid = toVariantGid(variant.id);

          const existing = await prisma.productCost.findUnique({
            where: { shopifyVariantId: variantGid },
            select: { source: true },
          });

          // GUARD: don't overwrite MANUAL entries unless explicitly allowed
          if (existing?.source === "MANUAL" && !overwriteManual) {
            skipped++;
            continue;
          }

          try {
            await prisma.productCost.upsert({
              where: { shopifyVariantId: variantGid },
              create: {
                shopId,
                shopifyProductId: toVariantGid(product.id).replace(
                  "ProductVariant",
                  "Product"
                ),
                shopifyVariantId: variantGid,
                sku: variant.sku ?? null,
                cost,
                currencyCode: unitCost.currencyCode,
                source: "SHOPIFY_API",
              },
              update: {
                cost,
                currencyCode: unitCost.currencyCode,
                sku: variant.sku ?? null,
                source: "SHOPIFY_API",
              },
            });
            synced++;
          } catch {
            errors++;
          }
        }
      }
    }

    // Persist sync status to shop settings so the UI can show "last synced at".
    // Read-then-merge to avoid overwriting other settings keys in the JSON blob.
    try {
      const current = await prisma.shop.findUnique({ where: { id: shopId }, select: { settings: true } });
      const merged = {
        ...((current?.settings ?? {}) as Record<string, unknown>),
        cogsSyncAt: new Date().toISOString(),
        cogsSyncResult: { synced, skipped, errors },
      };
      await prisma.shop.update({ where: { id: shopId }, data: { settings: merged } });
    } catch {
      // Non-fatal: sync status display is best-effort
    }

    return { synced, skipped, errors };
  }

  async getLastSyncStatus(shopId: string): Promise<{
    cogsSyncAt: string | null;
    cogsSyncResult: { synced: number; skipped: number; errors: number } | null;
  }> {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });
    const s = (shop?.settings ?? {}) as Record<string, unknown>;
    return {
      cogsSyncAt: (s.cogsSyncAt as string) ?? null,
      cogsSyncResult: (s.cogsSyncResult as { synced: number; skipped: number; errors: number }) ?? null,
    };
  }

  // Parse and import a CSV file.
  // Expected columns: variant_id (required), cost (required), sku (optional), currency (optional)
  // GUARD: > 10,000 rows requires force=true from the caller
  // GUARD: cost must be a positive finite number
  // GUARD: MANUAL entries not overwritten unless overwriteManual=true
  async importCsv(
    shopId: string,
    csvText: string,
    opts: { overwriteManual?: boolean; force?: boolean } = {}
  ): Promise<ImportResult> {
    const { headers, rows } = parseCsv(csvText);

    // GUARD: required header
    const hasVariantId = headers.includes("variant_id");
    if (!hasVariantId) {
      return {
        imported: 0,
        skipped: 0,
        errors: ["Missing required column: variant_id"],
      };
    }
    if (!headers.includes("cost")) {
      return {
        imported: 0,
        skipped: 0,
        errors: ["Missing required column: cost"],
      };
    }

    // GUARD: row count limit
    if (rows.length > CSV_MAX_ROWS_WITHOUT_FORCE && !opts.force) {
      return {
        imported: 0,
        skipped: 0,
        errors: [],
        requiresConfirmation: true,
        rowCount: rows.length,
      };
    }

    const importErrors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const lineNum = i + 2; // 1-indexed, header is line 1

      const rawVariantId = row["variant_id"] ?? "";
      if (!rawVariantId) {
        importErrors.push(`Line ${lineNum}: missing variant_id`);
        skipped++;
        continue;
      }

      const rawCost = row["cost"] ?? "";
      const cost = parseFloat(rawCost);

      // GUARD: cost must be a positive finite number
      if (!isPositiveFinite(cost)) {
        importErrors.push(
          `Line ${lineNum}: cost "${rawCost}" is not a positive number`
        );
        skipped++;
        continue;
      }

      const variantGid = toVariantGid(rawVariantId);
      const sku = row["sku"]?.trim() || null;
      const currencyCode = (row["currency"] ?? row["currency_code"] ?? "USD").trim().toUpperCase();

      const existing = await prisma.productCost.findUnique({
        where: { shopifyVariantId: variantGid },
        select: { source: true, shopifyProductId: true },
      });

      // GUARD: don't overwrite MANUAL entries unless explicitly allowed
      if (existing?.source === "MANUAL" && !opts.overwriteManual) {
        skipped++;
        continue;
      }

      try {
        await prisma.productCost.upsert({
          where: { shopifyVariantId: variantGid },
          create: {
            shopId,
            shopifyProductId: existing?.shopifyProductId ?? `${GIDS_PREFIX.replace("ProductVariant", "Product")}unknown`,
            shopifyVariantId: variantGid,
            sku,
            cost,
            currencyCode,
            source: "CSV_IMPORT",
          },
          update: {
            cost,
            currencyCode,
            ...(sku ? { sku } : {}),
            source: "CSV_IMPORT",
          },
        });
        imported++;
      } catch (err) {
        importErrors.push(
          `Line ${lineNum}: database error — ${err instanceof Error ? err.message : "unknown"}`
        );
        skipped++;
      }

      // Limit error accumulation
      if (importErrors.length >= 100) {
        importErrors.push("... further errors truncated (showing first 100)");
        break;
      }
    }

    return { imported, skipped, errors: importErrors };
  }

  // Create or update a single variant cost (MANUAL source).
  // GUARD: cost must be a positive finite number.
  async update(
    shopId: string,
    variantId: string,
    cost: number,
    opts: { sku?: string; currencyCode?: string } = {}
  ): Promise<CogsListItem> {
    // GUARD: cost must be a positive finite number
    if (!isPositiveFinite(cost)) {
      throw new Error("cost must be a positive number");
    }

    const variantGid = toVariantGid(variantId);

    const record = await prisma.productCost.upsert({
      where: { shopifyVariantId: variantGid },
      create: {
        shopId,
        shopifyProductId: `gid://shopify/Product/unknown`,
        shopifyVariantId: variantGid,
        sku: opts.sku ?? null,
        cost,
        currencyCode: opts.currencyCode ?? "USD",
        source: "MANUAL",
      },
      update: {
        cost,
        source: "MANUAL",
        ...(opts.sku !== undefined ? { sku: opts.sku } : {}),
        ...(opts.currencyCode ? { currencyCode: opts.currencyCode } : {}),
      },
    });

    return record;
  }

  async delete(shopId: string, id: string): Promise<void> {
    await prisma.productCost.delete({
      where: { id, shopId },
    });
  }
}
