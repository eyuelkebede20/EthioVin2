# Run this from inside your project root (where package.json lives)

$ErrorActionPreference = "Stop"

$output = "ethiovin-review.zip"

# Patterns to exclude (folders and files)
$excludeDirs = @('node_modules', '.git', 'dist', 'build', '.next', 'coverage')
$excludeFiles = @('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '*.log')

# Remove previous archive
if (Test-Path $output) { Remove-Item $output }

# Collect files, filtering out excluded dirs, lockfiles, and any .env variant
$files = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $path = $_.FullName

    # Skip excluded directories
    $inExcludedDir = $false
    foreach ($dir in $excludeDirs) {
        if ($path -match "\\$dir\\") { $inExcludedDir = $true; break }
    }

    # Skip lockfiles / logs
    $isExcludedFile = $false
    foreach ($pattern in $excludeFiles) {
        if ($_.Name -like $pattern) { $isExcludedFile = $true; break }
    }

    # Skip any .env file (.env, .env.local, etc.)
    $isEnv = $_.Name -like ".env*"

    -not ($inExcludedDir -or $isExcludedFile -or $isEnv)
}

# Create the zip
Compress-Archive -Path $files.FullName -DestinationPath $output

Write-Host "Created $output"
Write-Host "Files included:"
$files | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\', '') }