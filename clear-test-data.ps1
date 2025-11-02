# Clear all test data from DynamoDB (keeps Profiles)
# Run this to start fresh with clean testing

Write-Host "🧹 Clearing test data from DynamoDB..." -ForegroundColor Cyan
Write-Host ""

# Delete all Events
Write-Host "Deleting Events..." -ForegroundColor Yellow
$events = aws dynamodb scan --table-name Event-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" | ConvertFrom-Json
foreach ($item in $events.Items) {
    $id = $item.id.S
    Write-Host "  Deleting event: $id"
    aws dynamodb delete-item --table-name Event-o26pgbkew5c4fpgcps5tnf27ey-NONE --key "{`"id`": {`"S`": `"$id`"}}" | Out-Null
}
Write-Host "✅ Deleted $($events.Count) events" -ForegroundColor Green
Write-Host ""

# Delete all CompletedRounds
Write-Host "Deleting CompletedRounds..." -ForegroundColor Yellow
$completedRounds = aws dynamodb scan --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" | ConvertFrom-Json
foreach ($item in $completedRounds.Items) {
    $id = $item.id.S
    Write-Host "  Deleting completed round: $id"
    aws dynamodb delete-item --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --key "{`"id`": {`"S`": `"$id`"}}" | Out-Null
}
Write-Host "✅ Deleted $($completedRounds.Count) completed rounds" -ForegroundColor Green
Write-Host ""

# Delete all IndividualRounds
Write-Host "Deleting IndividualRounds..." -ForegroundColor Yellow
$individualRounds = aws dynamodb scan --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" | ConvertFrom-Json
foreach ($item in $individualRounds.Items) {
    $id = $item.id.S
    Write-Host "  Deleting individual round: $id"
    aws dynamodb delete-item --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --key "{`"id`": {`"S`": `"$id`"}}" | Out-Null
}
Write-Host "✅ Deleted $($individualRounds.Count) individual rounds" -ForegroundColor Green
Write-Host ""

# Delete all ChatMessages
Write-Host "Deleting ChatMessages..." -ForegroundColor Yellow
$messages = aws dynamodb scan --table-name ChatMessage-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" | ConvertFrom-Json
foreach ($item in $messages.Items) {
    $id = $item.id.S
    Write-Host "  Deleting message: $id"
    aws dynamodb delete-item --table-name ChatMessage-o26pgbkew5c4fpgcps5tnf27ey-NONE --key "{`"id`": {`"S`": `"$id`"}}" | Out-Null
}
Write-Host "✅ Deleted $($messages.Count) chat messages" -ForegroundColor Green
Write-Host ""

Write-Host "✅ All test data cleared! Profiles preserved." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Clear browser local storage: F12 - Application - Local Storage - Clear"
Write-Host "  2. Refresh the app"
Write-Host "  3. Create a new event and complete it"
Write-Host "  4. Verify IndividualRounds sync to cloud"
Write-Host ""
