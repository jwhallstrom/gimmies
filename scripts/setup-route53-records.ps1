# Route 53 DNS Update Script for Gimmies Golf
# Run this AFTER Amplify domain association is 'AVAILABLE'
# 
# Usage: .\setup-route53-records.ps1 [-DryRun]

param(
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

$appId = "dtsoc1sfk1bk8"
$domain = "golfwithgimmies.com"
$zoneId = "Z05967251QAU8WTLVA36P"

Write-Host ""
Write-Host "Route 53 DNS Update for Gimmies Golf" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Check Amplify domain status
Write-Host "Checking Amplify domain status..." -ForegroundColor Gray
$domainInfo = aws amplify get-domain-association --app-id $appId --domain-name $domain --output json 2>$null | ConvertFrom-Json

if (-not $domainInfo) {
    Write-Host "❌ Domain not found in Amplify. Run setup-complete.ps1 first." -ForegroundColor Red
    exit 1
}

$status = $domainInfo.domainAssociation.domainStatus
Write-Host "Domain status: $status" -ForegroundColor $(if ($status -eq "AVAILABLE") { "Green" } else { "Yellow" })

if ($status -ne "AVAILABLE" -and $status -ne "PENDING_DEPLOYMENT") {
    Write-Host ""
    Write-Host "⏳ Domain is not ready yet. Status: $status" -ForegroundColor Yellow
    Write-Host "   Wait for Amplify to complete certificate validation." -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Check status with:" -ForegroundColor Gray
    Write-Host "   aws amplify get-domain-association --app-id $appId --domain-name $domain" -ForegroundColor White
    
    # Show certificate validation record if pending
    if ($domainInfo.domainAssociation.certificateVerificationDNSRecord) {
        Write-Host ""
        Write-Host "📋 Certificate validation requires this DNS record:" -ForegroundColor Yellow
        Write-Host $domainInfo.domainAssociation.certificateVerificationDNSRecord -ForegroundColor White
    }
    exit 1
}

# Get the Amplify CloudFront distribution for this domain
$subDomains = $domainInfo.domainAssociation.subDomains
$cloudFrontDomain = ($subDomains | Where-Object { $_.subDomainSetting.prefix -eq "" }).dnsRecord

if (-not $cloudFrontDomain) {
    # Try getting from the app default domain
    $cloudFrontDomain = "dtsoc1sfk1bk8.amplifyapp.com"
}

Write-Host "Amplify target: $cloudFrontDomain" -ForegroundColor Gray
Write-Host ""

# Get current records
Write-Host "Fetching current DNS records..." -ForegroundColor Gray
$currentRecords = aws route53 list-resource-record-sets --hosted-zone-id $zoneId --output json | ConvertFrom-Json

# Find the old Elastic Beanstalk records
$rootRecord = $currentRecords.ResourceRecordSets | Where-Object { $_.Name -eq "golfwithgimmies.com." -and $_.Type -eq "A" }
$wwwRecord = $currentRecords.ResourceRecordSets | Where-Object { $_.Name -eq "www.golfwithgimmies.com." -and $_.Type -eq "A" }

Write-Host ""
Write-Host "Current A records:" -ForegroundColor Yellow
if ($rootRecord) {
    Write-Host "  golfwithgimmies.com -> $($rootRecord.AliasTarget.DNSName)" -ForegroundColor Gray
}
if ($wwwRecord) {
    Write-Host "  www.golfwithgimmies.com -> $($wwwRecord.AliasTarget.DNSName)" -ForegroundColor Gray
}

# Build change batch JSON
$changeBatchFile = "route53-changes.json"

$changes = @{
    Comment = "Update DNS for Amplify multi-app hosting - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    Changes = @()
}

# Delete old root A record if it exists and points to EB
if ($rootRecord -and $rootRecord.AliasTarget.DNSName -like "*elasticbeanstalk*") {
    $changes.Changes += @{
        Action = "DELETE"
        ResourceRecordSet = @{
            Name = "golfwithgimmies.com."
            Type = "A"
            AliasTarget = @{
                DNSName = $rootRecord.AliasTarget.DNSName
                HostedZoneId = $rootRecord.AliasTarget.HostedZoneId
                EvaluateTargetHealth = $false
            }
        }
    }
}

# Delete old www A record if it exists and points to EB
if ($wwwRecord -and $wwwRecord.AliasTarget.DNSName -like "*elasticbeanstalk*") {
    $changes.Changes += @{
        Action = "DELETE"
        ResourceRecordSet = @{
            Name = "www.golfwithgimmies.com."
            Type = "A"
            AliasTarget = @{
                DNSName = $wwwRecord.AliasTarget.DNSName
                HostedZoneId = $wwwRecord.AliasTarget.HostedZoneId
                EvaluateTargetHealth = $false
            }
        }
    }
}

# Create new CNAME records for all subdomains
$newRecords = @(
    @{ Name = "www.golfwithgimmies.com."; Prefix = "www" },
    @{ Name = "app.golfwithgimmies.com."; Prefix = "app" },
    @{ Name = "play.golfwithgimmies.com."; Prefix = "play" }
)

foreach ($rec in $newRecords) {
    $existing = $currentRecords.ResourceRecordSets | Where-Object { $_.Name -eq $rec.Name }
    
    if ($existing) {
        # Update existing record
        if ($existing.Type -eq "CNAME") {
            $changes.Changes += @{
                Action = "UPSERT"
                ResourceRecordSet = @{
                    Name = $rec.Name
                    Type = "CNAME"
                    TTL = 300
                    ResourceRecords = @(@{ Value = $cloudFrontDomain })
                }
            }
        } else {
            # Different type, need to delete and recreate
            Write-Host "⚠️  $($rec.Name) exists as $($existing.Type), will replace with CNAME" -ForegroundColor Yellow
        }
    } else {
        # Create new record
        $changes.Changes += @{
            Action = "CREATE"
            ResourceRecordSet = @{
                Name = $rec.Name
                Type = "CNAME"
                TTL = 300
                ResourceRecords = @(@{ Value = $cloudFrontDomain })
            }
        }
    }
}

# For root domain, we need an ALIAS record (CNAME not allowed at apex)
# Amplify provides a CloudFront distribution we can alias to
$changes.Changes += @{
    Action = "UPSERT"
    ResourceRecordSet = @{
        Name = "golfwithgimmies.com."
        Type = "A"
        AliasTarget = @{
            DNSName = $cloudFrontDomain
            HostedZoneId = "Z2FDTNDATAQYW2"  # CloudFront hosted zone ID
            EvaluateTargetHealth = $false
        }
    }
}

Write-Host ""
Write-Host "Planned DNS changes:" -ForegroundColor Yellow
foreach ($change in $changes.Changes) {
    $action = $change.Action
    $name = $change.ResourceRecordSet.Name
    $type = $change.ResourceRecordSet.Type
    $color = if ($action -eq "DELETE") { "Red" } else { "Green" }
    Write-Host "  $action $name ($type)" -ForegroundColor $color
}

Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN - No changes made" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To apply changes, run without -DryRun:" -ForegroundColor Gray
    Write-Host "  .\setup-route53-records.ps1" -ForegroundColor White
} else {
    Write-Host "⚠️  This will modify your live DNS!" -ForegroundColor Red
    $confirm = Read-Host "Type 'APPLY' to proceed"
    
    if ($confirm -eq "APPLY") {
        # Write JSON file
        $changes | ConvertTo-Json -Depth 10 | Out-File -FilePath $changeBatchFile -Encoding utf8
        
        # Apply changes
        Write-Host ""
        Write-Host "Applying DNS changes..." -ForegroundColor Yellow
        $result = aws route53 change-resource-record-sets --hosted-zone-id $zoneId --change-batch "file://$changeBatchFile" --output json | ConvertFrom-Json
        
        Write-Host "✅ DNS changes submitted!" -ForegroundColor Green
        Write-Host "   Change ID: $($result.ChangeInfo.Id)" -ForegroundColor Gray
        Write-Host "   Status: $($result.ChangeInfo.Status)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "DNS propagation typically takes 1-5 minutes." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Your apps will be available at:" -ForegroundColor Cyan
        Write-Host "  🏠 https://golfwithgimmies.com" -ForegroundColor White
        Write-Host "  🏌️ https://app.golfwithgimmies.com" -ForegroundColor White
        Write-Host "  🏆 https://play.golfwithgimmies.com" -ForegroundColor White
        
        # Cleanup
        Remove-Item $changeBatchFile -ErrorAction SilentlyContinue
    } else {
        Write-Host "❌ Cancelled" -ForegroundColor Red
    }
}
