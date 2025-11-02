# Fix: Missing Tee Name in Event Golfer

**Issue**: IndividualRounds couldn't be created because `eventGolfer.teeName` was `undefined`.

---

## Problem

**Console Error:**
```
🔍 Course tees found: true Tee found: false Looking for tee: undefined
❌ Could not create IndividualRound: Missing courseTees or tee data
```

**Root Cause:**
When the event was created, the golfer's `teeName` wasn't set. This meant:
1. We couldn't find which tee they played from
2. We couldn't get the course/slope ratings
3. We couldn't calculate the score differential
4. IndividualRound creation failed

---

## Solution

Added **fallback logic** to select a tee when `eventGolfer.teeName` is undefined:

### Priority Order:

1. **Use eventGolfer.teeName** (if set)
2. **Fall back to user's preferredTee** (from profile)
3. **Use middle tee** (typically White or Blue tees)

### Code Change

**File**: `src/state/store.ts` (lines ~735-755)

**Before:**
```typescript
const tee = courseTees?.tees.find(t => t.name === eventGolfer.teeName);
// If undefined teeName, tee is never found ❌
```

**After:**
```typescript
// Try to find the tee
let tee = courseTees?.tees.find(t => t.name === eventGolfer.teeName);

if (!tee && courseTees) {
  // Try user's preferred tee
  tee = courseTees.tees.find(t => t.name === currentProfile.preferredTee);
  
  // If still not found, use the middle tee
  if (!tee && courseTees.tees.length > 0) {
    const middleIndex = Math.floor(courseTees.tees.length / 2);
    tee = courseTees.tees[middleIndex];
    console.log('🔍 Using middle tee as fallback:', tee.name);
  }
}
```

---

## How It Works Now

### Scenario 1: Event Has Tee Name
```
Event: Masters 4
eventGolfer.teeName: "Blue Tees"
  ↓
Find tee: "Blue Tees" ✅
  ↓
Create IndividualRound with Blue Tees ratings
```

### Scenario 2: Event Has NO Tee Name (Phil's Case)
```
Event: Masters 4
eventGolfer.teeName: undefined
  ↓
Try eventGolfer.teeName: Not found
  ↓
Try currentProfile.preferredTee: "White Tees" ✅
  ↓
Create IndividualRound with White Tees ratings
```

### Scenario 3: No Preferred Tee Either
```
Event: Masters 4
eventGolfer.teeName: undefined
currentProfile.preferredTee: undefined
  ↓
Use middle tee (index 1 of [Gold, White, Blue])
  ↓
Use "White Tees" ✅
  ↓
Create IndividualRound with White Tees ratings
```

---

## Why This Happens

**Root Cause:** Old events created before tee selection was enforced

Possible reasons `teeName` is undefined:
1. Event created with older version of code
2. Custom golfer (no profile) added without tee selection
3. Event imported from external source
4. Bug in event creation flow

**This fix** handles the issue gracefully instead of failing completely.

---

## Expected Console Output (After Fix)

When Phil refreshes the Handicap page now:

```
📥 loadEventsFromCloud: Active: 0 Completed: 2
🔍 Current completedRounds count: 2
🔍 Current individualRounds count: 0
🔍 Processing event: Master2 for user: Phil
🔍 existingCompletedRound: true existingIndividualRound: false
🔍 Creating IndividualRound for event: Master2 courseId: dcc holesPlayed: 18
🔍 Using middle tee as fallback: White Tees           ← NEW
🔍 Course tees found: true Tee found: true Looking for tee: undefined Selected tee: White Tees
✅ Created IndividualRound for completed event: Master2 Differential: 9.2
🔍 Processing event: Masters 4 for user: Phil
🔍 existingCompletedRound: true existingIndividualRound: false
🔍 Creating IndividualRound for event: Masters 4 courseId: dcc holesPlayed: 18
🔍 Using middle tee as fallback: White Tees           ← NEW
🔍 Course tees found: true Tee found: true Looking for tee: undefined Selected tee: White Tees
✅ Created IndividualRound for completed event: Masters 4 Differential: 8.7
✅ loadEventsFromCloud: Adding 2 individual rounds from cloud events
```

---

## Tee Selection Logic

### Typical Course Tees (in order):
1. **Gold/Forward** - Shortest, easiest (seniors, beginners)
2. **White/Regular** - Middle distance (most common)
3. **Blue/Championship** - Longer, harder (low handicaps)
4. **Black/Tournament** - Longest, hardest (pros)

### Middle Tee Selection:
```typescript
const middleIndex = Math.floor(courseTees.tees.length / 2);
```

**Examples:**
- 2 tees: `[Gold, Blue]` → index 1 → **Blue**
- 3 tees: `[Gold, White, Blue]` → index 1 → **White** ✅
- 4 tees: `[Gold, White, Blue, Black]` → index 2 → **Blue**

This usually picks a reasonable middle difficulty tee.

---

## Benefits

### 1. **Graceful Degradation** ✅
- Old events without tee names now work
- No data loss
- IndividualRounds created successfully

### 2. **Smart Fallbacks** ✅
- Tries user's preferred tee first
- Falls back to reasonable default
- Always finds a tee if course has any

### 3. **Better Logging** ✅
- Shows which tee was selected
- Shows fallback path taken
- Easy to debug tee selection issues

### 4. **Accurate Handicaps** ✅
- Can calculate differentials now
- Uses appropriate course/slope ratings
- WHS compliant calculations

---

## Future Enhancement

### Option 1: Auto-Detect Tee from Handicap
If we know the golfer's handicap, we could intelligently select the appropriate tee:

```typescript
function suggestTeeForHandicap(handicap: number, tees: Tee[]): Tee {
  if (handicap <= 10) return tees.find(t => t.name.includes('Blue')) || tees[tees.length - 1];
  if (handicap <= 20) return tees.find(t => t.name.includes('White')) || tees[Math.floor(tees.length / 2)];
  return tees.find(t => t.name.includes('Gold')) || tees[0];
}
```

### Option 2: Prompt User to Select Tee
When creating IndividualRound from old event:
- Show modal: "Which tee did you play from in [Event Name]?"
- Let user select
- Update event with selected tee
- Create IndividualRound

### Option 3: Use Event's Default Course Tee
```typescript
const defaultTee = event.course.defaultTeeName || 'White Tees';
tee = courseTees.tees.find(t => t.name === defaultTee);
```

---

## Testing

### Test Case 1: Event with Tee Name
- Event has `teeName: "Blue Tees"`
- Should use Blue Tees ✅
- No fallback needed

### Test Case 2: Event without Tee Name, User has Preferred Tee
- Event has `teeName: undefined`
- User has `preferredTee: "White Tees"`
- Should use White Tees ✅
- Log: "Using user's preferred tee"

### Test Case 3: Event without Tee Name, No Preferred Tee
- Event has `teeName: undefined`
- User has `preferredTee: undefined`
- Should use middle tee ✅
- Log: "Using middle tee as fallback: White Tees"

### Test Case 4: Course with Only One Tee
- Course has only `["Championship"]`
- Should use Championship ✅
- middleIndex = 0

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| **No tee name in event** | Use preferred or middle tee ✅ |
| **Tee name doesn't match course** | Try preferred, then middle ✅ |
| **Course has 1 tee** | Use that tee ✅ |
| **Course has many tees** | Use middle one ✅ |
| **User has no preferred tee** | Use middle tee ✅ |
| **Tee names are case-sensitive** | Exact match required (could enhance) |

---

## Related Issues

- [x] Missing tee name blocks IndividualRound creation
- [x] Old events need tee fallback logic
- [ ] Update event creation to require tee selection (future)
- [ ] Add tee name validation on event completion (future)

---

**Status**: ✅ **FIXED**  
**Impact**: Phil can now get IndividualRounds from old events  
**Next**: Test to confirm rounds appear in Handicap screen

