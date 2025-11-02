# Event ID Field Fix - Root Cause Resolution

**Issue**: Analytics showing 36 holes instead of 18 after completing a single 18-hole event.

**Date**: January 2025

---

## Root Cause

The `eventId` field was added to the `IndividualRound` TypeScript interface and Amplify schema, and set correctly in `store.ts`, BUT it was being **stripped out** when saving to the cloud.

### Why This Happened

1. ✅ `eventId` added to TypeScript interface (`src/types/handicap.ts`)
2. ✅ `eventId` added to Amplify schema (`amplify/data/resource.ts`)
3. ✅ `eventId` set in store when creating rounds (`src/state/store.ts` line 2033)
4. ❌ **`eventId` NOT included in `saveIndividualRoundToCloud()` function**

The `roundSync.ts` file had a hardcoded list of fields to send to the cloud, and `eventId` was missing from that list.

---

## The Fix

**File**: `src/utils/roundSync.ts`

**Before** (lines 19-31):
```typescript
const cloudData = {
  profileId: round.profileId,
  date: round.date,
  courseId: round.courseId,
  teeName: round.teeName,
  grossScore: round.grossScore,
  netScore: round.netScore,
  courseHandicap: round.courseHandicap,
  scoreDifferential: round.scoreDifferential,
  courseRating: round.courseRating,
  slopeRating: round.slopeRating,
  scoresJson: JSON.stringify(round.scores),
};
```

**After** (with eventId included):
```typescript
const cloudData = {
  profileId: round.profileId,
  date: round.date,
  courseId: round.courseId,
  teeName: round.teeName,
  grossScore: round.grossScore,
  netScore: round.netScore,
  courseHandicap: round.courseHandicap,
  scoreDifferential: round.scoreDifferential,
  courseRating: round.courseRating,
  slopeRating: round.slopeRating,
  scoresJson: JSON.stringify(round.scores),
  eventId: round.eventId, // ← ADDED THIS LINE
};
```

---

## How This Was Discovered

1. User completed event → Phil showed 36 holes in Analytics
2. Added `eventId` field to schema and code
3. Deployed schema, cleared data multiple times
4. **Issue persisted** - still showing 36 holes
5. Inspected cloud data directly:
   ```powershell
   aws dynamodb scan --table-name IndividualRound-... --projection-expression "eventId,grossScore,profileId"
   ```
6. **Found**: `eventId` field was **completely missing** from cloud records
7. Traced through code to find `saveIndividualRoundToCloud()`
8. **Discovered**: Function had hardcoded field list without `eventId`

---

## Impact

### Before Fix
- Event completion creates IndividualRound **without** `eventId`
- Analytics can't tell which rounds came from events
- Both CompletedRound AND IndividualRound counted → 18 holes × 2 = **36 holes**
- Game payouts missing on other devices (related data loading issue)

### After Fix
- Event completion creates IndividualRound **with** `eventId`
- Analytics skips IndividualRounds that have `eventId` (already counted via CompletedRounds)
- Only CompletedRounds counted → **18 holes** ✅
- Proper data structure for cross-device sync

---

## Testing Steps

1. **Clear browser data** (both Tiger and Phil):
   - Chrome: F12 → Application → Storage → Clear site data
   - Hard refresh: Ctrl+Shift+F5

2. **Cloud data already cleared** (commands run):
   ```powershell
   # All IndividualRounds deleted
   # All CompletedRounds deleted
   # Event xhMiyvf1 deleted
   ```

3. **Create new event**:
   - Tiger creates event
   - Phil joins via share code
   - Complete event

4. **Verify IndividualRounds have eventId**:
   ```powershell
   aws dynamodb scan --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE `
     --projection-expression "profileId,grossScore,eventId,#d" `
     --expression-attribute-names '{\"#d\":\"date\"}' --output json
   ```
   **Expected**: `eventId` field present with value like `"xhMiyvf1"`

5. **Check Analytics**:
   - Tiger: Should show **18 holes played** (not 36)
   - Phil: Should show **18 holes played** (not 36)
   - Both should show correct game payouts

---

## Related Files

- `src/utils/roundSync.ts` - **FIXED** - Added `eventId` to cloudData
- `src/state/store.ts` - Sets `eventId` when creating rounds (line 2033)
- `src/types/handicap.ts` - TypeScript interface with `eventId` field
- `amplify/data/resource.ts` - Schema with `eventId` field
- `src/pages/AnalyticsPage.tsx` - Skips rounds with `eventId` (lines 33-67)

---

## Lessons Learned

1. **Schema changes require code changes**: Adding a field to the schema doesn't automatically include it in saves
2. **Verify in cloud**: Always check actual cloud data to confirm fields are saving
3. **Explicit field mapping**: Functions like `saveIndividualRoundToCloud` need explicit field lists
4. **Test end-to-end**: TypeScript compiles doesn't mean cloud data is correct

---

## Prevention

**Future schema changes checklist**:
- [ ] Add field to TypeScript interface
- [ ] Add field to Amplify schema
- [ ] Update ALL save functions that use the model
- [ ] Update ALL load functions to read the field
- [ ] Deploy schema
- [ ] Clear test data
- [ ] **Verify field appears in cloud data** (DynamoDB scan)
- [ ] Test application functionality

---

**Status**: ✅ FIXED - Ready for testing

**Next Steps**: 
1. Clear browser caches (both users)
2. Create new event
3. Complete event
4. Verify Analytics shows 18 holes (not 36)
5. Verify game payouts visible on both devices
