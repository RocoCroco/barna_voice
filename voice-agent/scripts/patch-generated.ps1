param(
    [Parameter(Mandatory = $true)]
    [string]$BuildDirectory
)

$ErrorActionPreference = 'Stop'

$agentDirectory = Split-Path -Parent $PSScriptRoot
$uv = Join-Path (Split-Path -Parent $agentDirectory) '.tools\uv\uv.exe'
& $uv run --no-project --python 3.12 python `
    (Join-Path $PSScriptRoot 'patch_generated.py') $BuildDirectory
if ($LASTEXITCODE -ne 0) {
    throw 'Could not apply the Compass runtime adapters.'
}
