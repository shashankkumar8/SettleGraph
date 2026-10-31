$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvPython = Join-Path $backend '.venv\Scripts\python.exe'

if (Test-Path $venvPython) {
    $python = $venvPython
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $python = 'py'
} else {
    $python = 'python'
}

Write-Host '=== Backend compile check ===' -ForegroundColor Cyan
Push-Location $backend
try {
    if ($python -eq 'py') { py -3 -m compileall -q . } else { & $python -m compileall -q . }
    if ($LASTEXITCODE -ne 0) { throw 'Python compile check failed.' }

    Write-Host '=== Backend regression suite ===' -ForegroundColor Cyan
    if ($python -eq 'py') { py -3 -m pytest -q } else { & $python -m pytest -q }
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
}
finally { Pop-Location }

$viteCommand = Join-Path $frontend 'node_modules\.bin\vite.cmd'
if (Test-Path $viteCommand) {
    Write-Host '=== Frontend type-check and production build ===' -ForegroundColor Cyan
    Push-Location $frontend
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    }
    finally { Pop-Location }
} else {
    Write-Warning 'Frontend dependencies are not installed. Run .\start_frontend.ps1, then rerun this verification script.'
}

Write-Host 'Verification steps completed.' -ForegroundColor Green
