param(
    [string]$Model = 'Qwen/Qwen3-30B-A3B-Instruct-2507'
)

. (Join-Path $PSScriptRoot 'common.ps1')

Import-CompassEnvironment

$headers = @{
    Authorization = "Bearer $env:NEBIUS_API_KEY"
    'Content-Type' = 'application/json'
}

$body = @{
    model = $Model
    messages = @(
        @{
            role = 'system'
            content = 'Reply in one short spoken sentence. You are Compass, a TV viewing companion.'
        },
        @{
            role = 'user'
            content = 'Say hello and ask what I feel like watching.'
        }
    )
    temperature = 0.3
} | ConvertTo-Json -Depth 8

$response = Invoke-RestMethod `
    -Uri 'https://api.tokenfactory.nebius.com/v1/chat/completions' `
    -Headers $headers `
    -Method Post `
    -Body $body

$response.choices[0].message.content
