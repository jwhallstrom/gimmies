# PowerShell script to clear all IndividualRound and CompletedRound data from cloud
# Run this to start fresh after implementing duplicate prevention

Write-Host ""
Write-Host "=== Gimmies Golf - Clear Cloud Rounds ===" -ForegroundColor Cyan
Write-Host "This will DELETE all IndividualRounds and CompletedRounds from cloud." -ForegroundColor Yellow
Write-Host "Events, Profiles, and other data will NOT be affected." -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host ""
    Write-Host "Operation cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "--- Step 1: Scanning IndividualRound table ---" -ForegroundColor Green
$individualRounds = aws dynamodb scan --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id,profileId,grossScore" --output json | ConvertFrom-Json

$individualCount = $individualRounds.Items.Count
Write-Host "Found $individualCount IndividualRounds" -ForegroundColor Yellow

if ($individualCount -gt 0) {
    Write-Host ""
    Write-Host "Deleting IndividualRounds..." -ForegroundColor Yellow
    foreach ($item in $individualRounds.Items) {
        $id = $item.id.S
        Write-Host "  Deleting IndividualRound: $id" -ForegroundColor Gray
        $keyJson = '{"id": {"S": "' + $id + '"}}'
        aws dynamodb delete-item --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --key $keyJson | Out-Null
    }
    Write-Host "Done! Deleted $individualCount IndividualRounds" -ForegroundColor Green
}

Write-Host ""
Write-Host "--- Step 2: Scanning CompletedRound table ---" -ForegroundColor Green
$completedRounds = aws dynamodb scan --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id,golferId" --output json | ConvertFrom-Json

$completedCount = $completedRounds.Items.Count
Write-Host "Found $completedCount CompletedRounds" -ForegroundColor Yellow

if ($completedCount -gt 0) {
    Write-Host ""
    Write-Host "Deleting CompletedRounds..." -ForegroundColor Yellow
    foreach ($item in $completedRounds.Items) {
        $id = $item.id.S
        Write-Host "  Deleting CompletedRound: $id" -ForegroundColor Gray
        $keyJson = '{"id": {"S": "' + $id + '"}}'
        aws dynamodb delete-item --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --key $keyJson | Out-Null
    }
    Write-Host "Done! Deleted $completedCount CompletedRounds" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Deleted $individualCount IndividualRounds" -ForegroundColor Green
Write-Host "Deleted $completedCount CompletedRounds" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Clear browser cache or hard refresh (Ctrl+F5)" -ForegroundColor White
Write-Host "  2. Complete an event to test" -ForegroundColor White
Write-Host "  3. Check browser console for duplicate prevention logs" -ForegroundColor White
Write-Host "  4. Verify Analytics page shows correct data" -ForegroundColor White
Write-Host ""
