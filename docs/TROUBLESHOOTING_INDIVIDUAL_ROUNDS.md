# Troubleshooting: Phil Not Getting IndividualRound

**Issue**: Tiger (event owner) gets IndividualRound created, but Phil does not.

---

## Root Cause Analysis

### Why Tiger Gets a Round

In `completeEvent()`, IndividualRounds are only created for golfers who have **profiles in the local store**:

```typescript
// Line 1806 in store.ts
if (profile && event.course.courseId) {
  // Create IndividualRound...
}
```

- Tiger completes the event on **his device**
- Tiger's profile exists in **his local store**
- IndividualRound created for Tiger ✅
- Phil's profile **does NOT exist** in Tiger's local store
- No IndividualRound created for Phil ❌

### Why Phil SHOULD Get a Round

When Phil opens his app, `loadEventsFromCloud()` should:
1. Load the completed event from cloud
2. Find Phil's scorecard in the event
3. Generate IndividualRound for Phil
4. Add to Phil's profile

This should happen automatically when Phil refreshes the app.

---

## Debugging Steps

### Step 1: Verify Cloud Sync is Enabled

Check console on Phil's device:
```
✅ Look for: "📥 loadEventsFromCloud: Loading events for profile: [Phil's ID]"
❌ If you see: "⚠️ loadEventsFromCloud: Cloud sync disabled"
```

**Fix**: Ensure `VITE_ENABLE_CLOUD_SYNC=true` in `.env` file

### Step 2: Check if Event is Loaded

Look for these console messages on Phil's device:
```
✅ "📥 loadEventsFromCloud: Loaded X events from cloud"
✅ "📥 loadEventsFromCloud: Active: 0, Completed: 1"
```

**If not showing**: Event might not be synced to cloud yet

### Step 3: Check Event Processing

New debug logs added - look for:
```
✅ "🔍 Processing completed event: [Event Name] for user: Phil eventGolfer found: true"
✅ "🔍 Scorecard found for user: true"
```

**If eventGolfer found: false**: Phil might not be in the event.golfers array
**If Scorecard found: false**: Phil's scorecard wasn't saved to the event

### Step 4: Check Course Data

Look for:
```
✅ "🔍 Checking IndividualRound for event: [Name] courseId: davenport-cc holesPlayed: 18"
✅ "🔍 Course tees found: true Tee found: true Looking for tee: Blue Tees"
```

**If Course tees found: false**: Course data not in local store
**If Tee found: false**: Tee name mismatch or tee doesn't exist

### Step 5: Check for Existing Round

Look for:
```
⏭️ "IndividualRound already exists for this event, skipping"
```

**If showing**: Round was already created, check `profile.individualRounds[]`

### Step 6: Check Final Creation

Look for:
```
✅ "Created IndividualRound for completed event: [Name] Differential: 9.2"
✅ "loadEventsFromCloud: Adding X individual rounds from cloud events"
```

**If not showing**: Something blocked the creation

---

## Common Issues

### Issue 1: Phil Not in Event Golfers

**Symptom**: `eventGolfer found: false`

**Check**:
```typescript
// In browser console on Phil's device:
const store = window.__ZUSTAND_STORE__;
const event = store.completedEvents[0];
console.log('Event golfers:', event.golfers);
// Look for Phil's profileId in the array
```

**Fix**: Event might not have Phil added properly. Check event creation.

### Issue 2: No Scorecard for Phil

**Symptom**: `Scorecard found: false`

**Check**:
```typescript
const event = store.completedEvents[0];
console.log('Scorecards:', event.scorecards);
// Look for scorecard with golferId matching Phil's profileId
```

**Fix**: Phil's scores might not have been saved. Check scorecard creation.

### Issue 3: Course Data Missing

**Symptom**: `Course tees found: false`

**Check**:
```typescript
const store = window.__ZUSTAND_STORE__;
const courses = store.courses; // This should be from courseData
console.log('Courses:', courses);
```

**Fix**: Course data not loaded. Check if `courseData` is imported in store.ts

### Issue 4: Tee Name Mismatch

**Symptom**: `Tee found: false`

**Check**:
```typescript
const event = store.completedEvents[0];
const philGolfer = event.golfers.find(g => g.name === 'Phil');
console.log('Phil tee name:', philGolfer.teeName);

// Compare with available tees:
const course = courses.find(c => c.id === event.course.courseId);
console.log('Available tees:', course.tees.map(t => t.name));
```

**Fix**: Ensure tee names match exactly (case-sensitive)

### Issue 5: Less than 14 Holes

**Symptom**: `needs14+: false`

**Check**:
```typescript
const scorecard = event.scorecards.find(sc => sc.golferId === philProfileId);
const holesPlayed = scorecard.scores.filter(s => s.strokes != null).length;
console.log('Holes played:', holesPlayed);
```

**Fix**: Play at least 14 holes for WHS compliance

---

## Manual Test Procedure

### On Tiger's Device (Event Owner):

1. Open browser console (F12)
2. Complete the event
3. Look for:
   ```
   ✅ completeEvent: IndividualRound saved to cloud: [ID]
   ✅ completeEvent: Completed event saved to cloud: [EventID]
   ```
4. Verify event shows in History tab
5. Verify Tiger's round appears in Handicap screen

### On Phil's Device:

1. **Refresh the page** (important!)
2. Open browser console (F12)
3. Look for event loading sequence:
   ```
   📥 loadEventsFromCloud: Loading events for profile: [Phil ID]
   📥 loadEventsFromCloud: Loaded X events from cloud
   📥 loadEventsFromCloud: Active: X, Completed: X
   ```

4. Look for event processing:
   ```
   🔍 Processing completed event: [Event Name] for user: Phil eventGolfer found: true
   🔍 Scorecard found for user: true
   🔍 Checking IndividualRound for event: [Name] courseId: [ID] holesPlayed: 18
   🔍 Course tees found: true Tee found: true Looking for tee: [Tee Name]
   ✅ Created IndividualRound for completed event: [Name] Differential: X.X
   ```

5. Check Handicap screen - should show the round

6. Verify handicap index calculated

---

## Quick Fixes

### If Phil Doesn't See Event at All:

```typescript
// On Phil's device, in console:
import { loadUserEventsFromCloud } from './src/utils/eventSync';
const events = await loadUserEventsFromCloud();
console.log('All cloud events:', events);
// Check if the completed event is there
```

### Force Reload Events:

```typescript
// On Phil's device, in console:
const store = useStore.getState();
await store.loadEventsFromCloud();
console.log('Completed events:', store.completedEvents);
console.log('Phil individual rounds:', store.currentProfile.individualRounds);
```

### Manually Create IndividualRound (Temporary Workaround):

If all else fails, you can manually trigger the logic:

1. Find the completed event in Phil's store
2. Find Phil's scorecard
3. Use the handicap utility functions to calculate the round
4. Add to Phil's profile

(Not recommended - better to fix the automatic flow)

---

## Expected Console Output (Phil's Device)

**Success Case:**
```
📥 loadEventsFromCloud: Loading events for profile: phil-123
📥 loadEventsFromCloud: Loaded 1 events from cloud
📥 loadEventsFromCloud: Filtered to 1 events where user is a golfer
📥 loadEventsFromCloud: Active: 0, Completed: 1
🔍 Processing completed event: Sunday Match for user: Phil eventGolfer found: true
🔍 Scorecard found for user: true
✅ Created CompletedRound for completed event: Sunday Match Score: 76
🔍 Checking IndividualRound for event: Sunday Match courseId: davenport-cc holesPlayed: 18
🔍 Course tees found: true Tee found: true Looking for tee: Blue Tees
✅ Created IndividualRound for completed event: Sunday Match Differential: 9.2
✅ loadEventsFromCloud: Adding 0 active and 1 completed events
✅ loadEventsFromCloud: Adding 1 completed rounds from cloud events
✅ loadEventsFromCloud: Adding 1 individual rounds from cloud events
```

---

## Next Steps

1. **Try the test procedure above**
2. **Check console logs** on both devices
3. **Report back** which console messages you see/don't see
4. **Share any errors** in the console

With the enhanced logging, we should be able to pinpoint exactly where the flow breaks for Phil.

---

**TL;DR**: 
- Refresh Phil's app to trigger `loadEventsFromCloud()`
- Check browser console for the new debug messages
- Report back what you see so we can diagnose the issue

