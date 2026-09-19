param(
    [Parameter(Mandatory = $true)]
    [string]$BuildDirectory
)

$ErrorActionPreference = 'Stop'

$agentDirectory = Split-Path -Parent $PSScriptRoot
$adapterSource = Join-Path $agentDirectory 'runtime\slng_stt_batched.py'
$adapterTarget = Join-Path $BuildDirectory 'slng_stt_batched.py'
$botFile = Join-Path $BuildDirectory 'bot.py'

if (-not (Test-Path -LiteralPath $adapterSource)) {
    throw "Missing SLNG batching adapter at $adapterSource."
}
if (-not (Test-Path -LiteralPath $botFile)) {
    throw "Missing generated Pipecat bot at $botFile."
}

Copy-Item -LiteralPath $adapterSource -Destination $adapterTarget -Force

$source = [System.IO.File]::ReadAllText($botFile)
$patched = $source.Replace(
    'from pipecat_slng import SlngSTTService',
    'from slng_stt_batched import BatchedSlngSTTService'
).Replace(
    'return SlngSTTService(',
    'return BatchedSlngSTTService('
)

if ($patched -eq $source) {
    throw 'The generated Pipecat source did not contain the expected SLNG STT bindings.'
}

[System.IO.File]::WriteAllText($botFile, $patched, [System.Text.UTF8Encoding]::new($false))
