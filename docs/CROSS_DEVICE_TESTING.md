# Cross-Device Event Sharing - Testing Guide

## 🎯 What We Just Built
- ✅ Cloud-based event storage in DynamoDB
- ✅ Share code generation saves to cloud
- ✅ Join event by code queries cloud (not just local storage)
- ✅ Cross-device/cross-user event sharing

## 📱 Test: Phone → PC Event Sharing

### Step 1: Create Event on Phone
1. Open app on phone: http://192.168.1.113:5173/ (or your local network IP)
2. Sign in with your existing account (or create new account)
3. Create a profile if prompted
4. Create a new event:
   - Click **+ New Event** button
   - Name: "Cross-Device Test Round"
   - Pick any date/course
   - Add yourself as golfer
   - **Save**
5. Click on the event to open details
6. Scroll to **"Share Event"** section
7. Click **"Generate Share Code"** button
8. **Write down the 6-character code** (e.g., `ABC123`)

### Step 2: Join Event on PC
1. Open app on PC: http://localhost:5173/
2. **Important:** Sign in with a **DIFFERENT account** (or create a new one)
   - This tests true cross-user sharing
   - Use a different email like `test2+share@yourdomain.com`
3. Create a profile for this second account
4. On Dashboard, click **"Join Event"** button
5. Enter the 6-character code from your phone
6. Click **"Join Event"**
7. **Expected Result:**
   - ✅ Success message: "Successfully joined the event!"
   - ✅ Event appears in your events list
   - ✅ You can see the event details
   - ✅ Your profile is added as a golfer

### Step 3: Verify Cross-Device Sync
1. On PC: Check that you can see the event from phone
2. On Phone: Refresh and verify the new golfer (PC account) is listed
3. Both devices should show the same event with both golfers

---

## 🔍 What to Check

### ✅ Success Indicators
- [ ] Share code generates successfully on phone
- [ ] Code is 6 characters (letters/numbers)
- [ ] PC can join event using the code
- [ ] Event appears on both devices
- [ ] Both users listed as golfers
- [ ] No errors in browser console

### ❌ Troubleshooting

**Error: "Event not found or share code is invalid"**
- Check that you're signed in on PC (not guest mode)
- Verify code is exactly 6 characters
- Check browser console for errors
- Verify sandbox is running: `npx ampx sandbox`

**Share code button doesn't work**
- Open browser DevTools → Console
- Look for error messages
- Check Network tab for failed GraphQL requests
- Verify `VITE_ENABLE_CLOUD_SYNC=true` in `.env.local`

**Event doesn't sync to PC**
- Wait 5-10 seconds and refresh
- Check that both accounts are authenticated (not guest)
- Verify internet connection

---

## 🧪 Advanced Testing

### Test 1: Same Account, Different Devices
1. Sign in with **same email** on both phone and PC
2. Create event on phone
3. Refresh PC → Event should appear automatically
4. This tests owner-based event loading

### Test 2: Multiple Users Join
1. Create event on phone
2. Join from PC (User 2)
3. Join from tablet/another browser (User 3)
4. All 3 users should see each other as golfers

### Test 3: Invalid Code Handling
1. Try joining with code `XXXXXX` (doesn't exist)
2. Should show: "Event not found or share code is invalid"

---

## 🐛 Known Limitations

### Current Implementation
- ✅ Events save to cloud
- ✅ Share codes work cross-device
- ✅ Users can join events
- ⏸️ Real-time updates (need GraphQL subscriptions)
- ⏸️ Chat not synced yet
- ⏸️ Score updates don't push to other devices yet

### Next Steps (After Testing)
1. Add GraphQL subscriptions for real-time updates
2. Sync chat messages to cloud
3. Push score updates across devices
4. Load all user events from cloud on login

---

## 📊 Console Logs to Watch

When generating share code, look for:
```
Saving event to cloud: <event-id>
✅ Event created in cloud with share code: ABC123
```

When joining event, look for:
```
Loading event from cloud with code: ABC123
✅ Event loaded from cloud: { id: ..., name: ... }
```

If you see errors, paste them and I'll help debug!

---

## 🚀 Ready to Test!

**Test this RIGHT NOW:**
1. Use your phone to create event and generate code
2. Use PC to join with that code
3. Report back with results! 🎯

If it works: 🎉 You have cross-device event sharing!
If it fails: 🔧 Send me the error messages and we'll fix it!
