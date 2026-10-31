$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$venvDir = Join-Path $backend '.venv'
$venvPython = Join-Path $venvDir 'Scripts\python.exe'

if (-not (Test-Path $venvPython)) {
    Write-Host 'Creating Python virtual environment...' -ForegroundColor Cyan
    if (Get-Command py -ErrorAction SilentlyContinue) {
        py -3 -m venv $venvDir
    } else {
        python -m venv $venvDir
    }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvPython)) {
        throw 'Could not create backend/.venv. Install Python 3.11+ and retry.'
    }
}

Write-Host 'Installing/verifying backend dependencies...' -ForegroundColor Cyan
& $venvPython -m pip install -r (Join-Path $backend 'requirements.txt')
if ($LASTEXITCODE -ne 0) {
    throw 'Backend dependency installation failed. Check network access and backend/requirements.txt.'
}

Push-Location $backend
try {
    Write-Host 'SettleGraph API: http://127.0.0.1:8000' -ForegroundColor Green
    Write-Host 'OpenAPI docs:     http://127.0.0.1:8000/docs' -ForegroundColor Green
    & $venvPython -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
    if ($LASTEXITCODE -ne 0) {
        throw 'Uvicorn exited with an error.'
    }
}
finally { Pop-Location }
