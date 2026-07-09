# Reset golf-history fields on all profiles in the active Amplify backend while preserving accounts.
# Keeps identity and preferences intact, but clears handicap/scoring/verification history.

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

function Get-ProfileItems([string]$tableName) {
    $response = (aws dynamodb scan --table-name $tableName --projection-expression "id" --output json) | Out-String
    return (ConvertFrom-Json $response).Items
}

function Reset-ProfileGolfHistory([string]$tableName, [object[]]$profiles) {
    $count = @($profiles).Count
    $zeroStats = @{
        roundsPlayed = 0
        averageScore = 0
        bestScore = 0
        totalBirdies = 0
        totalEagles = 0
    } | ConvertTo-Json -Compress

    Write-Host "Resetting golf history on $count profile(s) in $tableName..." -ForegroundColor Yellow

    foreach ($profile in @($profiles)) {
        $id = $profile.id.S
        Write-Host "  Resetting profile: $id" -ForegroundColor DarkGray

        $keyJson = @{ id = @{ S = $id } } | ConvertTo-Json -Compress
        $valueJson = @{
            ':stats' = @{ S = $zeroStats }
            ':lastActive' = @{ S = [DateTime]::UtcNow.ToString('o') }
        } | ConvertTo-Json -Compress

        $tmpKeyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("gimmies-ddb-key-" + [System.Guid]::NewGuid().ToString() + ".json")
        $tmpValuesPath = Join-Path ([System.IO.Path]::GetTempPath()) ("gimmies-ddb-values-" + [System.Guid]::NewGuid().ToString() + ".json")
        try {
            Set-Content -Path $tmpKeyPath -Value $keyJson -Encoding ascii
            Set-Content -Path $tmpValuesPath -Value $valueJson -Encoding ascii
            aws dynamodb update-item `
                --table-name $tableName `
                --key ("file://" + $tmpKeyPath) `
                --update-expression "SET statsJson = :stats, lastActive = :lastActive REMOVE handicapIndex, verifiedStatusJson" `
                --expression-attribute-values ("file://" + $tmpValuesPath) `
                | Out-Null
        } finally {
            if (Test-Path $tmpKeyPath) {
                Remove-Item $tmpKeyPath -Force -ErrorAction SilentlyContinue
            }
            if (Test-Path $tmpValuesPath) {
                Remove-Item $tmpValuesPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    Write-Host "Reset $count profile(s)." -ForegroundColor Green
    return $count
}

$apiId = Get-ActiveApiId
$tableName = Get-TableName 'Profile' $apiId

Write-Host ""
Write-Host "=== Gimmies Golf - Reset Profile Golf History ===" -ForegroundColor Cyan
Write-Host "Active backend API id: $apiId" -ForegroundColor Gray
Write-Host "This will KEEP profiles/accounts but clear golf-history fields:" -ForegroundColor Yellow
Write-Host "  - handicapIndex" -ForegroundColor White
Write-Host "  - statsJson (rounds/best/average/birdies/eagles)" -ForegroundColor White
Write-Host "  - verifiedStatusJson" -ForegroundColor White
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne 'yes') {
        Write-Host "Operation cancelled." -ForegroundColor Red
        exit
    }
}

$profiles = Get-ProfileItems $tableName
$resetCount = Reset-ProfileGolfHistory $tableName $profiles

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "${tableName}: reset $resetCount profile(s)" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Refresh the app or sign out/in so local cached profile state is replaced." -ForegroundColor White
Write-Host "  2. Verify handicap, average score, best score, and verified status now show empty/default values." -ForegroundColor White
Write-Host ""
