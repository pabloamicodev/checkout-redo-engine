/**
 * Migration script: Replace getShopId() with withShopAuth() in all API route files.
 *
 * Run with: node scripts/migrate-to-withShopAuth.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const API_DIR = new URL(
  "../apps/admin/src/app/api",
  import.meta.url
).pathname.replace(/^\/([A-Z]:)/, "$1"); // fix Windows paths

let filesChanged = 0;
let filesSkipped = 0;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith("route.ts")) files.push(full);
  }
  return files;
}

function migrate(filePath) {
  const original = readFileSync(filePath, "utf-8");

  // Skip files that don't use getShopId at all
  if (!original.includes("getShopId")) {
    filesSkipped++;
    return;
  }

  let src = original;

  // ---------------------------------------------------------------
  // 1. Remove local getShopId() function definition (some files have it inline)
  //    Pattern: async function getShopId(): Promise<string | null> { ... }
  // ---------------------------------------------------------------
  src = src.replace(
    /async function getShopId\(\): Promise<string \| null> \{[\s\S]*?^}\n/m,
    ""
  );

  // ---------------------------------------------------------------
  // 2. Replace import of getShopId from api-shop
  //    Could be: import { getShopId } from "@/lib/api-shop";
  //    Or: import { getShopId, ... } from "@/lib/api-shop";
  // ---------------------------------------------------------------
  // Check if withShopAuth is already imported
  const hasWithShopAuth = src.includes('withShopAuth');

  // Remove getShopId from api-shop import
  src = src.replace(/import \{ getShopId \} from "@\/lib\/api-shop";\n/, "");
  src = src.replace(/import \{ getShopId, ([^}]+) \} from "@\/lib\/api-shop";\n/,
    'import { $1 } from "@/lib/api-shop";\n');
  src = src.replace(/import \{ ([^}]+), getShopId \} from "@\/lib\/api-shop";\n/,
    'import { $1 } from "@/lib/api-shop";\n');

  // Add withShopAuth import if not already there
  if (!hasWithShopAuth && (original.includes("getShopId") || src !== original)) {
    // Insert after last import line
    const importInsertPattern = /(import [^;]+;\n)(?!import )/;
    if (!src.includes('from "@/lib/api-middleware"')) {
      // Add after the last import statement
      const lastImportMatch = [...src.matchAll(/^import .+;\n/gm)];
      if (lastImportMatch.length > 0) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        src = src.slice(0, insertPos) +
          'import { withShopAuth } from "@/lib/api-middleware";\n' +
          src.slice(insertPos);
      } else {
        src = 'import { withShopAuth } from "@/lib/api-middleware";\n' + src;
      }
    } else if (!src.includes("withShopAuth")) {
      // api-middleware already imported, add withShopAuth to it
      src = src.replace(
        /import \{ ([^}]+) \} from "@\/lib\/api-middleware";/,
        'import { $1, withShopAuth } from "@/lib/api-middleware";'
      );
    }
  }

  // ---------------------------------------------------------------
  // 3. Replace handler bodies:
  //    Each export async function FOO(req, [params]) {
  //      const shopId = await getShopId();
  //      if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  //      [const { id } = await params;]   ← this moves inside the wrapper
  //      [rest of body]
  //    }
  //
  //    Strategy: find the two-line getShopId block and wrap the rest of function body.
  //    We use a regex that captures function signature + shopId block + rest of body.
  // ---------------------------------------------------------------

  // Pattern A: single-arg handler (request only)
  // export async function METHOD(request: NextRequest) {\n  const shopId = await getShopId();\n  if (!shopId)...;\n
  src = src.replace(
    /(export async function \w+)\((\w+): NextRequest\) \{\n  const shopId = await getShopId\(\);\n  if \(!shopId\) return NextResponse\.json\(\{ error: "Shop not found" \}, \{ status: 404 \}\);\n\n?/g,
    (match, funcDecl, reqParam) => {
      const reqName = reqParam === "_req" ? "request" : reqParam;
      return `${funcDecl}(${reqName}: NextRequest) {\n  return withShopAuth(${reqName}, async (shopId) => {\n`;
    }
  );

  // Pattern B: two-arg handler (request + params), first param may be _req or req
  // export async function METHOD(\n  _req: NextRequest,\n  { params }...
  src = src.replace(
    /(export async function \w+)\(\n  (\w+): NextRequest,\n  (\{ params \}: \{ params: Promise<\{ id: string \}> \})\n\) \{\n  const shopId = await getShopId\(\);\n  if \(!shopId\) return NextResponse\.json\(\{ error: "Shop not found" \}, \{ status: 404 \}\);\n\n?/g,
    (match, funcDecl, reqParam, paramsDecl) => {
      return `${funcDecl}(\n  request: NextRequest,\n  ${paramsDecl}\n) {\n  return withShopAuth(request, async (shopId) => {\n`;
    }
  );

  // ---------------------------------------------------------------
  // 4. Close the withShopAuth wrapper before each closing brace of a migrated function.
  //    We need to add `  });` before the final `}` of migrated functions.
  //
  //    After step 3, the file looks like:
  //      export async function FOO(request: NextRequest) {
  //        return withShopAuth(request, async (shopId) => {
  //          [body]
  //        });   ← THIS IS MISSING
  //      }
  //
  //    Strategy: count migrated functions and close each one.
  //    We look for functions that have `return withShopAuth` and add the closing.
  // ---------------------------------------------------------------

  // This is the tricky part. We need to find each function that now has
  // `return withShopAuth(...)` and add `  });` before the function's closing `}`.
  //
  // Approach: scan the source char by char, tracking brace depth.
  // When we're inside a withShopAuth wrapper that hasn't been closed yet,
  // close it at the right place.

  src = addWithShopAuthClosings(src);

  if (src === original) {
    filesSkipped++;
    return;
  }

  writeFileSync(filePath, src, "utf-8");
  filesChanged++;
  console.log(`✅ Migrated: ${filePath.split("app\\api\\")[1] ?? filePath}`);
}

/**
 * Adds the `  });` closing for each `return withShopAuth(...)` block
 * before the enclosing export function's closing `}`.
 */
function addWithShopAuthClosings(src) {
  // Find all locations of `return withShopAuth(` and add `  });` at appropriate closing
  const marker = "return withShopAuth(";
  if (!src.includes(marker)) return src;

  // We'll rebuild the source by processing each function
  // Use regex to find export async functions and process them
  const result = src.replace(
    /(export async function \w+[\s\S]*?return withShopAuth\(\w+, async \(shopId(?:, actorId)?\) => \{)([\s\S]*?)(\n\})/g,
    (match, header, body, closing) => {
      // Check if body already has `  });` near the end (already migrated)
      const trimmedBody = body.trimEnd();
      if (trimmedBody.endsWith("  });")) {
        return match; // Already has closing
      }
      return `${header}${body}\n  });${closing}`;
    }
  );

  return result;
}

// Run
const allFiles = walk(API_DIR);
console.log(`Found ${allFiles.length} route.ts files. Migrating...`);

for (const f of allFiles) {
  try {
    migrate(f);
  } catch (err) {
    console.error(`❌ Error processing ${f}:`, err.message);
  }
}

console.log(`\nDone. Changed: ${filesChanged}, Skipped: ${filesSkipped}`);
