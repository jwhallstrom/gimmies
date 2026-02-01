# Gimmies Golf - Multi-App Amplify Setup Script
# Run this script from the repo root after reviewing each section

$appId = "dtsoc1sfk1bk8"
$domain = "golfwithgimmies.com"

Write-Host "=== Gimmies Golf Multi-App Setup ===" -ForegroundColor Cyan
Write-Host ""

# ============================================
# STEP 1: Commit new apps to master first
# ============================================
Write-Host "STEP 1: Commit landing and tournament apps to master" -ForegroundColor Yellow
Write-Host "---------------------------------------------------"

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "Uncommitted changes found. Adding and committing..." -ForegroundColor Gray
    git add apps/
    git add packages/
    git add docs/DOMAIN_SETUP_GUIDE.md
    git add docs/MONOREPO_ARCHITECTURE.md
    git add monorepo-package.json
    git commit -m "feat: add tournament PWA and landing page scaffolding

- Add apps/tournaments/ with full Vite+React setup
- Add apps/landing/ with marketing page
- Add packages/shared/ with common types and utilities
- Update main app to link to external tournament app
- Add documentation for monorepo architecture"
    git push origin master
    Write-Host "Committed and pushed to master!" -ForegroundColor Green
} else {
    Write-Host "No uncommitted changes. Proceeding..." -ForegroundColor Green
}

Write-Host ""
Write-Host "Press Enter to continue to Step 2..." -ForegroundColor Gray
Read-Host

# ============================================
# STEP 2: Create landing branch
# ============================================
Write-Host "STEP 2: Create landing branch" -ForegroundColor Yellow
Write-Host "-----------------------------"

git checkout -b landing
git push -u origin landing
Write-Host "Created and pushed 'landing' branch" -ForegroundColor Green

git checkout master
Write-Host ""
Write-Host "Press Enter to continue to Step 3..." -ForegroundColor Gray
Read-Host

# ============================================
# STEP 3: Create tournaments branch
# ============================================
Write-Host "STEP 3: Create tournaments branch" -ForegroundColor Yellow
Write-Host "---------------------------------"

git checkout -b tournaments
git push -u origin tournaments
Write-Host "Created and pushed 'tournaments' branch" -ForegroundColor Green

git checkout master
Write-Host ""
Write-Host "Press Enter to continue to Step 4..." -ForegroundColor Gray
Read-Host

# ============================================
# STEP 4: Connect branches to Amplify
# ============================================
Write-Host "STEP 4: Connect branches to Amplify" -ForegroundColor Yellow
Write-Host "------------------------------------"

Write-Host "Creating 'landing' branch in Amplify..." -ForegroundColor Gray
aws amplify create-branch --app-id $appId --branch-name landing --stage PRODUCTION --framework "Web" --enable-auto-build

Write-Host "Creating 'tournaments' branch in Amplify..." -ForegroundColor Gray
aws amplify create-branch --app-id $appId --branch-name tournaments --stage PRODUCTION --framework "Web" --enable-auto-build

Write-Host "Branches connected!" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter to continue to Step 5 (Domain Setup)..." -ForegroundColor Gray
Read-Host

# ============================================
# STEP 5: Add custom domain
# ============================================
Write-Host "STEP 5: Add custom domain" -ForegroundColor Yellow
Write-Host "-------------------------"

Write-Host "Adding domain: $domain" -ForegroundColor Gray

# Create the domain with subdomain mappings
aws amplify create-domain-association `
    --app-id $appId `
    --domain-name $domain `
    --sub-domain-settings `
        "prefix=,branchName=landing" `
        "prefix=app,branchName=master" `
        "prefix=play,branchName=tournaments"

Write-Host ""
Write-Host "Domain association created!" -ForegroundColor Green
Write-Host ""
Write-Host "=== IMPORTANT: DNS CONFIGURATION REQUIRED ===" -ForegroundColor Red
Write-Host ""
Write-Host "Run this command to get the DNS records you need to add:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  aws amplify get-domain-association --app-id $appId --domain-name $domain" -ForegroundColor White
Write-Host ""
Write-Host "Add the CNAME records shown in 'certificateVerificationDNSRecord'" -ForegroundColor Yellow
Write-Host "to your domain registrar's DNS settings."
Write-Host ""
Write-Host "Once DNS propagates, your sites will be live at:" -ForegroundColor Cyan
Write-Host "  - https://golfwithgimmies.com (landing page)"
Write-Host "  - https://app.golfwithgimmies.com (main app)"
Write-Host "  - https://play.golfwithgimmies.com (tournaments)"
Write-Host ""
Write-Host "=== Setup Script Complete ===" -ForegroundColor Green
