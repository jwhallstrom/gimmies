# EventID Load Bug Fix - The REAL Root Cause

**Issue**: Analytics showing 36 holes instead of 18, even after clearing browser cache

**Date**: January 2025

---

## The Real Problem (Finally Found!)

We had TWO bugs, not one:

### Bug #1: eventId Not Being SAVED ✅ FIXED
- **File**: `src/utils/roundSync.ts` - `saveIndividualRoundToCloud()`
- **Problem**: `eventId` field was missing from the `cloudData` object
- **Fix**: Added `eventId: round.eventId` to cloudData
- **Result**: eventId now saves to DynamoDB ✅

### Bug #2: eventId Not Being LOADED ❌ THE REAL CULPRIT
- **File**: `src/utils/roundSync.ts` - `loadIndividualRoundsFromCloud()`
- **Problem**: When loading IndividualRounds from cloud, we weren't reading the `eventId` field
- **Symptom**: Tiger's data looked fine locally, but showed 36 holes after clearing cache and reloading from cloud
- **Fix**: Added `eventId: cloudRound.eventId || undefined` when mapping cloud data to local format

---

## Why This Was So Confusing

### Timeline of Events:
1. Event completed → IndividualRounds created locally WITH `eventId` ✅
2. Saved to cloud → But `eventId` was MISSING (Bug #1) ❌
3. We fixed Bug #1 → Now `eventId` saves to cloud ✅
4. Tiger's browser still had local data → Analytics looked correct ✅
5. Tiger cleared cache → Browser loads from cloud ❌
6. **Load function IGNORED `eventId` field** (Bug #2) ❌
7. Analytics sees IndividualRound without `eventId` → Counts it twice = 36 holes ❌

### The Smoking Gun:
```powershell
# Cloud data DOES have eventId:
{
  "eventId": { "S": "40Is68aM" },  ← In the cloud!
  "profileId": { "S": "3b9d77ab..." },
  "grossScore": { "N": "72" }
}

# But after loading, local data MISSING eventId:
{
  profileId: "3b9d77ab...",
  grossScore: 72,
  // eventId: MISSING! ← Not loaded from cloud
}
```

---

## The Fix

**File**: `src/utils/roundSync.ts`

**Before** (lines 74-88):
```typescript
const rounds: IndividualRound[] = cloudRounds.map(cloudRound => ({
  id: cloudRound.id,
  profileId: cloudRound.profileId,
  courseId: cloudRound.courseId,
  teeName: cloudRound.teeName,
  date: cloudRound.date,
  scores: cloudRound.scoresJson ? JSON.parse(cloudRound.scoresJson as string) : [],
  grossScore: cloudRound.grossScore,
  netScore: cloudRound.netScore || 0,
  scoreDifferential: cloudRound.scoreDifferential || 0,
  courseRating: cloudRound.courseRating || 0,
  slopeRating: cloudRound.slopeRating || 113,
  courseHandicap: cloudRound.courseHandicap || 0,
  createdAt: cloudRound.createdAt || new Date().toISOString(),
  // ❌ eventId NOT included here!
}));
```

**After** (with eventId loaded):
```typescript
const rounds: IndividualRound[] = cloudRounds.map(cloudRound => ({
  id: cloudRound.id,
  profileId: cloudRound.profileId,
  courseId: cloudRound.courseId,
  teeName: cloudRound.teeName,
  date: cloudRound.date,
  scores: cloudRound.scoresJson ? JSON.parse(cloudRound.scoresJson as string) : [],
  grossScore: cloudRound.grossScore,
  netScore: cloudRound.netScore || 0,
  scoreDifferential: cloudRound.scoreDifferential || 0,
  courseRating: cloudRound.courseRating || 0,
  slopeRating: cloudRound.slopeRating || 113,
  courseHandicap: cloudRound.courseHandicap || 0,
  eventId: cloudRound.eventId || undefined, // ✅ NOW loads eventId from cloud!
  createdAt: cloudRound.createdAt || new Date().toISOString(),
}));
```

---

## Complete Fix Summary

### Changes Made:

1. **src/utils/roundSync.ts** - `saveIndividualRoundToCloud()` (line ~31):
   ```typescript
   eventId: round.eventId, // Save to cloud
   ```

2. **src/utils/roundSync.ts** - `loadIndividualRoundsFromCloud()` (line ~87):
   ```typescript
   eventId: cloudRound.eventId || undefined, // Load from cloud
   ```

3. **src/pages/AnalyticsPage.tsx** (already correct):
   ```typescript
   if (individualRound && !individualRound.eventId) {
     // Only count manually-added rounds (skip event-sourced rounds)
   }
   ```

---

## How the Fix Works

### Data Flow (CORRECTED):

```
1. Event Completion
   └─> store.completeEvent()
       ├─> Creates IndividualRound with eventId
       └─> Calls saveIndividualRoundToCloud()
           └─> Saves to DynamoDB with eventId ✅

2. Browser Refresh / Cache Clear
   └─> store.loadProfileData()
       └─> Calls loadIndividualRoundsFromCloud()
           └─> Reads eventId from DynamoDB ✅
           └─> Sets eventId in local IndividualRound ✅

3. Analytics Calculation
   └─> AnalyticsPage.tsx
       ├─> Counts CompletedRounds (from events)
       └─> Skips IndividualRounds with eventId ✅
       └─> Only counts manual IndividualRounds
       └─> Result: 18 holes (not 36) ✅
```

---

## Testing Checklist

### Before Testing:
- [x] Clear all cloud data (Events, IndividualRounds, CompletedRounds)
- [ ] Clear Tiger's browser cache + hard refresh (Ctrl+Shift+F5)
- [ ] Clear Phil's browser cache + hard refresh (Ctrl+Shift+F5)

### Test Steps:
1. Tiger creates new event at DCC
2. Phil joins via share code
3. Enter scores for both players (18 holes)
4. Complete the event
5. Verify cloud data:
   ```powershell
   aws dynamodb scan --table-name IndividualRound-... \
     --projection-expression "profileId,grossScore,eventId"
   ```
   **Expected**: BOTH IndividualRounds have `eventId` field

6. Check Analytics for Tiger:
   - Should show **18 holes played** (not 36)
   - Should show correct scoring breakdown
   - Should show game payouts

7. Check Analytics for Phil:
   - Should show **18 holes played** (not 36)
   - Should show correct scoring breakdown
   - Should show game payouts

8. **Clear cache and reload** (both browsers):
   - Analytics should STILL show 18 holes (eventId now loads correctly)
   - Game payouts should still be visible

---

## Why It Was Hard to Find

1. **Symptom was intermittent**: Worked locally, broke after cache clear
2. **Two separate bugs**: Save bug masked the load bug
3. **Fixed save first**: Made it look like everything should work
4. **Cloud data looked correct**: eventId was in DynamoDB
5. **Analytics logic was correct**: Checking for eventId properly
6. **The load function was silent**: No error, just silently dropped the field

---

## Lessons Learned

### When adding a new field to cloud sync:

1. ✅ Add to TypeScript interface
2. ✅ Add to Amplify schema
3. ✅ Add to SAVE function (include in data sent to cloud)
4. ✅ **Add to LOAD function** (include when reading from cloud) ← WE FORGOT THIS!
5. ✅ Add to any UPDATE functions
6. ✅ Test full round-trip (save → load → verify)
7. ✅ Test with cache clear (force reload from cloud)

### Testing Protocol:
- Always test with cleared cache to verify cloud sync
- Check both local data AND cloud data
- Verify field exists at every step of the pipeline
- Use console.log to trace field through save/load

---

## Prevention

**New Field Addition Checklist**:
```typescript
// 1. TypeScript Interface
interface IndividualRound {
  eventId?: string; // ← Add here
}

// 2. Amplify Schema
IndividualRound: a.model({
  eventId: a.string(), // ← Add here
})

// 3. Save Function
const cloudData = {
  eventId: round.eventId, // ← Add here
};

// 4. Load Function ← DON'T FORGET THIS!
const rounds = cloudRounds.map(cloudRound => ({
  eventId: cloudRound.eventId, // ← Add here
}));

// 5. Update Function (if applicable)
const updateData = {
  eventId: round.eventId, // ← Add here
};
```

---

**Status**: ✅ FIXED - Both save AND load functions now handle eventId

**Next Steps**: 
1. Clear browser caches for both users
2. Test with fresh event
3. Verify Analytics shows 18 holes (not 36)
4. Verify Phil sees game payouts
