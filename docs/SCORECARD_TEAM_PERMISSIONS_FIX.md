# Scorecard Team Mode Permissions Fix

## Problem
When Phil (non-owner) clicked on the Scorecard tab, he could see his teammate James but **could not edit James's scores**. The Individual/Team toggle buttons were only visible to the event owner, and non-owners could only edit their own scores.

**User expectation:** "I thought as joinee of the event I would get individual and team option on scorecard just not admin."

## Root Causes

### 1. View Toggle Buttons Hidden from Non-Owners
**File:** `src/components/tabs/ScorecardTab.tsx` (line 92)

```typescript
// BEFORE (wrong - only owner sees buttons):
{isEventOwner && (
  <div className="flex gap-1 ...">
    <button>individual</button>
    {hasNassauGames && <button>team</button>}
    <button>admin</button>
  </div>
)}
```

**Problem:** Phil couldn't switch to Team view because the toggle buttons were hidden.

### 2. canEditScore Only Allowed Own Scores
**File:** `src/state/store.ts` (lines 1170-1180)

```typescript
// BEFORE (wrong - non-owners can only edit own score):
canEditScore: (eventId: string, golferId: string) => {
  if (event.ownerProfileId === currentProfile.id) return true;
  return golferId === currentProfile.id; // ← Only own score!
}
```

**Problem:** Even if Phil switched to Team view, he still couldn't edit James's scores.

## Solution

### 1. Show Individual/Team Buttons to All Users (When Nassau Games Exist)
**File:** `src/components/tabs/ScorecardTab.tsx` (lines 92-124)

```typescript
// Show Individual/Team toggle to ALL users if Nassau games exist
{hasNassauGames && (
  <div className="flex gap-1 ...">
    <button>individual</button>
    <button>team</button>
    {isEventOwner && <button>admin</button>} {/* Admin only for owner */}
  </div>
)}

// For non-Nassau events, only owner sees buttons
{!hasNassauGames && isEventOwner && (
  <div className="flex gap-1 ...">
    <button>individual</button>
    <button>admin</button>
  </div>
)}
```

**Changes:**
- ✅ Individual/Team buttons shown to **all users** when Nassau games exist
- ✅ Admin button **only for owner**
- ✅ No buttons for non-owners when no Nassau games (they only see their own scorecard anyway)

### 2. Allow Team Members to Edit Each Other's Scores
**File:** `src/state/store.ts` (lines 1170-1197)

```typescript
canEditScore: (eventId: string, golferId: string) => {
  // Event owner can edit all scores
  if (event.ownerProfileId === currentProfile.id) return true;
  
  // Can always edit own score
  if (golferId === currentProfile.id) return true;
  
  // In team mode, can edit team members' scores
  if (event.scorecardView === 'team') {
    // Find all teams in Nassau games that include the current user
    const userTeams = event.games.nassau.flatMap(nassau =>
      nassau.teams?.filter(team => team.golferIds.includes(currentProfile.id)) || []
    );
    
    // Get all golfer IDs from the user's teams
    const teamGolferIds = userTeams.flatMap(team => team.golferIds);
    
    // Can edit if golferId is in one of current user's teams
    return teamGolferIds.includes(golferId);
  }
  
  // Otherwise, can only edit own score
  return false;
}
```

**Logic:**
1. ✅ Owner can edit all scores (unchanged)
2. ✅ Anyone can edit their own score (unchanged)
3. ✅ **NEW:** In Team mode, users can edit their teammates' scores
4. ✅ In Individual mode, users can only edit their own score

## How It Works Now

### Phil's Perspective (Non-Owner on Team with James):

**Individual Mode:**
- Phil sees: Only Phil's scorecard
- Phil can edit: Only Phil's scores ✅

**Team Mode:**
- Phil clicks "Team" button (now visible!) ✅
- Phil sees: Phil and James (his teammates)
- Phil can edit: **Both Phil's and James's scores** ✅
- James can mark Phil's scores, Phil can mark James's scores 🤝

**Admin Mode:**
- Button is **hidden** (owner-only) ✅
- Even if Phil tries to access, permission checks prevent editing

### Tiger's Perspective (Owner):

**Individual Mode:**
- Tiger sees: Only Tiger's scorecard
- Tiger can edit: All of Tiger's scores ✅

**Team Mode:**
- Tiger sees: Tiger + his teammates
- Tiger can edit: All team members' scores ✅

**Admin Mode:**
- Tiger sees: ALL golfers (all teams)
- Tiger can edit: ALL scores ✅

## Use Cases

### Scenario 1: Partner Marking Scorecard
**Teams:** Phil + James vs Tiger + Justin

1. Phil marks James's scores while walking to next hole
2. James marks Phil's scores while Phil putts
3. Both see "Team" mode with just their team
4. Both can edit each other's scores ✅

### Scenario 2: Individual Play (No Nassau)
1. No Nassau games exist
2. Non-owners see only their own scorecard
3. No view toggle buttons (nothing to toggle to)
4. Owner can still use Individual/Admin modes

### Scenario 3: Multiple Nassau Games
1. Event has multiple Nassau configs with different teams
2. User is on multiple teams
3. Team mode shows **all golfers from all teams** the user is on
4. User can edit scores for anyone on any of their teams ✅

## Testing Steps

1. **Setup:**
   - Tiger creates event
   - Add Phil, James, Justin
   - Create Nassau game with teams: Phil+James vs Tiger+Justin

2. **Phil's Device:**
   - Open Scorecard tab
   - **Verify "Individual" and "Team" buttons visible** ✅
   - **Verify "Admin" button NOT visible** ✅
   - Click "Individual" → see only Phil's scorecard
   - Click "Team" → see Phil + James

3. **Edit Team Member Score:**
   - Phil in Team mode
   - Click on James's score input
   - **Verify input is NOT disabled** ✅
   - Enter score for James
   - **Verify score saves** ✅

4. **Tiger's Device:**
   - Open same event
   - Verify all three buttons visible (Individual, Team, Admin)
   - In Team mode → see Tiger + Justin
   - In Admin mode → see ALL golfers

## Benefits
- ✅ **True team collaboration** - Partners can mark each other's scorecards
- ✅ **Intuitive permissions** - Team mode means "edit your team," not just "view your team"
- ✅ **Clear owner privileges** - Only admin mode allows editing everyone
- ✅ **Flexible workflows** - Players can choose how they want to enter scores

## Files Modified
- `src/components/tabs/ScorecardTab.tsx` - Show Individual/Team buttons to all users
- `src/state/store.ts` - Allow editing team members' scores in team mode

---
**Fixed**: December 2024  
**Impact**: HIGH - Enables collaborative scorecard entry for teams  
**User Request**: "I thought as joinee of the event I would get individual and team option on scorecard just not admin."
