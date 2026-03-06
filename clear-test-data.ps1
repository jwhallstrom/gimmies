# Clear all test data from the active Amplify backend while preserving profiles.
# Resolves the active backend from amplify_outputs.json so it stays correct after redeploys.

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Get-ActiveApiId {
    $outputsPath = Join-Path $PSScriptRoot 'amplify_outputs.json'
    if (-not (Test-Path $outputsPath)) {
        throw "amplify_outputs.json not found at $outputsPath"
    }

    $outputs = Get-Content $outputsPath -Raw | ConvertFrom-Json
    $graphqlUrl = [string]$outputs.data.url
    if (-not $graphqlUrl) {
        throw 'Could not read data.url from amplify_outputs.json'
    }

    $apisJson = (aws appsync list-graphql-apis --region us-east-1 --output json) | Out-String
    $apis = (ConvertFrom-Json $apisJson).graphqlApis
    $matchingApi = $apis | Where-Object { $_.uris.GRAPHQL -eq $graphqlUrl } | Select-Object -First 1

    if ($matchingApi) {
        return [string]$matchingApi.apiId
    }

    throw "Could not resolve AppSync API id from URL: $graphqlUrl"
}

function Get-TableName([string]$modelName, [string]$apiId) {
    return "$modelName-$apiId-NONE"
}

function Get-Items([string]$tableName) {
    $response = (aws dynamodb scan --table-name $tableName --projection-expression "id" --output json) | Out-String
    return (ConvertFrom-Json $response).Items
}

function Remove-Items([string]$tableName, [object[]]$items, [string]$label) {
    $count = @($items).Count
    Write-Host "Deleting $label from $tableName..." -ForegroundColor Yellow

    foreach ($item in @($items)) {
        $id = $item.id.S
        Write-Host "  Deleting ${label}: $id" -ForegroundColor DarkGray
        $keyJson = @{ id = @{ S = $id } } | ConvertTo-Json -Compress
        $tmpKeyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("gimmies-ddb-key-" + [System.Guid]::NewGuid().ToString() + ".json")
        try {
            Set-Content -Path $tmpKeyPath -Value $keyJson -Encoding ascii
            aws dynamodb delete-item --table-name $tableName --key ("file://" + $tmpKeyPath) | Out-Null
        } finally {
            if (Test-Path $tmpKeyPath) {
                Remove-Item $tmpKeyPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    Write-Host "Deleted $count $label record(s)." -ForegroundColor Green
    return $count
}

$apiId = Get-ActiveApiId

Write-Host ""
Write-Host "=== Gimmies Golf - Clear Test Data ===" -ForegroundColor Cyan
Write-Host "Active backend API id: $apiId" -ForegroundColor Gray
Write-Host "This will DELETE Events, ChatMessages, CompletedRounds, and IndividualRounds." -ForegroundColor Yellow
Write-Host "Profiles will be preserved." -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne 'yes') {
        Write-Host "Operation cancelled." -ForegroundColor Red
        exit
    }
}

$targets = @(
    @{ Model = 'Event'; Label = 'event' },
    @{ Model = 'ChatMessage'; Label = 'chat message' },
    @{ Model = 'CompletedRound'; Label = 'completed round' },
    @{ Model = 'IndividualRound'; Label = 'individual round' }
)

$summary = @()

foreach ($target in $targets) {
    $tableName = Get-TableName $target.Model $apiId
    $items = Get-Items $tableName
    $deleted = Remove-Items $tableName $items $target.Label
    $summary += [PSCustomObject]@{
        Table = $tableName
        Deleted = $deleted
    }
    Write-Host ""
}

Write-Host "=== Summary ===" -ForegroundColor Cyan
$summary | ForEach-Object {
    Write-Host "$($_.Table): deleted $($_.Deleted)" -ForegroundColor Green
}
Write-Host "Profiles preserved." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Refresh the app or clear browser storage if stale local data remains." -ForegroundColor White
Write-Host "  2. Create a new event/group and verify sync against the clean backend." -ForegroundColor White
Write-Host ""
