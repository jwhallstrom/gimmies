# loadEventsFromCloud IndividualRound Creation Bug Fix

## Problem Found

**Investigation Results:**
- Tiger showing 36 holes in Analytics
- Phil showing 36 holes in Analytics
- Cloud data showed 3 IndividualRounds (should be 2)
- 2 of the 3 IndividualRounds had NO `eventId` or `completedRoundId`

## Root Cause

The `loadEventsFromCloud` function (lines 758-840 in store.ts) was creating IndividualRounds for completed events but **NOT setting the linking fields**:

```typescript
// BEFORE (BROKEN):
const individualRound: IndividualRound = {
  id: nanoid(8),
  profileId: currentProfile.id,
  date: event.date,
  courseId: event.course.courseId,
  // ... other fields ...
  scores: roundScores,
  createdAt: new Date().toISOString()
  // ❌ NO eventId
  // ❌ NO completedRoundId
};
```

### The Flow

1. **Tiger completes event:**
   - `completeEvent()` creates CompletedRounds (2) ✅
   - `completeEvent()` creates IndividualRounds (2) WITH `completedRoundId` ✅
   - Saves to cloud

2. **Tiger's browser loads events:**
   - `loadEventsFromCloud()` runs
   - Creates ANOTHER IndividualRound WITHOUT `completedRoundId` ❌
   - Result: Tiger has 2 IndividualRounds (1 WITH link, 1 WITHOUT)

3. **Phil's browser loads events:**
   - `loadEventsFromCloud()` runs
   - Creates IndividualRound WITHOUT `completedRoundId` ❌
   - Result: Phil has 1 IndividualRound WITHOUT link

4. **Analytics counts:**
   - CompletedRounds: 18 holes (Tiger) + 18 holes (Phil) = 36 ✅
   - IndividualRounds WITHOUT completedRoundId: 18 (Tiger's duplicate) + 18 (Phil) = 36 ❌
   - **Total: 36 + 36 = 72 holes!** (Actually seeing 36 because only one user's data shown)

## The Fix

### 1. Capture CompletedRound Reference
```typescript
// Create CompletedRound if it doesn't exist
let completedRoundForLinking: CompletedRound | undefined;
if (!existingCompletedRound) {
  const completedRound: CompletedRound = {
    id: nanoid(8),
    // ... fields ...
  };
  
  completedRoundForLinking = completedRound;  // ← CAPTURE for linking
  newCompletedRoundsFromCloud.push(completedRound);
} else {
  completedRoundForLinking = existingCompletedRound;  // ← Use existing if found
}
```

### 2. Add Linking Fields to IndividualRound
```typescript
const individualRound: IndividualRound = {
  id: nanoid(8),
  profileId: currentProfile.id,
  // ... other fields ...
  scores: roundScores,
  eventId: event.id,  // ✅ ADDED: Link to source event
  completedRoundId: completedRoundForLinking?.id,  // ✅ ADDED: Link to CompletedRound
  createdAt: new Date().toISOString()
};

console.log('✅ Created IndividualRound for completed event:', event.name, 
  'Differential:', scoreDifferential.toFixed(1), 
  'CompletedRoundId:', completedRoundForLinking?.id);  // ✅ ADDED: Debug log
```

## Expected Behavior After Fix

### Event Completion
1. Tiger completes event
2. Creates 2 CompletedRounds (Tiger + Phil) with IDs `cr1`, `cr2`
3. Creates 2 IndividualRounds with `completedRoundId: cr1` and `completedRoundId: cr2`
4. Saves to cloud

### Event Loading (Both Browsers)
1. `loadEventsFromCloud()` runs
2. **Already has CompletedRound** → Uses existing
3. Creates IndividualRound WITH `completedRoundId` pointing to existing CompletedRound
4. Analytics skips IndividualRound (has `completedRoundId`)

### Analytics Result
- **CompletedRounds:** 18 holes ✅
- **Manual IndividualRounds (no completedRoundId):** 0 ✅
- **Total:** 18 holes ✅

## Files Modified

- **src/state/store.ts (lines 730-840)**:
  - Added `completedRoundForLinking` variable
  - Set `eventId` on IndividualRound
  - Set `completedRoundId` on IndividualRound
  - Enhanced console logging

## Testing

### Clear Data
```powershell
# Clear all cloud data
.\clear-cloud-rounds.ps1
```

### Refresh Browsers
- Tiger: Ctrl+Shift+F5 + Clear IndexedDB
- Phil: Ctrl+Shift+F5 + Clear IndexedDB

### Create & Complete Event
1. Tiger creates event
2. Phil joins
3. Both fill scorecards
4. Tiger completes

### Verify Cloud Data
```powershell
# Check IndividualRounds have completedRoundId
aws dynamodb scan --table-name IndividualRound-... \
  --projection-expression "id,profileId,eventId,completedRoundId,grossScore"
```

Expected: EXACTLY 2 IndividualRounds, BOTH with `completedRoundId` and `eventId`

### Verify Analytics
- Tiger: 18 holes ✅
- Phil: 18 holes ✅
- Both see game payouts ✅

## Related Issues

This was part of the larger Analytics double-counting fix:
1. Added `completedRoundId` field to schema ✅
2. Set `completedRoundId` in `completeEvent()` ✅
3. **Set `completedRoundId` in `loadEventsFromCloud()`** ✅ (THIS FIX)
4. Updated Analytics to filter by `completedRoundId` ✅

## Key Insight

**ANY place that creates an IndividualRound from a CompletedRound MUST set `completedRoundId`!**

Locations:
1. ✅ `completeEvent()` - when event is completed
2. ✅ `loadEventsFromCloud()` - when loading completed events
3. ✅ `recalculateAllDifferentials()` - when backfilling handicaps

All three now properly link IndividualRounds to their source CompletedRounds.
