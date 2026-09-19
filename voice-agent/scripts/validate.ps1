. (Join-Path $PSScriptRoot 'common.ps1')

$unmute = Join-Path $script:RepositoryRoot '.tools\unmute\unmute.exe'
if (-not (Test-Path -LiteralPath $unmute)) {
    throw "The repository-local Unmute executable was not found at $unmute."
}

& $unmute validate $script:AgentDirectory
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $unmute compile $script:AgentDirectory --target pipecat
exit $LASTEXITCODE
