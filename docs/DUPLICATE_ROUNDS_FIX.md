# Fix: Duplicate IndividualRounds Issue

**Problem**: Deduplication logic was broken, creating duplicate rounds on each page load.

---

## Root Cause

**Deduplication Logic Bug:**

The code checked for existing rounds using:
```typescript
existingIndividualRound = currentProfile.individualRounds?.find(
  r => r.date === event.date && 
       r.courseId === event.course.courseId && 
       r.teeName === eventGolfer.teeName  // ❌ undefined!
);
```

**The Problem:**
1. `eventGolfer.teeName` was `undefined`
2. We used a fallback tee (e.g., "White Tees") to create the round
3. Next load: Still checking for `teeName === undefined`, doesn't find the round created with "White Tees"
4. Creates another duplicate round with "White Tees"
5. Repeat infinitely! 😱

---

## The Fix

### 1. Calculate Effective Tee Name BEFORE Deduplication

```typescript
// Determine which tee name to use (for deduplication)
const effectiveTeeName = eventGolfer.teeName || event.course.teeName || currentProfile.preferredTee;

// Check with the ACTUAL tee name that will be used
const existingIndividualRound = currentProfile.individualRounds?.find(
  r => r.date === event.date && 
       r.courseId === event.course.courseId && 
       r.teeName === effectiveTeeName  // ✅ Matches actual tee!
);
```

### 2. Use Event's Default Tee as Primary Fallback

**New Priority Order:**
1. `eventGolfer.teeName` (golfer's specific tee)
2. **`event.course.teeName`** (event's default tee) ← NEW!
3. `currentProfile.preferredTee` (user's preferred tee)
4. Middle tee (fallback of last resort)

```typescript
let tee = courseTees?.tees.find(t => t.name === eventGolfer.teeName);

if (!tee && courseTees) {
  // Try event's default tee (NEW!)
  tee = courseTees.tees.find(t => t.name === event.course.teeName);
  
  if (!tee) {
    // Try user's preferred tee
    tee = courseTees.tees.find(t => t.name === currentProfile.preferredTee);
    
    // Last resort: middle tee
    if (!tee && courseTees.tees.length > 0) {
      const middleIndex = Math.floor(courseTees.tees.length / 2);
      tee = courseTees.tees[middleIndex];
    }
  }
}
```

### 3. Always Use Selected Tee Name (Not Fallback Chain)

**Before:**
```typescript
teeName: eventGolfer.teeName || tee.name  // Could mismatch deduplication check
```

**After:**
```typescript
teeName: tee.name  // Always use the actual tee we selected
```

This ensures the created round's `teeName` matches what we checked for in deduplication.

---

## Changes Made

**File**: `src/state/store.ts`

### Change 1: Calculate Effective Tee Name (Line ~668)
```typescript
// NEW: Calculate the tee name that will actually be used
const effectiveTeeName = eventGolfer.teeName || event.course.teeName || currentProfile.preferredTee;

// Use effectiveTeeName for deduplication
const existingIndividualRound = currentProfile.individualRounds?.find(
  r => r.date === event.date && r.courseId === event.course.courseId && r.teeName === effectiveTeeName
);
```

### Change 2: Add Event Tee to Fallback Chain (Line ~742)
```typescript
// NEW: Try event's default tee before user's preferred tee
tee = courseTees.tees.find(t => t.name === event.course.teeName);
```

### Change 3: Use Selected Tee Name (Line ~804)
```typescript
teeName: tee.name,  // Use the actual tee we selected (not fallback chain)
```

---

## How to Clean Up Existing Duplicates

Phil already has duplicate rounds. Here's how to clean them up:

### Option 1: Clear Local Storage (Nuclear Option)

**Pros**: Completely fresh start  
**Cons**: Loses all local data (but will reload from cloud)

```typescript
// In browser console (F12):
localStorage.clear();
location.reload();
```

### Option 2: Clear Only IndividualRounds (Surgical)

**Pros**: Keeps other data  
**Cons**: Requires manual console command

```typescript
// In browser console (F12):
const store = window.useStore.getState();
const profiles = store.profiles.map(p => ({
  ...p,
  individualRounds: []  // Clear all rounds
}));
store.setState({ profiles });
location.reload();  // Reload to recreate from cloud events
```

### Option 3: Remove Duplicates Only (Safest)

**Pros**: Keeps unique rounds  
**Cons**: More complex logic

```typescript
// In browser console (F12):
const store = window.useStore.getState();
const currentProfile = store.currentProfile;

// Remove duplicates based on date + course + tee
const uniqueRounds = currentProfile.individualRounds.filter((round, index, arr) => {
  return index === arr.findIndex(r => 
    r.date === round.date && 
    r.courseId === round.courseId && 
    r.teeName === round.teeName
  );
});

const profiles = store.profiles.map(p => 
  p.id === currentProfile.id 
    ? { ...p, individualRounds: uniqueRounds }
    : p
);

store.setState({ profiles });
console.log(`Removed ${currentProfile.individualRounds.length - uniqueRounds.length} duplicates`);
```

---

## Expected Behavior After Fix

### First Load (With Duplicates Cleared):
```
📥 loadEventsFromCloud: Active: 0 Completed: 2
🔍 Current individualRounds count: 0
🔍 Processing event: Master2
🔍 effectiveTeeName: White/Silver existingIndividualRound: false
🔍 Creating IndividualRound for event: Master2
🔍 event.course.teeName: White/Silver Selected tee: White/Silver
✅ Created IndividualRound for completed event: Master2 Differential: 6.7
🔍 Processing event: Masters 4
🔍 effectiveTeeName: White/Silver existingIndividualRound: false
🔍 Creating IndividualRound for event: Masters 4
✅ Created IndividualRound for completed event: Masters 4 Differential: 6.7
✅ loadEventsFromCloud: Adding 2 individual rounds from cloud events
```

**Result**: 2 rounds total ✅

### Second Load (Deduplication Working):
```
📥 loadEventsFromCloud: Active: 0 Completed: 2
🔍 Current individualRounds count: 2
🔍 Processing event: Master2
🔍 effectiveTeeName: White/Silver existingIndividualRound: true  ← Found!
🔍 Processing event: Masters 4
🔍 effectiveTeeName: White/Silver existingIndividualRound: true  ← Found!
✅ loadEventsFromCloud: No new events to add
```

**Result**: Still 2 rounds total (no duplicates) ✅

---

## Testing Steps

1. **Clear duplicates** using Option 2 or 3 above
2. **Refresh the page**
3. Check console - should show "Adding 2 individual rounds"
4. Check Handicap screen - should show exactly 2 rounds
5. **Refresh again**
6. Check console - should show "No new events to add"
7. Check Handicap screen - still exactly 2 rounds ✅

---

## Why Event Tee is Better Fallback

The event's default tee (`event.course.teeName`) is set in the Setup tab and represents the tee that **all golfers** are expected to play from unless they override it individually.

**Benefits:**
- More accurate than guessing middle tee
- Consistent across all golfers in the event
- Matches what was actually played
- Reflects event creator's intention

---

## Prevention for Future

To prevent this issue in the future:

### 1. Enforce Tee Selection on Event Creation
```typescript
// In event creation:
if (!event.course.teeName) {
  throw new Error('Event must have a default tee selected');
}
```

### 2. Enforce Tee for Each Golfer
```typescript
// When adding golfer to event:
golfer.teeName = golfer.teeName || event.course.teeName;
```

### 3. Validate on Event Completion
```typescript
// Before completing event:
event.golfers.forEach(g => {
  if (!g.teeName && event.course.courseId) {
    g.teeName = event.course.teeName;  // Auto-fix
  }
});
```

---

## Summary

✅ **Fixed**: Deduplication now compares actual tee name that will be used  
✅ **Fixed**: Event default tee used as primary fallback  
✅ **Fixed**: Consistent tee name between deduplication check and round creation  
⚠️ **Action Required**: Clear existing duplicate rounds using console command  
✅ **Verified**: No TypeScript errors  

---

**Status**: Ready for testing after clearing duplicates  
**Next**: Have Phil clear duplicates and refresh to test fix

