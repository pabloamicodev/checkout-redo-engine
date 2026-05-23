# Migration: Add request param to getShopId() calls in all API route files
# Run from repo root: pwsh scripts/migrate-getShopId.ps1

$apiDir = "c:\Users\pol\Desktop\checkout-redo-engine\apps\admin\src\app\api"

$files = Get-ChildItem -Recurse -LiteralPath $apiDir -Filter "route.ts" |
    Where-Object { Select-String -LiteralPath $_.FullName -Pattern "getShopId\(\)" -Quiet }

$changed = 0
foreach ($file in $files) {
    $content = Get-Content -LiteralPath $file.FullName -Raw

    # Replace _req: NextRequest with request: NextRequest in function signatures
    # (only for functions that call getShopId)
    $newContent = $content -replace '(?m)^\s+_req: NextRequest,', '  request: NextRequest,'
    # Also handle single-arg _req
    $newContent = $newContent -replace '\((_req): NextRequest\)', '(request: NextRequest)'
    $newContent = $newContent -replace '\((_req): NextRequest,', '(request: NextRequest,'

    # Replace getShopId() with getShopId(request)
    $newContent = $newContent -replace 'await getShopId\(\)', 'await getShopId(request)'

    # Remove local getShopId() function definitions (some files have inline copies)
    # Pattern: async function getShopId(): Promise<string | null> { ... }
    $newContent = $newContent -replace '(?ms)^async function getShopId\(\): Promise<string \| null> \{.*?^\}\r?\n', ''

    if ($newContent -ne $content) {
        Set-Content -LiteralPath $file.FullName -Value $newContent -Encoding utf8
        $rel = $file.FullName.Replace("$apiDir\", "")
        Write-Host "✅ $rel"
        $changed++
    }
}

Write-Host ""
Write-Host "Done. $changed files updated."
