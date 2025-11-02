# Team Nassau Calculation Fix

## Problem
Team Nassau was showing incorrect scores like "-44" instead of proper strokes-to-par values like "-2" or "+4".

## Root Cause
**Double Par Subtraction Bug** in `src/games/nassau.ts`:

1. Line 113 calculated team total and subtracted par: `scores[team.id] = total - parTotal`
   - This stored a strokes-to-par value (e.g., -8) in the `scores` field
   
2. Lines 139-143 subtracted par AGAIN from the already-relative value:
   ```typescript
   toPar[id] = val - parForSegment;
   // If team shot -8 to par, this became: -8 - 36 = -44
   ```

## Solution
Changed line 113 to store **raw total strokes** instead of strokes-to-par:
```typescript
// BEFORE (wrong):
scores[team.id] = allComplete ? total - parTotal : Number.POSITIVE_INFINITY;

// AFTER (correct):
scores[team.id] = allComplete ? total : Number.POSITIVE_INFINITY;
```

Now the flow is:
1. Calculate raw total strokes for team (best ball scoring)
2. Store raw total in `scores[team.id]`
3. Later compute `toPar[id] = rawTotal - parForSegment` (single subtraction)

## How Team Nassau Works
For each hole in the segment (Front 9, Back 9, or Total 18):
1. Get both team members' scores for that hole
2. Sort the scores (lowest first)
3. Take the **best N scores** (default N=1, configurable via Team Best Count)
4. Sum these scores across all holes
5. Calculate strokes-to-par: `teamTotal - segmentPar`

### Example (Front 9, Team Best 1):
- **Hole 1 (Par 4)**: Tiger 5, Phil 4 → Use Phil's 4
- **Hole 2 (Par 5)**: Tiger 4, Phil 5 → Use Tiger's 4
- ... continue for all 9 holes
- **Total**: 34 strokes (sum of best scores)
- **Par**: 36 (front 9 par)
- **To Par**: 34 - 36 = **-2** (2 under par) ✅

## Display Format
**OverviewTab.tsx** already handles team vs individual display correctly:
- **Team mode**: Shows toPar value directly (e.g., "-2", "+4", "E")
  - Green text for under par (negative)
  - Red text for over par (positive)
  - Gray text for even par (0)
- **Individual mode**: Shows raw strokes with toPar badge

## Enhanced Logging
Added detailed console logging for debugging:
```typescript
console.log(`  Team mode: bestCount=${bestCount}, teams=${config.teams?.length || 0}`);
console.log(`  Calculating team ${team.id} (${team.name}):`, team.golferIds);
console.log(`    Hole ${h}: par=${holePar}, memberScores=[...], used=[...], holeTotal=...`);
console.log(`  Team ${team.id} final: total=${total}, parTotal=${parTotal}, toPar=${total - parTotal}`);
```

## Testing Steps
1. Create event with 4+ golfers
2. Add Nassau game
3. Click "Add Team" to create two 2-person teams
4. Enter scores for all golfers
5. View Overview tab - team scores should show correct strokes-to-par values

## Future Enhancement (Mentioned by User)
Consider adding a **scorecard popup** for team games that:
- Shows both team members' scores for each hole
- Highlights the score(s) used in the calculation
- Makes it clear which scores contributed to the team total

---
**Fixed**: December 2024
**Files Modified**: `src/games/nassau.ts`
