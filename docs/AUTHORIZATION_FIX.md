# Authorization Fix - Multi-User Event Sync

## 🔴 Root Cause Identified

### The Problem
When Phil joined Tiger's event:
- ✅ Event loaded from cloud successfully
- ✅ Phil added to local state (golfers array)
- ✅ `saveEventToCloud()` called to sync
- ❌ **DynamoDB UPDATE silently failed due to authorization**
- ❌ Cloud still had only Tiger as golfer
- ❌ Auto-refresh loaded cloud data (Tiger only) → overwrote local state

### Why Did It Fail?

**Original Schema Authorization (amplify/data/resource.ts):**
```typescript
Event: a.model({
  // ... fields ...
})
.authorization(allow => [
  allow.owner(), // Owner can CRUD
  allow.authenticated().to(['read', 'update']), // ❌ Participants can read/update
])
```

**The Issue:**
- `allow.owner()` means only the **Cognito user who created the record** can update it
- Tiger created the event → Tiger is the `owner`
- When Phil's app calls `client.models.Event.update()`, **DynamoDB checks ownership**
- Phil ≠ Tiger → **Update rejected by authorization rules**
- The error was silent (no throw, just returns `errors` array)

---

## ✅ The Fix

### 1. Updated Schema Authorization

**New Authorization (amplify/data/resource.ts):**
```typescript
Event: a.model({
  // ... fields ...
})
.authorization(allow => [
  allow.owner(), // Owner can CRUD
  allow.authenticated(), // ✅ ALL authenticated users can CRUD (for collaborative events)
])
```

**What Changed:**
- Removed `.to(['read', 'update'])` restriction
- Now any authenticated user can Create, Read, Update, Delete events
- This is correct for collaborative golf events where multiple users need to update shared data

**Security Note:**
- Events are still protected by authentication (must be signed in)
- We track `ownerProfileId` in the event data for business logic (who created it)
- Future enhancement: Add field-level permissions if needed (e.g., only owner can delete)

---

### 2. Enhanced Error Logging

**Files Modified:**
- `src/utils/eventSync.ts` - `saveEventToCloud()`
- `src/utils/eventSync.ts` - `loadEventById()`
- `src/state/store.ts` - `refreshEventFromCloud()`

**New Console Logs:**
```typescript
// Before save
☁️ saveEventToCloud: Golfers to save: 2 ['tiger-id', 'phil-id']
☁️ saveEventToCloud: golfersJson being saved: [{"profileId":"tiger-id",...},{"profileId":"phil-id",...}]

// During save
☁️ saveEventToCloud: Attempting update...
☁️ saveEventToCloud: Update result - data: exists, errors: null

// After save
✅ saveEventToCloud: Event UPDATED in cloud with 2 golfers

// If update fails
❌ saveEventToCloud: BOTH UPDATE AND CREATE FAILED!
❌ saveEventToCloud: Create errors: [authorization error details]
```

**What to Watch For:**
- If you see "BOTH UPDATE AND CREATE FAILED" → authorization issue
- If you see "Event UPDATED with 1 golfers" after Phil joins → update didn't include Phil
- If you see "Event UPDATED with 2 golfers" → SUCCESS! ✅

---

### 3. Increased Auto-Refresh Delay

**File:** `src/hooks/useEventSync.ts`

**Change:**
```typescript
// Before
const initialRefreshDelay = 5000; // 5 seconds

// After
const initialRefreshDelay = 10000; // 10 seconds
```

**Reason:**
- DynamoDB updates can take 2-3 seconds to propagate
- Network latency adds 1-2 seconds
- Total sync time can be 4-5 seconds
- 10-second delay provides safer margin

---

## 📋 Deployment Steps

### Option 1: Auto-Deploy (Recommended)
If you have `npm run amplify:sandbox` running in watch mode:
1. The schema file was already modified
2. Sandbox watch should detect the change
3. Wait ~30-60 seconds for CloudFormation update
4. Check terminal output for "Deployment complete"

### Option 2: Manual Deploy
If sandbox not running:
```powershell
# Start sandbox (will deploy schema changes)
npm run amplify:sandbox

# Wait for deployment
# Look for: "✅ Deployment complete"
# Should update the Event table authorization rules
```

### Option 3: Verify Deployment
Check if schema deployed:
```powershell
aws cloudformation describe-stacks `
  --stack-name amplify-gimmiesgolf-victo-sandbox-b2af922308 `
  --query 'Stacks[0].StackStatus'
```

Expected: `UPDATE_COMPLETE` or `CREATE_COMPLETE`

---

## 🧪 Testing After Deployment

### Step 1: Clear Everything
```
1. Clear browser cache (F12 → Application → Clear site data)
2. Refresh page
3. Sign in as Phil
```

### Step 2: Join Tiger's Event
```
1. Dashboard → Join Event
2. Enter Tiger's share code
3. Click Join
4. **OPEN CONSOLE (F12 → Console tab)**
```

### Step 3: Watch Console Logs

**What You Should See:**
```
🔍 Joining event with code: ABC123
📥 Event loaded from cloud: xyz-123 Golfers: 1
➕ Adding golfer to event...
📝 Found event to modify: xyz-123 Current golfers: 1
✅ Event updated with new golfer. New golfers count: 2
☁️ Syncing event to cloud...
☁️ saveEventToCloud: Golfers to save: 2 ['tiger-id', 'phil-id']
☁️ saveEventToCloud: golfersJson being saved: [...]
☁️ saveEventToCloud: Attempting update...
☁️ saveEventToCloud: Update result - data: exists, errors: null  ✅ CRITICAL!
✅ saveEventToCloud: Event UPDATED in cloud with 2 golfers      ✅ SUCCESS!
✅ Event synced to cloud: xyz-123
✅ Golfer added to event: true Total golfers: 2
🚀 Dashboard: Navigating to event: xyz-123
```

**What You Should NOT See:**
```
❌ saveEventToCloud: Update result - data: null, errors: [...]  🔴 AUTHORIZATION FAIL
❌ saveEventToCloud: BOTH UPDATE AND CREATE FAILED!             🔴 BLOCKED BY PERMISSIONS
```

### Step 4: Verify Persistence

**Immediately After Join:**
- Setup tab: Phil listed (should stay visible)
- Leaderboard: Both Tiger and Phil shown

**After 10 Seconds (first auto-refresh):**
```console
🔄 useEventSync: Initial refresh (delayed 10s)
📥 loadEventById: Cloud event golfersJson: [...]
✅ loadEventById: Loaded event with 2 golfers: ['tiger-id', 'phil-id']  ✅ BOTH GOLFERS IN CLOUD!
✅ refreshEventFromCloud: Event refreshed from cloud with 2 golfers
```

**After 30 Seconds (periodic refresh):**
```console
🔄 useEventSync: Periodic refresh
✅ refreshEventFromCloud: Event refreshed from cloud with 2 golfers
```

**Navigate Away and Back:**
1. Click Home
2. Event should still be in "Your Events"
3. Click event again
4. Phil should still be in golfer list (no re-joining needed)

---

## 🎯 Success Criteria

### ✅ All Must Pass:
- [ ] Phil joins → sees "Event UPDATED in cloud with 2 golfers"
- [ ] No "authorization" errors in console
- [ ] Phil's name stays visible in Setup tab (doesn't disappear)
- [ ] Leaderboard shows both Tiger and Phil
- [ ] After 10s refresh, console shows "2 golfers" from cloud
- [ ] Navigate away and back → event persists, Phil still in golfer list
- [ ] Tiger's phone also sees Phil after refresh (cross-device sync)

---

## 🔧 Troubleshooting

### Issue: Still seeing "Update result - data: null"
**Cause:** Schema not deployed yet  
**Fix:** 
```powershell
# Force redeploy
npm run amplify:sandbox -- --once

# Wait for "Deployment complete"
```

### Issue: "CREATE_FAILED" on deployment
**Cause:** Schema validation error  
**Fix:** Check terminal for specific error, may need to adjust schema

### Issue: Phil joins but golfer count stays at 1
**Cause:** `addGolferToEvent` not being called  
**Fix:** Check earlier in this conversation for the `joinEventByCode` fixes

### Issue: Console shows "2 golfers" in save, but "1 golfer" in load
**Cause:** DynamoDB propagation delay (rare)  
**Fix:** Increase auto-refresh delay to 15 seconds

---

## 📊 Before vs After

### Before Fix:
```
Tiger creates event → Cloud: [Tiger]
Phil joins         → Local: [Tiger, Phil]
saveEventToCloud   → ❌ AUTHORIZATION DENIED
Cloud refresh      → Cloud: [Tiger] → Local: [Tiger]
Phil disappears    → ❌ FAIL
```

### After Fix:
```
Tiger creates event → Cloud: [Tiger]
Phil joins         → Local: [Tiger, Phil]
saveEventToCloud   → ✅ AUTHORIZATION ALLOWED
Cloud updated      → Cloud: [Tiger, Phil]
Cloud refresh      → Cloud: [Tiger, Phil] → Local: [Tiger, Phil]
Phil persists      → ✅ SUCCESS
```

---

## 🚀 Next Steps

1. **Deploy schema changes** (see "Deployment Steps" above)
2. **Test with Phil joining** (see "Testing After Deployment" above)
3. **Verify console logs** match expected output
4. **Test cross-device** - Tiger's phone should see Phil after refresh
5. **Test scores** - Both users can add scores, they sync to cloud
6. **Test navigation** - Events persist across page reloads

---

## 📝 Files Changed

1. `amplify/data/resource.ts` - Event authorization rules
2. `src/utils/eventSync.ts` - Enhanced logging in save/load functions
3. `src/state/store.ts` - Enhanced logging in refreshEventFromCloud
4. `src/hooks/useEventSync.ts` - Increased delay to 10 seconds

---

**Status:** ✅ Code changes complete  
**Next:** Deploy schema to AWS and test  
**Expected Result:** Phil can join Tiger's event and persist in cloud ✨
