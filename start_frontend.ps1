$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root 'frontend'
$viteCommand = Join-Path $frontend 'node_modules\.bin\vite.cmd'

Push-Location $frontend
try {
    # Checking for Vite itself is safer than checking only node_modules: a failed
    # partial npm install can leave that directory present but unusable.
    if (-not (Test-Path $viteCommand)) {
        Write-Host 'Installing frontend dependencies...' -ForegroundColor Cyan
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw 'npm install failed. Check Node.js 20+, npm registry access and package.json.'
        }
        if (-not (Test-Path $viteCommand)) {
            throw 'Vite was not installed. Delete frontend/node_modules and run npm install again.'
        }
    }

    Write-Host 'SettleGraph Workbench: http://127.0.0.1:5173' -ForegroundColor Green
    npm run dev
    if ($LASTEXITCODE -ne 0) {
        throw 'Vite dev server exited with an error.'
    }
}
finally { Pop-Location }
