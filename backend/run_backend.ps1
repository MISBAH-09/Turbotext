$ErrorActionPreference = "Stop"

# One-click starter for Windows PowerShell: creates venv, checks LanguageTool jar, runs uvicorn.

function Get-Python {
    if ($env:PYTHON_PATH) {
        if (Test-Path $env:PYTHON_PATH) {
            return $env:PYTHON_PATH
        }
        throw "PYTHON_PATH is set to '$env:PYTHON_PATH' but that file does not exist."
    }

    foreach ($cmd in @("py -3", "python3", "python")) {
        try {
            $resolved = (Get-Command $cmd.Split()[0] -ErrorAction Stop).Source
            return "$cmd"
        } catch {
            continue
        }
    }
    throw "Python not found. Install Python 3.x and ensure it is on PATH."
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ScriptDir ".venv"
$PythonCmd = Get-Python

# Prefer bundled LanguageTool unless overridden by env; fall back if env path is invalid.
$defaultLtPath = Join-Path $ScriptDir "data/LanguageTool-6.6"
if (-not $env:LANGUAGE_TOOL_PATH) {
    $env:LANGUAGE_TOOL_PATH = $defaultLtPath
}
$ltJar = Join-Path $env:LANGUAGE_TOOL_PATH "languagetool.jar"
if (-not (Test-Path $ltJar)) {
    $env:LANGUAGE_TOOL_PATH = $defaultLtPath
    $ltJar = Join-Path $env:LANGUAGE_TOOL_PATH "languagetool.jar"
}
if (-not (Test-Path $ltJar)) {
    throw "LanguageTool jar not found at '$ltJar'. Extract LanguageTool to that folder or set LANGUAGE_TOOL_PATH."
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Warning "Java runtime not found; install JDK/JRE so grammar checks work (java -version should succeed)."
}

if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating virtualenv in $VenvDir..."
    & $PythonCmd -m venv $VenvDir
    & "$VenvDir\Scripts\Activate.ps1"
    pip install --upgrade pip
    pip install -r (Join-Path $ScriptDir "requirements.txt")
} else {
    & "$VenvDir\Scripts\Activate.ps1"
}

$hostAddr = if ($env:HOST) { $env:HOST } else { "127.0.0.1" }
$port = if ($env:PORT) { $env:PORT } else { "8000" }
$reload = if ($env:RELOAD -eq "1") { "--reload" } else { "" }

Set-Location $ProjectRoot
& python -m uvicorn backend.app:app --host $hostAddr --port $port $reload
