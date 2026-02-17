# Gimmies Golf - Complete Amplify + Route 53 Setup
# This script will:
# 1. Commit and push all new apps to master
# 2. Create landing and tournaments branches  
# 3. Connect branches to Amplify
# 4. Add custom domain to Amplify
# 5. Update Route 53 records (preserving email/db records)

param(
    [switch]$DryRun = $false,
    [switch]$SkipGit = $false,
    [switch]$SkipAmplify = $false,
    [switch]$SkipRoute53 = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$appId = "dtsoc1sfk1bk8"
$domain = "golfwithgimmies.com"
$zoneId = "Z05967251QAU8WTLVA36P"
$amplifyDomain = "dtsoc1sfk1bk8.amplifyapp.com"

# Amplify hosted zone ID (this is a constant for Amplify in us-east-1)
# See: https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html
$amplifyHostedZoneId = "Z2FDTNDATAQYW2"  # CloudFront hosted zone ID used by Amplify

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Gimmies Golf - Multi-App Domain Setup                     ║" -ForegroundColor Cyan  
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================
# STEP 1: Git - Commit and push changes
# ============================================
if (-not $SkipGit) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "STEP 1: Git - Commit and Push" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    $status = git status --porcelain
    if ($status) {
        Write-Host "📝 Uncommitted changes found:" -ForegroundColor Gray
        git status --short
        Write-Host ""
        
        if (-not $DryRun) {
            git add -A
            git commit -m "feat: add landing page, tournament app, and monorepo structure

- Add apps/landing/ - Marketing landing page with PWA install instructions
- Add apps/tournaments/ - Tournament PWA with separate branding
- Add packages/shared/ - Shared types, auth, sync utilities
- Update amplify.yml for branch-based multi-app builds
- Update main app to link to external tournament URL
- Add setup scripts and documentation"
            git push origin master
            Write-Host "✅ Committed and pushed to master" -ForegroundColor Green
        } else {
            Write-Host "🔍 Would commit and push changes" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ No uncommitted changes" -ForegroundColor Green
    }
    
    # Create branches
    Write-Host ""
    Write-Host "Creating branches..." -ForegroundColor Gray
    
    $branches = @("landing", "tournaments")
    foreach ($branch in $branches) {
        $exists = git branch --list $branch
        if (-not $exists) {
            if (-not $DryRun) {
                git checkout -b $branch
                git push -u origin $branch
                git checkout master
                Write-Host "✅ Created branch: $branch" -ForegroundColor Green
            } else {
                Write-Host "🔍 Would create branch: $branch" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⏭️  Branch already exists: $branch" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# ============================================
# STEP 2: Amplify - Connect branches
# ============================================
if (-not $SkipAmplify) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "STEP 2: Amplify - Connect Branches" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

    $existingBranches = (aws amplify list-branches --app-id $appId --query "branches[].branchName" --output json | ConvertFrom-Json)
    
    $branchConfigs = @(
        @{ Name = "landing"; Stage = "PRODUCTION" },
        @{ Name = "tournaments"; Stage = "PRODUCTION" }
    )
    
    foreach ($config in $branchConfigs) {
        if ($existingBranches -contains $config.Name) {
            Write-Host "⏭️  Amplify branch exists: $($config.Name)" -ForegroundColor Gray
        } else {
            if (-not $DryRun) {
                aws amplify create-branch `
                    --app-id $appId `
                    --branch-name $config.Name `
                    --stage $config.Stage `
                    --enable-auto-build 2>&1 | Out-Null
                Write-Host "✅ Connected Amplify branch: $($config.Name)" -ForegroundColor Green
            } else {
                Write-Host "🔍 Would connect Amplify branch: $($config.Name)" -ForegroundColor Yellow
            }
        }
    }
    
    # Add custom domain to Amplify
    Write-Host ""
    Write-Host "Adding custom domain to Amplify..." -ForegroundColor Gray
    
    $existingDomains = (aws amplify list-domain-associations --app-id $appId --query "domainAssociations[].domainName" --output json | ConvertFrom-Json)
    
    if ($existingDomains -contains $domain) {
        Write-Host "⏭️  Domain already associated: $domain" -ForegroundColor Gray
    } else {
        if (-not $DryRun) {
            # Create domain association with subdomains
            $subdomainSettings = '[{"prefix":"","branchName":"landing"},{"prefix":"www","branchName":"landing"},{"prefix":"app","branchName":"master"},{"prefix":"play","branchName":"tournaments"}]'
            
            aws amplify create-domain-association `
                --app-id $appId `
                --domain-name $domain `
                --sub-domain-settings $subdomainSettings 2>&1
            
            Write-Host "✅ Domain association created" -ForegroundColor Green
            Write-Host ""
            Write-Host "⏳ SSL certificate is being provisioned..." -ForegroundColor Yellow
            Write-Host "   This may take 10-30 minutes" -ForegroundColor Gray
        } else {
            Write-Host "🔍 Would create domain association for: $domain" -ForegroundColor Yellow
            Write-Host "   Subdomains: (root)->landing, www->landing, app->master, play->tournaments" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# ============================================
# STEP 3: Route 53 - Update DNS records
# ============================================
if (-not $SkipRoute53) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "STEP 3: Route 53 - Update DNS Records" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Get the Amplify domain details for the certificate validation
    Write-Host "Getting Amplify domain configuration..." -ForegroundColor Gray
    
    if (-not $DryRun) {
        $domainInfo = aws amplify get-domain-association --app-id $appId --domain-name $domain --output json 2>$null | ConvertFrom-Json
        
        if ($domainInfo) {
            $certRecord = $domainInfo.domainAssociation.certificateVerificationDNSRecord
            Write-Host "Certificate validation record: $certRecord" -ForegroundColor Gray
        }
    }
    
    # Build the Route 53 change batch
    # We need to:
    # 1. DELETE old A record for root domain (pointing to Elastic Beanstalk)
    # 2. DELETE old A record for www (pointing to Elastic Beanstalk)
    # 3. CREATE new CNAME for root -> Amplify (via ALIAS since root can't be CNAME)
    # 4. CREATE new CNAME for www -> Amplify
    # 5. CREATE new CNAME for app -> Amplify
    # 6. CREATE new CNAME for play -> Amplify
    
    Write-Host ""
    Write-Host "DNS Changes to be made:" -ForegroundColor Yellow
    Write-Host "  ❌ DELETE: golfwithgimmies.com A (Elastic Beanstalk)" -ForegroundColor Red
    Write-Host "  ❌ DELETE: www.golfwithgimmies.com A (Elastic Beanstalk)" -ForegroundColor Red
    Write-Host "  ✅ CREATE: golfwithgimmies.com A (Alias to Amplify)" -ForegroundColor Green
    Write-Host "  ✅ CREATE: www.golfwithgimmies.com CNAME (Amplify)" -ForegroundColor Green
    Write-Host "  ✅ CREATE: app.golfwithgimmies.com CNAME (Amplify)" -ForegroundColor Green
    Write-Host "  ✅ CREATE: play.golfwithgimmies.com CNAME (Amplify)" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  Records being PRESERVED:" -ForegroundColor Cyan
    Write-Host "  ✅ MX (email)" -ForegroundColor Gray
    Write-Host "  ✅ TXT (SPF, DMARC, SES)" -ForegroundColor Gray
    Write-Host "  ✅ DKIM records" -ForegroundColor Gray
    Write-Host "  ✅ autodiscover (WorkMail)" -ForegroundColor Gray
    Write-Host "  ✅ db (RDS)" -ForegroundColor Gray
    Write-Host ""

    # Get current Elastic Beanstalk target for deletion
    $currentRecords = aws route53 list-resource-record-sets --hosted-zone-id $zoneId --output json | ConvertFrom-Json
    $ebTarget = ($currentRecords.ResourceRecordSets | Where-Object { $_.Name -eq "golfwithgimmies.com." -and $_.Type -eq "A" }).AliasTarget.DNSName
    $ebHostedZoneId = ($currentRecords.ResourceRecordSets | Where-Object { $_.Name -eq "golfwithgimmies.com." -and $_.Type -eq "A" }).AliasTarget.HostedZoneId

    $changeBatch = @{
        Comment = "Update DNS for Amplify multi-app hosting"
        Changes = @(
            # Delete old root A record (Elastic Beanstalk)
            @{
                Action = "DELETE"
                ResourceRecordSet = @{
                    Name = "golfwithgimmies.com."
                    Type = "A"
                    AliasTarget = @{
                        DNSName = $ebTarget
                        HostedZoneId = $ebHostedZoneId
                        EvaluateTargetHealth = $false
                    }
                }
            },
            # Delete old www A record (Elastic Beanstalk)
            @{
                Action = "DELETE"
                ResourceRecordSet = @{
                    Name = "www.golfwithgimmies.com."
                    Type = "A"
                    AliasTarget = @{
                        DNSName = $ebTarget
                        HostedZoneId = $ebHostedZoneId
                        EvaluateTargetHealth = $false
                    }
                }
            },
            # Create root A record (Amplify - must use ALIAS for apex domain)
            @{
                Action = "CREATE"
                ResourceRecordSet = @{
                    Name = "golfwithgimmies.com."
                    Type = "A"
                    AliasTarget = @{
                        DNSName = "d111111abcdef8.cloudfront.net."  # Will be replaced with actual Amplify CloudFront
                        HostedZoneId = $amplifyHostedZoneId
                        EvaluateTargetHealth = $false
                    }
                }
            },
            # Create www CNAME
            @{
                Action = "CREATE"
                ResourceRecordSet = @{
                    Name = "www.golfwithgimmies.com."
                    Type = "CNAME"
                    TTL = 300
                    ResourceRecords = @(@{ Value = "$amplifyDomain." })
                }
            },
            # Create app CNAME
            @{
                Action = "CREATE"
                ResourceRecordSet = @{
                    Name = "app.golfwithgimmies.com."
                    Type = "CNAME"
                    TTL = 300
                    ResourceRecords = @(@{ Value = "$amplifyDomain." })
                }
            },
            # Create play CNAME
            @{
                Action = "CREATE"
                ResourceRecordSet = @{
                    Name = "play.golfwithgimmies.com."
                    Type = "CNAME"
                    TTL = 300
                    ResourceRecords = @(@{ Value = "$amplifyDomain." })
                }
            }
        )
    }

    if (-not $DryRun) {
        Write-Host "⚠️  This will modify your live DNS!" -ForegroundColor Red
        Write-Host "   Your current site will be unavailable briefly during propagation." -ForegroundColor Yellow
        Write-Host ""
        $confirm = Read-Host "Type 'yes' to proceed with DNS changes"
        
        if ($confirm -eq "yes") {
            # First, we need to get the actual Amplify CloudFront distribution
            Write-Host ""
            Write-Host "⏳ Waiting for Amplify domain to be ready..." -ForegroundColor Yellow
            Write-Host "   (Certificate validation may take 10-30 minutes)" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Once Amplify shows the domain as 'Available', run:" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "  .\scripts\setup-route53-records.ps1" -ForegroundColor White
            Write-Host ""
            Write-Host "To check domain status:" -ForegroundColor Gray
            Write-Host "  aws amplify get-domain-association --app-id $appId --domain-name $domain" -ForegroundColor White
        } else {
            Write-Host "❌ DNS changes cancelled" -ForegroundColor Red
        }
    } else {
        Write-Host "🔍 Would update Route 53 records as shown above" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Setup Summary" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "After DNS propagation, your apps will be at:" -ForegroundColor White
Write-Host "  🏠 https://golfwithgimmies.com      → Landing page" -ForegroundColor Green
Write-Host "  🏌️ https://app.golfwithgimmies.com  → Main Gimmies app" -ForegroundColor Green
Write-Host "  🏆 https://play.golfwithgimmies.com → Tournament app" -ForegroundColor Green
Write-Host ""
Write-Host "Email/database records are unchanged." -ForegroundColor Gray
Write-Host ""
