# CompletedRound vs IndividualRound - Fixed Architecture

## Problem Identified
Analytics was double-counting rounds - showing 36 holes instead of 18 after completing an 18-hole event.

### Root Cause
- **CompletedRounds** are created during event completion (for analytics & game results)
- **IndividualRounds** ALSO created during event completion (for handicap tracking)
- Analytics was counting BOTH → double counting

### The Confusion
IndividualRounds serve TWO purposes:
1. Event-based rounds (created from CompletedRounds during event completion)
2. Manual rounds (user manually adds for handicap tracking)

We needed a clear way to distinguish between these two types.

---

## Solution: `completedRoundId` Field

### What We Did
Added a new field `completedRoundId` to the IndividualRound model that links event-based IndividualRounds to their source CompletedRound.

### Schema Changes
```typescript
// amplify/data/resource.ts - IndividualRound model
IndividualRound: a.model({
  // ...existing fields
  eventId: a.string(),  // Which event this came from
  completedRoundId: a.string(),  // ← NEW: Which CompletedRound this came from
  scoresJson: a.json(),
})
```

```typescript
// src/types/handicap.ts
export interface IndividualRound {
  // ...existing fields
  eventId?: string;
  completedRoundId?: string;  // ← NEW: Links to CompletedRound if from event
  createdAt: string;
}
```

### Code Changes

**1. Event Completion** (src/state/store.ts)
When creating IndividualRounds from CompletedRounds:
```typescript
const individualRound: IndividualRound = {
  id: nanoid(8),
  // ...other fields
  eventId: event.id,
  completedRoundId: completedRound.id,  // ← Link to the CompletedRound
  createdAt: new Date().toISOString()
};
```

**2. Analytics Page** (src/pages/AnalyticsPage.tsx)
Skip IndividualRounds that have a `completedRoundId`:
```typescript
// Count CompletedRounds (event results)
myCompletedRounds.forEach(round => {
  stats.totalHoles += round.holesPlayed;
  // ... add stats
});

// Count ONLY manual IndividualRounds (without completedRoundId)
allRounds.forEach(round => {
  if (round.type === 'individual') {
    const individualRound = profile?.individualRounds?.find(r => r.id === round.id);
    
    // Skip if this came from an event (has completedRoundId)
    if (!individualRound?.completedRoundId) {
      // This is a manual round - count it
      stats.totalHoles += round.scores.length;
      // ... add stats
    }
  }
});
```

**3. Cloud Sync** (src/utils/roundSync.ts)
Updated save/load functions:
```typescript
// Save
const cloudData = {
  // ...existing fields
  eventId: round.eventId,
  completedRoundId: round.completedRoundId,  // ← Include in cloud save
};

// Load
const rounds: IndividualRound[] = cloudRounds.map(cloudRound => ({
  // ...existing fields
  eventId: cloudRound.eventId || undefined,
  completedRoundId: cloudRound.completedRoundId || undefined,  // ← Load from cloud
  createdAt: cloudRound.createdAt || new Date().toISOString(),
}));
```

---

## Data Model Clarity

### CompletedRound
**Purpose:** Store event game results for analytics, history, and payouts  
**Created:** When event is completed  
**Contains:**
- Event details (name, date, course)
- Player details (golferId, golferName, handicap)
- Scores (finalScore, scoreToPar, holeScores)
- Game results (nassau, skins winnings)
- Stats (birdies, eagles, pars, etc.)

### IndividualRound
**Purpose:** Handicap tracking (GHIN-style differential calculation)  
**Created:**
1. **From event** - when event completed (has `completedRoundId`)
2. **Manually** - user adds for handicap tracking (NO `completedRoundId`)

**Contains:**
- Player details (profileId)
- Course details (courseId, teeName, ratings)
- Scores (grossScore, netScore, scoreDifferential)
- Hole-by-hole scores with handicap strokes

### The Relationship
```
Event Completion
    ↓
CompletedRound (for analytics)  ←──┐
    ↓                               │
IndividualRound (for handicap)  ────┘
    └─ completedRoundId links back

Manual Round Entry
    ↓
IndividualRound (NO completedRoundId)
```

---

## Analytics Logic

### What to Count
1. **All CompletedRounds** → Event results ✅
2. **Only IndividualRounds WITHOUT completedRoundId** → Manual rounds ✅

### What NOT to Count
- ❌ IndividualRounds WITH completedRoundId (already counted via CompletedRounds)

### Debug Output
```
🔍 Analytics Debug - Starting calculation
  myCompletedRounds count: 2
  📊 CompletedRound abc123: 18 holes
  📊 CompletedRound def456: 18 holes
  After CompletedRounds: 36 total holes
  
  🔍 IndividualRound xyz789: completedRoundId = abc123
    ⏭️ Skipping (already counted via CompletedRound abc123)
  🔍 IndividualRound manual1: completedRoundId = NONE
    ✅ Counting this manual round
  
  Final total holes: 54 (36 from events + 18 manual)
```

---

## Testing Procedure

### 1. Clear Test Data
```powershell
# Run the clear-cloud-rounds.ps1 script
.\clear-cloud-rounds.ps1
```

### 2. Hard Refresh Both Browsers
- Tiger's browser: **Ctrl+Shift+F5**
- Phil's browser: **Ctrl+Shift+F5**
- Clear IndexedDB if needed

### 3. Create & Complete Event
1. Tiger creates event
2. Phil joins via share code
3. Both fill scorecards
4. Tiger completes event

### 4. Expected Cloud Data

**CompletedRounds (2 records):**
```json
{
  "id": "abc123",
  "golferId": "tiger-profile-id",
  "finalScore": 72,
  "holesPlayed": 18,
  "eventId": "event-id"
}
{
  "id": "def456",
  "golferId": "phil-profile-id",
  "finalScore": 75,
  "holesPlayed": 18,
  "eventId": "event-id"
}
```

**IndividualRounds (2 records):**
```json
{
  "id": "ind123",
  "profileId": "tiger-profile-id",
  "grossScore": 72,
  "eventId": "event-id",
  "completedRoundId": "abc123"  ← LINKED!
}
{
  "id": "ind456",
  "profileId": "phil-profile-id",
  "grossScore": 75,
  "eventId": "event-id",
  "completedRoundId": "def456"  ← LINKED!
}
```

### 5. Expected Analytics Results
- **Tiger's Analytics:** 18 holes (skips IndividualRound with completedRoundId) ✅
- **Phil's Analytics:** 18 holes (skips IndividualRound with completedRoundId) ✅

---

## Benefits of This Approach

### 1. Direct Link
- No fuzzy matching by date/course
- Explicit relationship: `IndividualRound.completedRoundId → CompletedRound.id`

### 2. Clear Semantics
- `completedRoundId` present → Event-based round, already in CompletedRounds
- `completedRoundId` absent → Manual round, needs to be counted

### 3. Future-Proof
- If user adds manual rounds with same date/course as event, no collision
- Each round type is clearly identified

### 4. Cross-Device Works
- Phil loads CompletedRound from cloud → has payouts, stats
- Phil loads IndividualRound from cloud → has completedRoundId → skipped in Analytics
- No duplicate counting!

---

## Files Modified

1. **amplify/data/resource.ts** - Added `completedRoundId` to IndividualRound schema
2. **src/types/handicap.ts** - Added `completedRoundId` to IndividualRound interface
3. **src/state/store.ts** - Set `completedRoundId` when creating IndividualRounds
4. **src/utils/roundSync.ts** - Save/load `completedRoundId` to/from cloud
5. **src/pages/AnalyticsPage.tsx** - Filter by `completedRoundId` instead of `eventId`

---

## Deployment

```powershell
# Deploy schema changes
npx ampx sandbox

# Wait for deployment to complete
# ✔ Deployment completed in ~12 seconds

# Clear test data
.\clear-cloud-rounds.ps1

# Test with fresh event
```

---

## Summary

**Before:** Analytics counted both CompletedRounds AND IndividualRounds → 36 holes  
**After:** Analytics counts CompletedRounds + manual IndividualRounds only → 18 holes ✅

**Key Insight:** CompletedRounds are the source of truth for event results. IndividualRounds created from events should be linked back via `completedRoundId` so Analytics knows to skip them.
