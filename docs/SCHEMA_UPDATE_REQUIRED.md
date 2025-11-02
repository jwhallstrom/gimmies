# CRITICAL FIX - Schema Update Required

## Issue Found

The `eventId` field was added to the TypeScript interface but **NOT to the Amplify cloud schema**!

This means when IndividualRounds are saved to cloud, the `eventId` field is dropped.

---

## Fix Applied

**File**: `amplify/data/resource.ts`

Added `eventId` field to IndividualRound model:
```typescript
eventId: a.string(), // Optional reference to event if this round came from a completed event
```

---

## DEPLOYMENT REQUIRED

### Step 1: Deploy Schema Change

**In your Amplify Sandbox terminal** (should already be running):
```powershell
# The sandbox should auto-detect the change and redeploy
# Look for output like:
# "Detected model changes, deploying..."
# "Deployment successful"
```

**If sandbox isn't running:**
```powershell
npx ampx sandbox
```

Wait for deployment to complete (usually 1-2 minutes).

---

### Step 2: Clear ALL Data Again

After deployment completes:

```powershell
# Clear cloud data
aws dynamodb scan --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" --output json | ConvertFrom-Json | ForEach-Object { $_.Items } | ForEach-Object { $id = $_.id.S; aws dynamodb delete-item --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --key ('{\"id\":{\"S\":\"' + $id + '\"}}') }

aws dynamodb scan --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" --output json | ConvertFrom-Json | ForEach-Object { $_.Items } | ForEach-Object { $id = $_.id.S; aws dynamodb delete-item --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --key ('{\"id\":{\"S\":\"' + $id + '\"}}') }

aws dynamodb scan --table-name Event-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "id" --output json | ConvertFrom-Json | ForEach-Object { $_.Items } | ForEach-Object { $id = $_.id.S; aws dynamodb delete-item --table-name Event-o26pgbkew5c4fpgcps5tnf27ey-NONE --key ('{\"id\":{\"S\":\"' + $id + '\"}}') }
```

---

### Step 3: Clear Browser Data (BOTH Tiger & Phil)

**For BOTH browsers:**
1. Press `F12` → Application tab
2. IndexedDB → Right-click database → Delete
3. Hard refresh: `Ctrl + F5`

---

### Step 4: Test Again

1. **Create event** (Tiger)
2. **Join event** (Phil)
3. **Add scores**
4. **Complete event** (Tiger)
5. **Check console logs** - should see `EventId: ...` in IndividualRound creation
6. **Check Tiger's Analytics** - should show 1 round, 18 holes
7. **Refresh Phil's browser** - navigate to Events page to trigger cloud sync
8. **Check Phil's Analytics** - should show 1 round, 18 holes, WITH payouts!

---

### Step 5: Verify Cloud Has eventId

```powershell
# Should show eventId field populated
aws dynamodb scan --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE --projection-expression "profileId,eventId,grossScore"
```

**Expected output:**
```json
{
    "Items": [
        {
            "grossScore": { "N": "76" },
            "eventId": { "S": "abc123..." },  // <-- SHOULD BE PRESENT!
            "profileId": { "S": "..." }
        }
    ]
}
```

---

## Why This Happened

1. Added `eventId` to TypeScript interface (`src/types/handicap.ts`)
2. Updated code to SET `eventId` in `completeEvent()`
3. **FORGOT** to update Amplify schema (`amplify/data/resource.ts`)
4. When saving to cloud, Amplify dropped the `eventId` field (not in schema)
5. When loading from cloud, rounds don't have `eventId`
6. Analytics still double-counts because it can't tell which rounds came from events

---

## After Deployment

The fix will work properly:
- IndividualRounds created from events will have `eventId` set
- Analytics will skip those rounds in stats calculation (already counted in CompletedRounds)
- Phil will see his CompletedRounds with game results/payouts
- No more 36-hole double counting!

---

**Deploy the schema change now, then clear everything and test!**
