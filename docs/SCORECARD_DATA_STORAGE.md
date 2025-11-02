# Scorecard Data Storage Guide

**Where is course, tee, rating, slope, and hole-by-hole score data stored in DynamoDB?**

---

## Overview

Golf scorecard data (course details, tee info, ratings, slopes, and hole-by-hole scores) is stored in **THREE different places** depending on the context:

1. **Active Events** → `Event.scorecardsJson` (while event is in progress)
2. **Completed Events** → `CompletedRound.holeScoresJson` (after event is completed)
3. **Handicap Tracking** → `IndividualRound.scoresJson` (for handicap calculations)

---

## 1. Active Event Scorecards

**Table**: `Event`  
**Field**: `scorecardsJson` (JSON field)  

### When Used
- While event is **in progress** (not completed)
- Real-time score entry during rounds
- Live score updates across devices

### Data Structure
```typescript
// Event table fields related to scorecards
{
  id: "abc123",
  name: "Saturday Round",
  date: "2025-10-11",
  courseId: "dcc",           // ← Course reference
  teeName: "Blue",           // ← Tee selection
  
  scorecardsJson: JSON.stringify([
    {
      golferId: "tiger-id",
      scores: [
        { hole: 1, strokes: 4 },
        { hole: 2, strokes: 5 },
        // ... holes 3-18
      ]
    },
    {
      golferId: "phil-id",
      scores: [
        { hole: 1, strokes: 5 },
        { hole: 2, strokes: 4 },
        // ... holes 3-18
      ]
    }
  ]),
  
  golfersJson: JSON.stringify([
    {
      profileId: "tiger-id",
      displayName: "Tiger",
      handicapSnapshot: 2.5,
      teeName: "Blue"        // ← Per-player tee
    },
    {
      profileId: "phil-id",
      displayName: "Phil",
      handicapSnapshot: 5.0,
      teeName: "Blue"
    }
  ]),
  
  // Other game data
  gamesJson: JSON.stringify({ nassau: [...], skins: [...] }),
  groupsJson: JSON.stringify([...]),
}
```

### How Course Details Are Retrieved
- `courseId` → Lookup in `src/data/courses.ts` (hardcoded course database)
- Course object contains: name, location, holes (par, yardage), tees (rating, slope)
- Example:
  ```typescript
  const course = courseMap[event.courseId]; // "dcc" → Deer Creek Course
  const tee = course.tees.find(t => t.name === event.teeName); // "Blue" tee
  // tee.rating = 72.3, tee.slope = 130
  ```

### Saved By
- `src/utils/eventSync.ts` → `saveEventToCloud()`
- Called on: event creation, score updates, golfer joins

---

## 2. Completed Event Rounds

**Table**: `CompletedRound`  
**Field**: `holeScoresJson` (JSON field)  

### When Used
- After event is **completed** (marked as done)
- Historical round data for analytics
- Game results and money won/lost

### Data Structure
```typescript
// CompletedRound table fields
{
  id: "round-123",
  eventId: "abc123",
  eventName: "Saturday Round",
  datePlayed: "2025-10-11",
  
  courseId: "dcc",           // ← Course reference
  courseName: "Deer Creek",
  teeName: "Blue",           // ← Tee used
  
  golferId: "tiger-id",
  golferName: "Tiger",
  handicapIndex: 2.5,
  
  finalScore: 73,            // Total strokes
  scoreToPar: +1,            // Relative to par
  holesPlayed: 18,
  
  holeScoresJson: JSON.stringify([
    {
      hole: 1,
      par: 4,
      strokes: 4,
      net: 4,                // After handicap strokes
      points: 2,             // Stableford points (if applicable)
    },
    {
      hole: 2,
      par: 5,
      strokes: 5,
      net: 5,
      points: 2,
    },
    // ... holes 3-18
  ]),
  
  gameResultsJson: JSON.stringify({
    nassau: { won: 15, lost: 0, net: 15 },
    skins: { won: 30, lost: 0, net: 30 },
    total: { won: 45, lost: 0, net: 45 }
  }),
  
  statsJson: JSON.stringify({
    birdies: 2,
    pars: 12,
    bogeys: 3,
    doubles: 1,
    // ... other stats
  }),
}
```

### How Course Details Are Retrieved
- `courseId` stored directly in CompletedRound
- `courseName` stored as snapshot
- `teeName` stored directly
- Course object can be looked up from `courseMap[courseId]` if needed

### Saved By
- `src/utils/completedRoundSync.ts` → `saveCompletedRoundToCloud()`
- Called on: event completion (triggered by `store.completeEvent()`)

---

## 3. Individual Handicap Rounds

**Table**: `IndividualRound`  
**Field**: `scoresJson` (JSON field)  

### When Used
- For **handicap index calculations** (WHS/GHIN-style)
- Can be from completed events OR manually entered rounds
- Used in Analytics page to track handicap over time

### Data Structure
```typescript
// IndividualRound table fields
{
  id: "individual-123",
  profileId: "tiger-id",
  
  date: "2025-10-11",
  courseId: "dcc",           // ← Course reference
  teeName: "Blue",           // ← Tee used
  
  grossScore: 73,            // Total gross strokes
  netScore: 71,              // After course handicap
  courseHandicap: 3,         // Playing handicap for this round
  scoreDifferential: 0.8,    // (Score - Rating) * 113 / Slope
  courseRating: 72.3,        // ← Stored from tee at time of round
  slopeRating: 130,          // ← Stored from tee at time of round
  
  eventId: "abc123",         // ← NEW! Links to event if from completed event
  
  scoresJson: JSON.stringify([
    { hole: 1, strokes: 4 },
    { hole: 2, strokes: 5 },
    // ... holes 3-18
  ]),
}
```

### How Course Details Are Retrieved
- `courseId`, `courseRating`, `slopeRating`, `teeName` all stored directly
- Snapshots taken at time of round (in case course data changes later)
- Course object can be looked up from `courseMap[courseId]` if needed

### Saved By
- `src/utils/roundSync.ts` → `saveIndividualRoundToCloud()`
- Called on:
  - Event completion (creates IndividualRound for each player)
  - Manual round entry (Add Score page)

---

## Data Flow Example

### Scenario: Complete an 18-hole event

```
1. EVENT CREATION
   └─> Event table
       ├─ courseId: "dcc"
       ├─ teeName: "Blue"
       ├─ scorecardsJson: [empty scores]
       └─ golfersJson: [Tiger, Phil]

2. SCORE ENTRY (holes 1-18)
   └─> Event table (UPDATE)
       └─ scorecardsJson: [Tiger's scores, Phil's scores]

3. EVENT COMPLETION (completeEvent() called)
   ├─> Event table (UPDATE)
   │   ├─ isCompleted: true
   │   └─ completedAt: "2025-10-11T18:30:00Z"
   │
   ├─> CompletedRound table (CREATE 2 records)
   │   ├─ Tiger's CompletedRound
   │   │   ├─ courseId: "dcc"
   │   │   ├─ teeName: "Blue"
   │   │   ├─ holeScoresJson: [Tiger's 18 holes with par, net, points]
   │   │   └─ gameResultsJson: { nassau: {...}, skins: {...} }
   │   │
   │   └─ Phil's CompletedRound
   │       ├─ courseId: "dcc"
   │       ├─ teeName: "Blue"
   │       ├─ holeScoresJson: [Phil's 18 holes with par, net, points]
   │       └─ gameResultsJson: { nassau: {...}, skins: {...} }
   │
   └─> IndividualRound table (CREATE 2 records)
       ├─ Tiger's IndividualRound
       │   ├─ courseId: "dcc"
       │   ├─ teeName: "Blue"
       │   ├─ courseRating: 72.3
       │   ├─ slopeRating: 130
       │   ├─ eventId: "abc123"  ← NEW! Links back to event
       │   └─ scoresJson: [Tiger's 18 holes raw strokes]
       │
       └─ Phil's IndividualRound
           ├─ courseId: "dcc"
           ├─ teeName: "Blue"
           ├─ courseRating: 72.3
           ├─ slopeRating: 130
           ├─ eventId: "abc123"  ← NEW! Links back to event
           └─ scoresJson: [Phil's 18 holes raw strokes]
```

---

## Why Three Different Places?

### 1. **Event.scorecardsJson** - Active Round Data
- **Purpose**: Real-time collaborative scoring
- **Lifecycle**: Created → Updated frequently → Archived when completed
- **Size**: Grows as scores are entered
- **Used By**: Scorecard page, live score display, game calculations

### 2. **CompletedRound.holeScoresJson** - Event History
- **Purpose**: Post-round analytics, game results, money tracking
- **Lifecycle**: Created once at completion → Never modified
- **Size**: Full round data + game results + stats
- **Used By**: Analytics page (game totals), History tab, Results page

### 3. **IndividualRound.scoresJson** - Handicap Tracking
- **Purpose**: WHS handicap index calculations
- **Lifecycle**: Created at completion OR manual entry → Never modified
- **Size**: Minimal (just gross scores + course data)
- **Used By**: Analytics page (handicap graph), Handicap calculations

---

## Current Issue (Before Fix)

**Problem**: IndividualRounds created from events were being counted **twice** in Analytics:
1. Once as CompletedRound (with game results)
2. Once as IndividualRound (for handicap)

**Result**: 18 holes counted as 36 holes

**Solution**: Added `eventId` field to IndividualRound:
- When creating IndividualRound from completed event → set `eventId`
- In Analytics stats calculation → skip IndividualRounds that have `eventId`
- This way, event rounds are only counted once (via CompletedRound)
- Manual rounds (no `eventId`) are still counted via IndividualRound

---

## Querying Scorecard Data

### See all Event scorecards (active rounds)
```powershell
aws dynamodb scan `
  --table-name Event-o26pgbkew5c4fpgcps5tnf27ey-NONE `
  --projection-expression "id,#n,courseId,teeName,scorecardsJson" `
  --expression-attribute-names '{\"#n\":\"name\"}' `
  --output json
```

### See all CompletedRound scorecards (finished rounds)
```powershell
aws dynamodb scan `
  --table-name CompletedRound-o26pgbkew5c4fpgcps5tnf27ey-NONE `
  --projection-expression "golferId,courseName,teeName,finalScore,holeScoresJson" `
  --output json
```

### See all IndividualRound scorecards (handicap tracking)
```powershell
aws dynamodb scan `
  --table-name IndividualRound-o26pgbkew5c4fpgcps5tnf27ey-NONE `
  --projection-expression "profileId,courseId,teeName,grossScore,eventId,scoresJson" `
  --output json
```

---

## Summary

| Data | Table | Field | Contains |
|------|-------|-------|----------|
| **Active Event Scores** | Event | `scorecardsJson` | Hole-by-hole strokes (in progress) |
| **Course Info (Active)** | Event | `courseId`, `teeName` | Reference to course database |
| **Golfer Tees (Active)** | Event | `golfersJson` | Per-player tee selections |
| **Completed Round Scores** | CompletedRound | `holeScoresJson` | Hole-by-hole with par, net, points |
| **Course Info (Completed)** | CompletedRound | `courseId`, `courseName`, `teeName` | Snapshot at completion |
| **Game Results** | CompletedRound | `gameResultsJson` | Nassau, skins, money won/lost |
| **Handicap Round Scores** | IndividualRound | `scoresJson` | Hole-by-hole gross strokes |
| **Course Info (Handicap)** | IndividualRound | `courseId`, `teeName`, `courseRating`, `slopeRating` | Snapshot for calculations |
| **Event Link** | IndividualRound | `eventId` | Links to source event (if applicable) |

---

**Key Point**: Course database (`src/data/courses.ts`) is the **source of truth** for course layouts, pars, yardages, tee ratings, and slopes. The DynamoDB tables store **references** (`courseId`, `teeName`) and **snapshots** (ratings/slopes at time of play) to ensure data integrity even if course data is updated later.
