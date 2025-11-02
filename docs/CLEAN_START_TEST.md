# Clean Start Testing - After Authorization Fix

## 🔴 Why You Need a Clean Start

**Problem:**
- Tiger created "The Masters" event BEFORE the authorization fix
- Old event has old data structure in DynamoDB
- Even with new code, old cloud data is incompatible
- Need to delete old event and create fresh

---

## 📋 Clean Start Procedure

### **Step 1: Delete Old Event (Both Devices)**

#### On Tiger's Phone:
```
1. Open Gimmies Golf app
2. Go to Dashboard (Home icon)
3. Find "The Masters" event
4. Click the event
5. Look for Delete/Remove button (usually in setup or menu)
6. Delete the event
7. Confirm deletion
```

#### On Phil's PC:
```
1. Open Gimmies Golf app (localhost:5173)
2. Go to Dashboard
3. If "The Masters" appears, delete it
4. Otherwise, skip (Phil might not have it anymore)
```

**What This Does:**
- ✅ Deletes from local storage (browser)
- ✅ Deletes from DynamoDB cloud (with new code)
- ✅ Clears old data structures

---

### **Step 2: Clear Browser Cache (Both Devices)**

#### Tiger's Phone (iOS Safari/Chrome):
```
Safari:
1. Settings → Safari → Clear History and Website Data
2. Or: Long-press reload button → Empty Cache

Chrome:
1. Chrome → Settings → Privacy → Clear Browsing Data
2. Select "Cached Images and Files"
3. Clear
```

#### Phil's PC (Chrome/Edge):
```
1. F12 to open DevTools
2. Application tab
3. Storage section (left sidebar)
4. "Clear site data" button
5. Confirm
6. Close DevTools
7. Hard refresh: Ctrl+Shift+R (or Ctrl+F5)
```

---

### **Step 3: Create Fresh Event (Tiger's Phone)**

```
1. Sign in as Tiger (should still be signed in)
2. Dashboard → "+ New Event" button
3. Fill in event details:
   - Event Name: "Test Sync Event"
   - Date: Today (10/05/2025)
   - Course: Davenport Country Club
   - Tee: White
4. Click "Create Event"
5. Event opens to Setup tab
6. Add Tiger as golfer:
   - Select tee: Event Tee (White) or choose another
   - Handicap: 12.5 (or whatever)
   - Click Add
7. **CRITICAL:** Note the Share Code
   - Look for "Share Code: ABC123" somewhere in Setup tab
   - Write it down or screenshot it
```

**What to Verify:**
- Tiger appears in golfers list ✅
- Share code is visible ✅
- Event is created with NEW schema ✅

---

### **Step 4: Phil Joins Fresh Event (PC)**

```
1. Clear cache if not done already (see Step 2)
2. Refresh page (Ctrl+F5)
3. Sign in as Phil
4. F12 → Open Console tab (IMPORTANT: Watch logs!)
5. Dashboard → "Join Event" button
6. Enter Tiger's share code
7. Click "Join"
```

**Watch Console Logs:**
```console
🔍 Joining event with code: ABC123
📥 Event loaded from cloud: xxx-yyy-zzz Golfers: 1
📝 Adding event to local state
➕ Adding golfer to event...
📝 Found event to modify: xxx-yyy-zzz Current golfers: 1
👤 Creating EventGolfer: { profileId: 'phil-id' }
✅ Event updated with new golfer. New golfers count: 2
☁️ Syncing event to cloud...
☁️ saveEventToCloud: Golfers to save: 2 ['tiger-id', 'phil-id']
☁️ saveEventToCloud: golfersJson being saved: [{"profileId":"tiger-id",...},{"profileId":"phil-id",...}]
☁️ saveEventToCloud: Attempting update...
☁️ saveEventToCloud: Update result - data: exists, errors: null  ✅ SUCCESS!
✅ saveEventToCloud: Event UPDATED in cloud with 2 golfers
✅ Event synced to cloud: xxx-yyy-zzz
✅ addGolferToEvent complete
✅ Golfer added to event: true Total golfers: 2
🚀 Dashboard: Navigating to event: xxx-yyy-zzz
```

**Expected Behavior:**
- Phil's name appears in Setup tab golfers list ✅
- Leaderboard shows both Tiger 🔥 and Phil ✅
- No authorization errors in console ✅

---

### **Step 5: Verify Persistence (Phil's PC)**

```
1. Wait 10 seconds (auto-refresh delay)
2. Check console for refresh log:
   🔄 useEventSync: Initial refresh (delayed 10s)
   📥 loadEventById: Loaded event with 2 golfers: ['tiger-id', 'phil-id']
   ✅ refreshEventFromCloud: Event refreshed from cloud with 2 golfers
3. Phil should STILL be visible in golfers list (doesn't disappear!)
4. Click "Home" to navigate away
5. Event should appear in "Your Events" list
6. Click event again to open it
7. Phil should still be in golfers list (no re-join needed)
```

**Success Criteria:**
- ✅ Phil's name stays visible (doesn't vanish after 3 seconds)
- ✅ Console shows "2 golfers" from cloud refresh
- ✅ Event persists after navigation

---

### **Step 6: Cross-Device Verification (Tiger's Phone)**

```
1. On Tiger's phone, navigate away from event (back to Dashboard)
2. Wait 30 seconds (periodic refresh interval)
3. Open the event again
4. Check Setup tab golfers list
5. Should see BOTH:
   - Tiger (yourself)
   - Phil (joined user)
```

**If Tiger Doesn't See Phil:**
```
1. Pull down to refresh (if app has pull-to-refresh)
2. Or close app completely and reopen
3. Navigate to event
4. Check Setup tab again
5. If still only Tiger, check console logs on Phil's PC for authorization errors
```

---

## 🎯 Complete Success Checklist

### ✅ All Must Pass:
- [ ] Old "The Masters" event deleted from both devices
- [ ] Browser cache cleared on both devices
- [ ] Tiger creates fresh "Test Sync Event"
- [ ] Tiger added to golfers, share code visible
- [ ] Phil joins using share code
- [ ] Console shows: "Event UPDATED in cloud with 2 golfers"
- [ ] No authorization errors (no "data: null" in update result)
- [ ] Phil appears in Setup tab golfers list
- [ ] Leaderboard shows both Tiger and Phil
- [ ] After 10s refresh, Phil still visible (doesn't disappear)
- [ ] Phil navigates away and back → still in golfers list
- [ ] Tiger's phone refreshes → sees Phil in golfers list

---

## 🔴 Troubleshooting

### Issue: Can't find delete button
**Solution:** In Dashboard, long-press or swipe event card, or look for 3-dot menu

### Issue: Share code not visible in Setup tab
**Location:** Usually near top of Setup tab, looks like:
```
Event Sharing
Share Code: AB12CD
```

### Issue: Console shows "Update result - data: null"
**Cause:** Authorization still not working OR event not in cloud  
**Fix:** 
1. Verify schema deployed (check earlier terminal output)
2. Delete event and create brand new one
3. Ensure Tiger created it while signed in (not guest mode)

### Issue: Console shows "Event UPDATED with 1 golfers"
**Cause:** `addGolferToEvent` not working correctly  
**Fix:** Check if Phil's profileId is valid, verify he's signed in (not guest)

### Issue: Phil sees both golfers, then only himself after refresh
**Cause:** Tiger's event update failed, cloud has only Tiger  
**Fix:** 
1. Check Tiger's console (if accessible on phone)
2. Tiger should update event (add a score) to trigger cloud sync
3. Both devices refresh

### Issue: Tiger never sees Phil on his phone
**Cause:** No auto-refresh on phone, or Tiger's app not pulling cloud data  
**Fix:**
1. Add manual refresh button (future enhancement)
2. Navigate away and back to trigger load
3. Close and reopen app

---

## 📊 What Changed vs Old Event

### Old "The Masters" Event (Before Fix):
```
- Created before authorization fix
- Phil tried to join → authorization denied
- Cloud only had Tiger
- Auto-refresh removed Phil from local state
- ❌ Multi-user sync failed
```

### New "Test Sync Event" (After Fix):
```
- Created after authorization fix ✅
- Phil joins → authorization allowed ✅
- Cloud updated with both Tiger and Phil ✅
- Auto-refresh keeps both golfers ✅
- ✅ Multi-user sync working!
```

---

## 🚀 After Successful Test

Once both Tiger and Phil can see each other:

### Test Scorecard Sync:
```
1. Tiger adds score on hole 1: 4
2. Wait 30 seconds (or Phil manually refreshes)
3. Phil should see Tiger's score on hole 1
4. Phil adds score on hole 1: 5
5. Tiger refreshes → sees Phil's score
```

### Test Leaderboard:
```
1. Both add a few hole scores
2. Leaderboard should update for both users
3. Positions calculate correctly (lowest score first)
4. Scores sync between devices
```

### Test Games Tab:
```
1. Tiger creates Nassau game (as event owner)
2. Phil refreshes → sees Nassau game (read-only)
3. Games update based on scores
4. Payouts show both players
```

---

**Status:** Ready for clean start testing  
**Next:** Delete old event, create fresh, test multi-user sync  
**Expected:** Both users see each other in golfers list ✨
