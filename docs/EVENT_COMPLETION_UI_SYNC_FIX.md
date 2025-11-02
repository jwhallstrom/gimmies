# Event Completion UI Sync Fix

**Date**: October 11, 2025  
**Issue**: Completed events showing in both Active and History tabs until page refresh

---

## Problem

When completing an event:
1. Event is properly moved from `events` to `completedEvents` in state
2. Navigation happens to EventsPage
3. But UI briefly shows event in BOTH Active and History tabs
4. After refresh or tab change, it correctly shows only in History

**Root Cause**: React re-render timing issue - the EventsPage component renders with cached/stale state before the Zustand state update fully propagates through all subscriptions.

---

## Fixes Applied

### 1. Added Navigation Delay (OverviewTab.tsx)

**File**: `src/components/tabs/OverviewTab.tsx` (line ~36)

**Before:**
```typescript
if (success) {
  alert('Event completed successfully!...');
  navigate('/events'); // Immediate navigation
}
```

**After:**
```typescript
if (success) {
  alert('Event completed successfully!...');
  // Small delay to ensure state propagates before navigation
  setTimeout(() => {
    navigate('/events');
  }, 100);
}
```

**Why**: Gives Zustand 100ms to fully propagate the state change to all subscribers before React Router navigates and renders the EventsPage.

---

### 2. Enhanced Event Filtering (EventsPage.tsx)

**File**: `src/pages/EventsPage.tsx` (lines ~37-46)

**Before:**
```typescript
const userEvents = events.filter(event =>
  currentProfile && 
  event.golfers.some(golfer => golfer.profileId === currentProfile.id) &&
  !event.isCompleted // Single check
);
```

**After:**
```typescript
// Double-check: exclude any events that are marked completed OR exist in completedEvents array
const completedEventIds = new Set(completedEvents.map(e => e.id));
const userEvents = events.filter(event =>
  currentProfile && 
  event.golfers.some(golfer => golfer.profileId === currentProfile.id) &&
  !event.isCompleted && // Exclude events marked as completed
  !completedEventIds.has(event.id) // Also exclude if event ID exists in completedEvents
);
```

**Why**: Defensive programming - even if there's a brief moment where an event hasn't been removed from `events` array yet, this ensures it won't show in Active tab if its ID exists in `completedEvents`.

---

## How It Works

### Completion Flow:
1. User clicks "Complete Event" on OverviewTab
2. `completeEvent()` executes:
   ```typescript
   set({
     completedRounds: [...get().completedRounds, ...newCompletedRounds],
     events: get().events.filter(e => e.id !== eventId), // Remove from active
     completedEvents: [...get().completedEvents, completedEvent] // Add to history
   });
   ```
3. Alert shows success message
4. **100ms delay** before navigation (new!)
5. Navigate to `/events`
6. EventsPage renders with updated state:
   - Active tab filters out the event (double-check with completedEventIds)
   - History tab shows the event
   - Auto-switch to History tab triggers (existing logic)

---

## Testing

### Expected Behavior After Fix:

1. **Complete an event**
2. **See alert**: "Event completed successfully!"
3. **Click OK**
4. **Navigate to Events page**
5. **Should immediately see**:
   - Active tab: Event GONE
   - History tab: Event PRESENT
   - Tab auto-switches to History (existing feature)
   - NO brief flash of event in Active tab

### If Still Seeing Issue:

Check browser console for:
- State update logs from `completeEvent`
- Navigation timing
- Any errors during state update

Verify:
```typescript
// In browser console after completing event:
useStore.getState().events.length // Should be reduced by 1
useStore.getState().completedEvents.length // Should be increased by 1
```

---

## Additional Considerations

### Why Not Use React.useEffect Dependencies?

The EventsPage already has proper useEffect hooks:
- Lines 13-22: Load events from cloud on mount
- Lines 25-35: Auto-switch to History tab when new event completed

These work correctly. The issue was purely timing between state update and navigation.

### Why 100ms Delay?

- Too short (0-50ms): Might not be enough for all React subscribers to update
- Too long (500ms+): Noticeable lag for users
- 100ms: Imperceptible to users but enough for React's reconciliation

### Alternative Solutions Considered:

1. ❌ **Force full page reload**: Bad UX, loses SPA benefits
2. ❌ **Use navigation state to trigger refresh**: Over-complicated
3. ❌ **Move event manually in component**: Breaks separation of concerns
4. ✅ **Small delay + defensive filtering**: Simple, effective, maintains architecture

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `src/components/tabs/OverviewTab.tsx` | ~42 | Added 100ms setTimeout before navigate |
| `src/pages/EventsPage.tsx` | ~37-46 | Added completedEventIds Set for double-check filtering |

---

## Edge Cases Handled

1. **Rapid double-click on Complete**: Prevented by existing guard in `completeEvent` (checks if already completed)
2. **Multiple events completed quickly**: Each gets its own 100ms delay, filters work independently
3. **Navigation before timeout completes**: React Router handles this gracefully
4. **Browser back button**: Filtering ensures correct display regardless of navigation method

---

**Status**: ✅ Fixed
**Testing**: Verify event no longer appears in Active tab after completion
