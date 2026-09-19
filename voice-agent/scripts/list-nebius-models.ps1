. (Join-Path $PSScriptRoot 'common.ps1')

Import-CompassEnvironment

$headers = @{
    Authorization = "Bearer $env:NEBIUS_API_KEY"
}

$response = Invoke-RestMethod `
    -Uri 'https://api.tokenfactory.nebius.com/v1/models?verbose=true' `
    -Headers $headers `
    -Method Get

$response.data |
    Sort-Object id |
    Select-Object id, owned_by
