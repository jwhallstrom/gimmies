# Scorecard Admin Mode Cross-Device Display Fix

## Problem
When the event owner (Tiger) selected **Admin mode** in the Scorecard tab, Phil's scorecard was not showing - only Tiger (owner) and custom name golfers were visible.

## Root Cause
**Profile Lookup Issue** in `ScorecardTab.tsx` (line 29):

```typescript
const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
const displayName = profile ? profile.name : eventGolfer.customName;
if (!displayName) return false; // ← Phil filtered out here!
```

**Why it failed:**
- The `profiles` store only contains profiles for the **currently logged-in user** (Tiger's profiles)
- When Tiger is logged in, `profiles` does NOT contain Phil's profile
- So `profiles.find(p => p.id === Phil's ID)` returns `undefined`
- `displayName` becomes `undefined`
- Phil's `eventGolfer` gets filtered out with `return false`

This is the **same cross-device display issue** we fixed in OverviewTab, ChatTab, and other components!

## Solution
Use the **displayName snapshot** from `eventGolfer.displayName` (saved when the golfer joined the event) instead of looking up the profile:

```typescript
// BEFORE (wrong - fails cross-device):
const displayName = profile ? profile.name : eventGolfer.customName;

// AFTER (correct - uses snapshot):
const displayName = eventGolfer.displayName || (profile ? profile.name : eventGolfer.customName);
```

**Priority chain:**
1. `eventGolfer.displayName` (snapshot saved at join time - works cross-device) ✅
2. `profile?.name` (only works if profile is in local store)
3. `eventGolfer.customName` (for custom name golfers)

## Files Modified
- `src/components/tabs/ScorecardTab.tsx` - Fixed 3 occurrences:
  - Line 30: Filter logic (determines which golfers show)
  - Line 142: Stacked view display
  - Line 462: Table view display

## How Admin Mode Works Now
When event owner selects **Admin mode**:
- ✅ Shows owner's scorecard (Tiger)
- ✅ Shows all profile-based golfers (Phil, etc.) using displayName snapshots
- ✅ Shows all custom name golfers (Jordan Spieth, etc.)
- ✅ Owner can edit scores for ALL golfers (both profile-based and custom)

## Testing Steps
1. Tiger creates event and adds Phil (profile-based) + custom golfers
2. Tiger selects "Admin" mode in Scorecard tab
3. Verify ALL golfers appear (Tiger, Phil, custom names)
4. Tiger can enter scores for all golfers
5. Phil (non-owner) sees only their own scorecard in individual mode

## Related Fixes
This completes the displayName snapshot pattern across all tabs:
- ✅ OverviewTab (payout calculations)
- ✅ ChatTab (message sender names)
- ✅ SetupTab (golfer list)
- ✅ ScorecardTab (admin mode) ← **Just fixed!**

---
**Fixed**: December 2024  
**Files Modified**: `src/components/tabs/ScorecardTab.tsx`
