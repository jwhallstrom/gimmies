# Clear IndividualRound and CompletedRound data from the active Amplify backend.
# Profiles, events, and chat are preserved.

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
Write-Host "=== Gimmies Golf - Clear Cloud Rounds ===" -ForegroundColor Cyan
Write-Host "Active backend API id: $apiId" -ForegroundColor Gray
Write-Host "This will DELETE all IndividualRounds and CompletedRounds from cloud." -ForegroundColor Yellow
Write-Host "Events, Profiles, and ChatMessages will NOT be affected." -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne 'yes') {
        Write-Host "Operation cancelled." -ForegroundColor Red
        exit
    }
}

$targets = @(
    @{ Model = 'IndividualRound'; Label = 'individual round' },
    @{ Model = 'CompletedRound'; Label = 'completed round' }
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
Write-Host ""
