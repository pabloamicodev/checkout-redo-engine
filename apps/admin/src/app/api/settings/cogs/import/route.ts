import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { CogsService } from "@/services/cogs.service";

const service = new CogsService();

// POST /api/settings/cogs/import
// Accepts a multipart/form-data upload with a `file` field (CSV).
// Required CSV columns: variant_id, cost
// Optional columns: sku, currency (or currency_code)
//
// GUARD: > 10,000 rows returns { requiresConfirmation: true, rowCount: N }
//        unless the request includes force=true in body/query.
// GUARD: cost must be a positive finite number — rows with invalid cost are skipped.
// GUARD: MANUAL source entries are not overwritten unless overwriteManual=true.
export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "File must be a .csv" }, { status: 400 });
    }

    const csvText = await file.text();
    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    const overwriteManual = formData.get("overwriteManual") === "true";
    const force = formData.get("force") === "true";

    const result = await service.importCsv(shopId, csvText, { overwriteManual, force });

    if (result.requiresConfirmation) {
      return NextResponse.json(result, { status: 202 });
    }

    const status = result.errors.length > 0 ? 207 : 200;
    return NextResponse.json(result, { status });
  });
}
