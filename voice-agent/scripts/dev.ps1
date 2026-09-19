. (Join-Path $PSScriptRoot 'common.ps1')

Import-CompassEnvironment
Set-CompassToolPath

$unmute = Join-Path $script:RepositoryRoot '.tools\unmute\unmute.exe'
if (-not (Test-Path -LiteralPath $unmute)) {
    throw "The repository-local Unmute executable was not found at $unmute."
}

$uv = Join-Path $script:RepositoryRoot '.tools\uv\uv.exe'
$buildDirectory = Join-Path $script:AgentDirectory 'build\pipecat'

& $unmute compile $script:AgentDirectory --target pipecat
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& (Join-Path $PSScriptRoot 'patch-generated.ps1') -BuildDirectory $buildDirectory

Push-Location $buildDirectory
try {
    & $uv sync --group dev --python 3.12
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host 'Compass voice client: http://localhost:7860/client/'
    Write-Host 'Keep SmallWebRTC selected and connect only while actively testing.'
    & '.\.venv\Scripts\python.exe' '.\bot.py' `
        --transport webrtc `
        --host localhost `
        --port 7860
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
