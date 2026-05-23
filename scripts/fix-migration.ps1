# Fix remaining migration issues:
# 1. Files missing `import { getShopId }` (had local function removed)
# 2. Files where handler param is `req` instead of `request` — rename it

$apiDir = "c:\Users\pol\Desktop\checkout-redo-engine\apps\admin\src\app\api"

$files = Get-ChildItem -Recurse -LiteralPath $apiDir -Filter "route.ts"

$changed = 0
foreach ($file in $files) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    if (-not $content) { continue }

    $newContent = $content

    # Fix 1: If file calls getShopId(request) or getShopId() but doesn't import it
    $hasCall = $newContent -match "getShopId\("
    $hasImport = $newContent -match 'import.*getShopId.*from'
    if ($hasCall -and -not $hasImport) {
        # Add import after last existing import line
        $newContent = $newContent -replace '(?m)(^import [^\n]+\n)(?!import )', "`$1import { getShopId } from `"@/lib/api-shop`";`n"
    }

    # Fix 2: Rename req: NextRequest → request: NextRequest in handler signatures
    # Handle: `req: NextRequest,\n  {` pattern (two-arg handlers)
    $newContent = $newContent -replace '(?m)^  req: NextRequest,(\r?\n  \{)', '  request: NextRequest,$1'
    # Handle: `(req: NextRequest,` pattern on same line
    $newContent = $newContent -replace '\(req: NextRequest,', '(request: NextRequest,'
    # Handle: `(req: NextRequest)` single arg
    $newContent = $newContent -replace '\(req: NextRequest\)', '(request: NextRequest)'
    # Handle: `_request: NextRequest` → `request: NextRequest`
    $newContent = $newContent -replace '(?m)^  _request: NextRequest,(\r?\n  \{)', '  request: NextRequest,$1'
    $newContent = $newContent -replace '\(_request: NextRequest,', '(request: NextRequest,'
    $newContent = $newContent -replace '\(_request: NextRequest\)', '(request: NextRequest)'

    # Fix any getShopId(req) calls that still reference `req`
    # (shouldn't exist after above renames, but be safe)

    if ($newContent -ne $content) {
        Set-Content -LiteralPath $file.FullName -Value $newContent -Encoding utf8
        $rel = $file.FullName.Replace("$apiDir\", "")
        Write-Host "✅ Fixed: $rel"
        $changed++
    }
}

Write-Host "`nDone. $changed files fixed."
