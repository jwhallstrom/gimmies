# Testing Guide: Cloud Features & Guest Mode

## Test Session: Advanced Features
**Date:** October 5, 2025
**Status:** Ready to Test

---

## Prerequisites
✅ Dev server running at http://localhost:5173/
✅ Optional: Built preview running at http://localhost:4173/ (`npm run preview`)
✅ AWS Amplify sandbox deployed (us-east-1_IpbwW1NCP)
✅ Email/password auth working
✅ Guest mode working

---

## Test Suite 1: Guest Mode Restrictions

### Test 1.1: Guest Mode - Join Event Upgrade Prompt
**Goal:** Verify guest users see upgrade prompt instead of join form

**Steps:**
1. Clear browser storage (F12 → Application → Clear Storage → Clear site data)
2. Refresh http://localhost:5173/
3. Click **"👤 Guest"** tab on login screen
4. Enter name: "Test Guest"
5. Click **"Continue as Guest"**
6. Create a profile (any name)
7. On Dashboard, click **"Join Event"** button
8. **EXPECTED:** See upgrade prompt with:
   - 🔒 Lock icon
   - "Sign In to Share Events!" headline
   - List of benefits (join via codes, share events, real-time, chat, backup, multi-device)
   - "Sign In or Create Account" button
9. **NOT EXPECTED:** Code input form

**Pass Criteria:**
- ✅ Guest badge visible in top-right menu
- ✅ Join Event button shows lock icon 🔒
- ✅ Upgrade prompt appears (not code form)
- ✅ "Sign In or Create Account" button present

---

### Test 1.2: Guest Mode - Event Sharing Upgrade Prompt
**Goal:** Verify sharing section shows upgrade prompt for guests

**Steps:**
1. While still in guest mode, create an event:
   - Click **"+ New Event"** (floating button bottom-right)
   - Fill in event details, add yourself as golfer
   - Save event
2. Click on the event to view details
3. Scroll to **"Sharing"** or **"Share Event"** section
4. **EXPECTED:** See upgrade card with:
   - Gradient blue/green background
   - 🔒 Lock icon
   - "Sign In to Share Events!" headline
   - Benefits list
   - "Sign In or Create Account" CTA

**Pass Criteria:**
- ✅ No share code generation form visible
- ✅ Upgrade prompt with gradient background
- ✅ Clear benefits explanation

---

## Test Suite 2: Authenticated User - Event Sharing

### Test 2.1: Create Account & Generate Share Code
**Goal:** Test full event sharing flow for authenticated users

**Steps:**
1. Sign out from guest mode (click profile → Sign Out)
2. On login screen, stay on **"Full Account"** tab
3. Click **"Sign Up"** tab
4. Enter email: `test+share@yourdomain.com` (use + trick for testing)
5. Enter password: `TestPass123!`
6. Click **"Create Account"**
7. Check email for confirmation code (check spam!)
8. Enter 6-digit code
9. Auto-signed in → Create profile (name: "Share Tester")
10. Create a new event:
    - Name: "Share Test Round"
    - Add yourself as golfer
    - Save
11. Click event → Go to sharing section
12. Click **"Generate Share Code"** button
13. **EXPECTED:**
    - 6-character code appears (e.g., `ABC123`)
    - Share link appears with copy button
    - Code copy button works
    - Link copy button works

**Pass Criteria:**
- ✅ Share code generated successfully
- ✅ Code is 6 characters
- ✅ Copy buttons work (shows "Copied!" message)
- ✅ Share link format: `http://localhost:5173/join/ABC123`
- ✅ No "Guest" badge in menu

---

### Test 2.2: Join Event by Code (Same Browser)
**Goal:** Verify joining events works with valid code

**Steps:**
1. Copy the share code from previous test
2. Go to Dashboard
3. Click **"Join Event"** button
4. **EXPECTED:** Code input form appears (NOT upgrade prompt)
5. Enter the 6-character code
6. Click **"Join Event"** button
7. **EXPECTED:**
   - Success message: "Successfully joined the event!"
   - Modal closes
   - Event appears in your events list

**Pass Criteria:**
- ✅ Code input form visible for authenticated users
- ✅ Can enter 6-character code
- ✅ Success message on join
- ✅ Event added to user's events

---

### Test 2.3: Invalid Code Handling
**Goal:** Test error handling for invalid codes

**Steps:**
1. Click **"Join Event"** again
2. Enter invalid code: `XXXXXX`
3. Click **"Join Event"**
4. **EXPECTED:** Error message: "Invalid or expired share code."

**Pass Criteria:**
- ✅ Error message displays
- ✅ User not added to random event
- ✅ Modal stays open for retry

---

## Test Suite 3: Profile Cloud Sync

### Test 3.1: Profile Update Persistence
**Goal:** Verify profile changes sync to cloud

**Steps:**
1. While signed in, click profile menu → **"Edit Profile"** or **"Manage Profile"**
2. Update profile:
   - Change name to "Updated Tester"
   - Set handicap index: `15.5`
   - Set preferred tee: "White"
3. Save changes
4. Open browser DevTools → Console
5. Look for: `Saving profile to cloud:` log
6. Sign out
7. Sign back in with same credentials
8. **EXPECTED:** Profile loads with updated values:
   - Name: "Updated Tester"
   - Handicap: 15.5
   - Tee: "White"

**Pass Criteria:**
- ✅ Profile updates save successfully
- ✅ Sign out → Sign in → Data persists
- ✅ Console logs show cloud save operation

---

## Test Suite 4: Multi-Device Simulation (Advanced)

### Test 4.1: Incognito Window Test
**Goal:** Simulate cross-device sync

**Steps:**
1. Keep current browser window open (signed in)
2. Open new **Incognito/Private window**
3. Go to http://localhost:5173/
4. Sign in with **same email/password**
5. **EXPECTED:** Profile loads with same data
6. In incognito: Create a new event "Multi-Device Test"
7. In original window: Refresh page
8. **EXPECTED:** New event appears (may require manual refresh)

**Pass Criteria:**
- ✅ Same profile loads in both windows
- ✅ Events created in one window visible after refresh in other

---

## Test Suite 5: Guest → Authenticated Upgrade Flow

### Test 5.1: Seamless Upgrade Path
**Goal:** Test upgrading from guest to authenticated

**Steps:**
1. Clear browser storage
2. Start in guest mode, create profile "Guest Upgrader"
3. Create 2-3 local events
4. Try to share an event → See upgrade prompt
5. Click **"Sign In or Create Account"** button
6. **EXPECTED:** Redirected to login screen
7. Sign up with new account
8. **RESULT:** Old guest data stays local (future enhancement: migration)

**Pass Criteria:**
- ✅ Upgrade button redirects to login
- ✅ Can create new account
- ✅ New account starts fresh (guest data separate for now)

---

## Bug Reporting Template

If you find issues, report with this format:

**Bug:** [Short description]
**Steps to Reproduce:**
1. ...
2. ...

**Expected:** ...
**Actual:** ...
**Browser:** Chrome/Firefox/etc
**Console Errors:** [Paste any errors]

---

## Success Metrics

**Minimum Passing:**
- ✅ Guest mode shows upgrade prompts (not functional forms)
- ✅ Authenticated users can generate share codes
- ✅ Authenticated users can join events by code
- ✅ Profile updates persist after sign out/in

**Bonus Points:**
- ✅ Multi-device sync works
- ✅ Error messages are clear
- ✅ UI is smooth and responsive

---

## Quick Test Checklist

Use this for rapid testing:

- [ ] Guest mode: Join Event → Upgrade prompt ✅
- [ ] Guest mode: Share Event → Upgrade prompt ✅
- [ ] Guest badge visible in menu ✅
- [ ] Auth user: Generate share code ✅
- [ ] Auth user: Join by code ✅
- [ ] Auth user: Invalid code error ✅
- [ ] Profile update → Sign out → Sign in → Persists ✅
- [ ] Multi-device: Same profile loads ✅

---

## Running E2E Tests

### Dev Server Mode (fast iteration)
```bash
npm run e2e
```

### Preview/Prod Bundle Mode (closer to production)
```bash
npm run build
npm run e2e:preview
```


---

**Ready to start testing!** 🧪

Work through Test Suite 1 first (Guest Mode), then move to Suite 2 (Sharing).
Report any bugs you find and we'll fix them on the fly!
