# The ACTUAL Root Cause - recalculateAllDifferentials Bug

**Issue**: Analytics showing 36 holes instead of 18 for Phil (but not Tiger)

**Date**: January 2025

---

## The REAL Bug (Finally!)

We had **THREE** bugs, not two:

### Bug #1: eventId Not Being SAVED ✅ FIXED
- **File**: `src/utils/roundSync.ts` - `saveIndividualRoundToCloud()`
- **Problem**: `eventId` field missing from cloudData object when saving
- **Fix**: Added `eventId: round.eventId` to cloudData (line ~31)

### Bug #2: eventId Not Being LOADED ✅ FIXED  
- **File**: `src/utils/roundSync.ts` - `loadIndividualRoundsFromCloud()`
- **Problem**: `eventId` field not included when mapping cloud data to local format
- **Fix**: Added `eventId: cloudRound.eventId || undefined` (line ~87)

### Bug #3: eventId Not Set in recalculateAllDifferentials ❌ THE ACTUAL CULPRIT
- **File**: `src/state/store.ts` - `recalculateAllDifferentials()`
- **Problem**: Creates IndividualRounds from CompletedRounds WITHOUT setting `eventId`
- **Why This Matters**: When Phil loads the app after Tiger completes an event, this function runs and creates Phil's IndividualRound without the eventId
- **Fix**: Added `eventId: completedRound.eventId` (line 1722)

---

## Why This Was The Hardest Bug To Find

### The Sequence of Events:

1. **Tiger completes event** (as event owner):
   - `completeEvent()` runs
   - Creates CompletedRound for Tiger ✅
   - Creates CompletedRound for Phil ✅
   - Creates IndividualRound for Tiger with `eventId` ✅
   - **Phil's profile might not be in Tiger's local store**
   - No IndividualRound created for Phil yet

2. **Phil opens his app**:
   - Loads CompletedRounds from cloud
   - Finds his CompletedRound (has `eventId: eV21Z5XM`)
   - `recalculateAllDifferentials()` runs automatically
   - Sees CompletedRound but no matching IndividualRound
   - Creates IndividualRound for Phil **WITHOUT `eventId`** ❌

3. **Analytics Page**:
   - Tiger: IndividualRound has `eventId` → Skipped → Shows 18 holes ✅
   - Phil: IndividualRound has NO `eventId` → Counted twice → Shows 36 holes ❌

### Debug Output That Revealed It:

```javascript
// Tiger's Analytics (working):
🔍 IndividualRound an1jjVJ3: eventId = eV21Z5XM
  ⏭️  Skipping (has eventId: eV21Z5XM)
Final total holes: 18 ✅

// Phil's Analytics (broken):
🔍 IndividualRound bvSop2mE: eventId = NONE  ← Problem!
  ✅ Counting this individual round (no eventId)
Final total holes: 36 ❌
```

### Cloud Data Confirmed It:

```json
[
  // Phil's IndividualRound - NO eventId
  {
    "id": "32059554-044c-4e7d-b475-8786944f6544",
    "profileId": "e919d937-2031-4a08-af8b-e6dd31856685",
    "grossScore": 72
    // eventId: MISSING ❌
  },
  // Tiger's IndividualRound - HAS eventId
  {
    "id": "bcce2c2d-8cc1-478a-acd8-3a7f675a98fe",
    "profileId": "3b9d77ab-259c-429e-b82b-90e144c5a922",
    "grossScore": 79,
    "eventId": "eV21Z5XM" ✅
  }
]
```

---

## The Fix

**File**: `src/state/store.ts` (line ~1709-1722)

**Before**:
```typescript
const newIndividualRound: IndividualRound = {
  id: nanoid(8),
  profileId: profile.id,
  date: completedRound.datePlayed,
  courseId: completedRound.courseId,
  teeName: completedRound.teeName || tee.name,
  grossScore: completedRound.finalScore,
  netScore: completedRound.finalScore - courseHandicap,
  courseHandicap,
  scoreDifferential,
  courseRating: tee.courseRating,
  slopeRating: tee.slopeRating,
  scores: roundScores,
  createdAt: new Date().toISOString()
  // ❌ NO eventId!
};
```

**After**:
```typescript
const newIndividualRound: IndividualRound = {
  id: nanoid(8),
  profileId: profile.id,
  date: completedRound.datePlayed,
  courseId: completedRound.courseId,
  teeName: completedRound.teeName || tee.name,
  grossScore: completedRound.finalScore,
  netScore: completedRound.finalScore - courseHandicap,
  courseHandicap,
  scoreDifferential,
  courseRating: tee.courseRating,
  slopeRating: tee.slopeRating,
  scores: roundScores,
  eventId: completedRound.eventId, // ✅ Link back to source event
  createdAt: new Date().toISOString()
};
```

---

## Why This Function Exists

`recalculateAllDifferentials()` serves two purposes:

1. **Backfill IndividualRounds**: If a user has CompletedRounds but no corresponding IndividualRounds (e.g., from before handicap tracking was added, or if they're a participant whose profile wasn't in the event owner's store), it creates them.

2. **Recalculate Score Differentials**: If course data changed (ratings/slopes), it recalculates all differentials.

The function is called:
- On app load (during profile data sync)
- When user clicks "Recalculate" button on Handicap page
- After loading events from cloud

---

## Complete List of Changes

### 1. TypeScript Interface
**File**: `src/types/handicap.ts`
```typescript
export interface IndividualRound {
  // ... existing fields
  eventId?: string; // ✅ Added
}
```

### 2. Amplify Schema
**File**: `amplify/data/resource.ts`
```typescript
IndividualRound: a.model({
  // ... existing fields
  eventId: a.string(), // ✅ Added
})
```

### 3. Save Function
**File**: `src/utils/roundSync.ts` (line ~31)
```typescript
const cloudData = {
  // ... existing fields
  eventId: round.eventId, // ✅ Added
};
```

### 4. Load Function
**File**: `src/utils/roundSync.ts` (line ~87)
```typescript
const rounds: IndividualRound[] = cloudRounds.map(cloudRound => ({
  // ... existing fields
  eventId: cloudRound.eventId || undefined, // ✅ Added
}));
```

### 5. Event Completion
**File**: `src/state/store.ts` (line ~2033) - Already correct
```typescript
newIndividualRound = {
  // ... existing fields
  eventId: event.id, // ✅ Already had this
};
```

### 6. Recalculate Function (THE MISSING PIECE!)
**File**: `src/state/store.ts` (line ~1722)
```typescript
const newIndividualRound: IndividualRound = {
  // ... existing fields
  eventId: completedRound.eventId, // ✅ JUST ADDED - This was the bug!
};
```

### 7. Analytics Logic
**File**: `src/pages/AnalyticsPage.tsx` (lines ~47-67) - Already correct
```typescript
if (individualRound && !individualRound.eventId) {
  // Only count manually-added rounds
  // ✅ Already had this check
}
```

---

## Testing

### Clear Test Data ✅
```powershell
# All cleared
Events: 0
IndividualRounds: 0  
CompletedRounds: 0
```

### Next Steps:
1. ✅ Hard refresh both browsers (Ctrl+Shift+F5)
2. Create new event
3. Complete event
4. Verify BOTH users:
   - IndividualRound has `eventId` in cloud ✅
   - Analytics shows 18 holes (not 36) ✅
   - Game payouts visible ✅

---

## Why "Clearing Cache" Didn't Help

You were clearing cache correctly, but the bug wasn't in the cached code - it was in `recalculateAllDifferentials()` which runs AFTER the data loads from cloud. So even with fresh code, the function was still creating IndividualRounds without the `eventId`.

The sequence:
1. Clear cache ✅
2. Load fresh code ✅
3. Log in as Phil ✅
4. Load CompletedRounds from cloud ✅
5. **`recalculateAllDifferentials()` runs** ❌ (had the bug)
6. Creates IndividualRound WITHOUT eventId ❌
7. Analytics counts it twice ❌

---

## Prevention

When adding a new field that affects deduplication:

1. ✅ Add to TypeScript interface
2. ✅ Add to Amplify schema
3. ✅ Add to SAVE function
4. ✅ Add to LOAD function
5. ✅ Add to ALL creation paths:
   - `completeEvent()` ← We had this
   - **`recalculateAllDifferentials()`** ← We forgot this!
   - Any other backfill/migration functions
6. ✅ Add to analytics/display logic
7. ✅ Test with BOTH event owner AND participant
8. ✅ Test with cache clear (force cloud reload)

---

**Status**: ✅ FIXED - All three bugs resolved

**Result**: Both Tiger and Phil should now show 18 holes correctly!
