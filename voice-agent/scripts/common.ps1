$ErrorActionPreference = 'Stop'

$script:AgentDirectory = Split-Path -Parent $PSScriptRoot
$script:RepositoryRoot = Split-Path -Parent $script:AgentDirectory
$script:EnvironmentFile = Join-Path $script:AgentDirectory '.env'

function Import-CompassEnvironment {
    if (-not (Test-Path -LiteralPath $script:EnvironmentFile)) {
        throw "Missing $script:EnvironmentFile. Copy .env.example to .env and add the two API keys."
    }

    foreach ($line in Get-Content -LiteralPath $script:EnvironmentFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }

        $parts = $trimmed.Split('=', 2)
        if ($parts.Count -ne 2) {
            continue
        }

        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($name -in @('NEBIUS_API_KEY', 'NEBIUS_BASE_URL', 'SLNG_API_KEY')) {
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }

    foreach ($requiredName in @('NEBIUS_API_KEY', 'NEBIUS_BASE_URL', 'SLNG_API_KEY')) {
        $value = [Environment]::GetEnvironmentVariable($requiredName, 'Process')
        if ([string]::IsNullOrWhiteSpace($value)) {
            throw "$requiredName is empty in $script:EnvironmentFile."
        }
    }
}

function Set-CompassToolPath {
    $uvDirectory = Join-Path $script:RepositoryRoot '.tools\uv'
    $pythonDirectory = Join-Path $script:RepositoryRoot '.tools\python'
    $uvCacheDirectory = Join-Path $script:RepositoryRoot '.tools\uv-cache'

    if (-not (Test-Path -LiteralPath (Join-Path $uvDirectory 'uv.exe'))) {
        throw "The repository-local uv executable was not found at $uvDirectory."
    }

    $env:UV_PYTHON_INSTALL_DIR = $pythonDirectory
    $env:UV_CACHE_DIR = $uvCacheDirectory
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:Path = "$uvDirectory;$env:Path"
}
