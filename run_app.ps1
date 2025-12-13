<# One-command launcher for TurboText on Windows (PowerShell 5+).
   - Auto-loads config.env
   - Picks free ports near defaults
   - Ensures backend venv + deps, frontend deps
   - Starts backend, waits for health, then starts frontend
   Stop with Ctrl+C; backend job is cleaned up.
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Load config.env if present
$configPath = Join-Path $root "config.env"
if (Test-Path $configPath) {
  Get-Content $configPath | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $pair = $_ -split '=', 2
    if ($pair.Length -eq 2) { Set-Item -Path Env:$($pair[0]) -Value $pair[1] }
  }
}

function Get-FreePort([int]$start) {
  for ($p = $start; $p -lt $start + 50; $p++) {
    if (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue) { continue }
    $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Parse("127.0.0.1"), $p)
    try {
      $listener.Start()
      $listener.Stop()
      return $p
    } catch {
      $listener.Stop()
    }
  }
  return $start
}

# Pick ports (PowerShell 5 compatible, no ternary)
if ($env:API_PORT) {
  $apiPort = Get-FreePort([int]$env:API_PORT)
} else {
  $apiPort = Get-FreePort(8000)
}
if ($env:APP_PORT) {
$appPort = Get-FreePort([int]$env:APP_PORT)
} else {
  $appPort = Get-FreePort(3000)
}

# Ensure LanguageTool path points to the bundled copy if an invalid env var is set
$defaultLtPath = Join-Path $root "backend/data/LanguageTool-6.6"
$ltJar = Join-Path $defaultLtPath "languagetool.jar"
if (-not $env:LANGUAGE_TOOL_PATH -or -not (Test-Path (Join-Path $env:LANGUAGE_TOOL_PATH "languagetool.jar"))) {
  $env:LANGUAGE_TOOL_PATH = $defaultLtPath
}

Write-Host "API_PORT=$apiPort  APP_PORT=$appPort"

# Backend env passthroughs
$envPairs = @()
foreach ($name in "PROCESS_WORKERS","THREAD_WORKERS","CHUNK_SIZE","CHUNK_OVERLAP","LANGUAGE_TOOL_PATH","DICTIONARY_PATH","LANGUAGE","DISABLE_GRAMMAR","MAX_FILES","MAX_FILE_BYTES") {
  $val = (Get-Item -Path Env:$name -ErrorAction SilentlyContinue).Value
  if ($val) { $envPairs += "$name=$val" }
}

# Ensure backend venv + deps
$venv = Join-Path $root "backend/.venv"
if (-not (Test-Path (Join-Path $venv "Scripts/Activate.ps1"))) {
  Write-Host "Creating backend venv..."
  & python -m venv $venv
}
Write-Host "Installing backend deps..."
& "$venv/Scripts/pip.exe" install -r (Join-Path $root "backend/requirements.txt") | Out-Host

# Start backend as background job
Write-Host "Starting backend..."
$backendJob = Start-Job -ScriptBlock {
  param($rootPath,$port,$envPairs)
  $pwsh = $env:POWERSHELL
  if (-not $pwsh) { $pwsh = "powershell" }
  foreach ($pair in $envPairs) {
    $parts = $pair -split '=',2
    if ($parts.Length -eq 2) { Set-Item -Path Env:$($parts[0]) -Value $parts[1] }
  }
  $env:PORT = $port
  Set-Location (Join-Path $rootPath "backend")
  & $pwsh -NoProfile -ExecutionPolicy Bypass -File "run_backend.ps1"
} -ArgumentList $root,$apiPort,$envPairs

function Cleanup {
  if ($backendJob) {
    Write-Host "`nStopping backend (job $($backendJob.Id))..."
    Stop-Job $backendJob -ErrorAction SilentlyContinue | Out-Null
    Remove-Job $backendJob -ErrorAction SilentlyContinue | Out-Null
  }
}
Register-EngineEvent PowerShell.Exiting -Action { Cleanup } | Out-Null

# Wait for backend health
Write-Host "Waiting for backend health..."
$healthUrl = "http://127.0.0.1:$apiPort/health"
$ok = $false
for ($i=0; $i -lt 40; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 1
    if ($resp.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 500
}
if (-not $ok) {
  Write-Warning "Backend did not respond at $healthUrl"
  Cleanup
  exit 1
}

# Ensure frontend deps
Write-Host "Ensuring frontend deps..."
Set-Location (Join-Path $root "Turbo-Text-Frontend")
if (-not (Test-Path "node_modules")) {
  npm install | Out-Host
}

# Start frontend (foreground)
$env:REACT_APP_API_BASE_URL = "http://127.0.0.1:$apiPort"
$env:PORT = "$appPort"
Write-Host "Starting frontend at http://localhost:$appPort (API $env:REACT_APP_API_BASE_URL)..."
try {
  npm start
} finally {
  Cleanup
}
