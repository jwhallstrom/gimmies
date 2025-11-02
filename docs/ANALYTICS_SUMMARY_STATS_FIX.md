# Analytics Summary Stats Fix

## Problem

Phil's Analytics page showed:
- **0 Rounds** (should be 1)
- **N/A Avg Score** (should show 90 or similar)
- **N/A Best Score** (should show 90)
- **0.0 Handicap** (correct if not calculated yet)

Tiger's Analytics page showed correct stats.

## Root Cause

The summary stats at the top of Analytics were being pulled from `currentProfile.stats`:

```tsx
// BEFORE (BROKEN):
<div className="text-2xl font-bold text-primary-600">
  {currentProfile.stats.roundsPlayed}
</div>
```

### Why This Failed:

1. **Event Completion Flow:**
   - Tiger completes event
   - Updates profile stats in LOCAL store only (Tiger's browser)
   - Phil's profile gets updated in Tiger's local store
   - BUT: Profile updates are NOT synced to cloud!

2. **Phil Loads Event:**
   - Loads CompletedRound from cloud ✅
   - Loads IndividualRound from cloud ✅
   - Loads his Profile from cloud
   - Profile stats still show 0 rounds (not synced!) ❌

3. **Result:**
   - Phil's `profile.stats.roundsPlayed = 0` (stale)
   - Phil's `completedRounds.length = 1` (correct)
   - Analytics displays stale profile stats

## The Solution

**Calculate summary stats DYNAMICALLY from CompletedRounds** instead of using stored `profile.stats`.

### Why This Works:

1. **Single Source of Truth:** CompletedRounds are synced to cloud
2. **Always Accurate:** Calculated fresh on every page load
3. **Cross-Device:** Works automatically across devices
4. **No Sync Issues:** Don't need to sync profile stats

### Implementation:

```tsx
// Calculate from CompletedRounds (source of truth)
const roundsPlayed = myCompletedRounds.length;

const averageScore = roundsPlayed > 0 
  ? myCompletedRounds.reduce((sum, r) => sum + r.finalScore, 0) / roundsPlayed
  : 0;

const bestScore = roundsPlayed > 0
  ? Math.min(...myCompletedRounds.map(r => r.finalScore))
  : 0;

// Display calculated values
<div className="text-2xl font-bold text-primary-600">
  {roundsPlayed}
</div>

<div className="text-2xl font-bold text-primary-600">
  {averageScore > 0 ? averageScore.toFixed(1) : 'N/A'}
</div>

<div className="text-2xl font-bold text-primary-600">
  {bestScore > 0 ? bestScore : 'N/A'}
</div>
```

## Benefits

### Before:
```
Tiger's Browser:
  - Completes event
  - Updates profile.stats locally ✅
  - Phil's stats in Tiger's store updated ✅
  - Profile NOT synced to cloud ❌

Phil's Browser:
  - Loads profile from cloud
  - profile.stats.roundsPlayed = 0 (stale) ❌
  - Analytics shows "0 Rounds" ❌
```

### After:
```
Tiger's Browser:
  - Completes event
  - Creates CompletedRounds ✅
  - Saves to cloud ✅

Phil's Browser:
  - Loads CompletedRounds from cloud ✅
  - Calculates: roundsPlayed = completedRounds.length = 1 ✅
  - Analytics shows "1 Rounds" ✅
  - Shows correct Avg Score & Best Score ✅
```

## Additional Notes

### What About profile.stats?

The `profile.stats` field in GolferProfile still exists and is still updated during event completion. However:

**Current Behavior:**
- Updated locally in event owner's browser
- NOT synced to cloud
- Used by Handicap page (for now)

**Future Consideration:**
Should probably calculate ALL stats dynamically from CompletedRounds to avoid sync issues. But for now, Analytics is fixed and that's the most visible issue.

### Tiger vs Phil

**Why did Tiger's Analytics work?**
- Tiger is the event owner
- His profile stats were updated in HIS local browser
- Analytics read from HIS local profile.stats
- Showed correct values ✅

**Why did Phil's Analytics fail?**
- Phil's profile was updated in TIGER's browser
- Phil loads HIS profile from cloud (not updated)
- Analytics read from stale profile.stats
- Showed "0 Rounds" ❌

## Files Modified

**src/pages/AnalyticsPage.tsx**
- Lines 88-96: Added calculation of `roundsPlayed`, `averageScore`, `bestScore` from `myCompletedRounds`
- Lines 126-143: Updated display to use calculated values instead of `currentProfile.stats`

## Testing

### Before Refresh:
Phil's Analytics:
- ❌ 0 Rounds
- ❌ N/A Avg Score
- ❌ N/A Best Score

### After Refresh:
Phil's Analytics:
- ✅ 1 Rounds
- ✅ 90.0 Avg Score (or whatever his actual score was)
- ✅ 90 Best Score

### Verification:
Both Tiger and Phil should now show identical summary stats if they played the same number of rounds.

## Key Insight

**When building cross-device applications:**

❌ **DON'T**: Store calculated/derived data in user profiles unless you sync them
✅ **DO**: Calculate stats dynamically from the source of truth (CompletedRounds)

This pattern applies to:
- Round counts
- Average scores
- Best scores
- Total birdies/eagles
- Any aggregate statistics

Store raw data (CompletedRounds, IndividualRounds), calculate summaries on-demand.
