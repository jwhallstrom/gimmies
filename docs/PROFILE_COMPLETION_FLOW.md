# 📝 Profile Completion Flow - Technical Documentation

## Overview

After OAuth authentication (Google, Apple, Facebook, etc.), users are prompted to complete their profile if it doesn't exist yet. This ensures we have the necessary information for scorecards, leaderboards, and handicap tracking.

---

## 🔄 Authentication Flow

```
┌──────────────────────────────────────────────────────┐
│  1. User clicks "Continue with Google"                │
├──────────────────────────────────────────────────────┤
│  2. Redirects to Google OAuth                        │
├──────────────────────────────────────────────────────┤
│  3. User approves → Returns to app                   │
├──────────────────────────────────────────────────────┤
│  4. AWS Cognito creates auth user                    │
│     ✓ userId: "abc-123-def"                         │
│     ✓ email: "user@gmail.com"                       │
│     ✓ name: "John Smith" (from Google)              │
├──────────────────────────────────────────────────────┤
│  5. AuthContext checks for existing profile         │
│     → Query: profiles.find(p => p.userId === userId) │
├──────────────────────────────────────────────────────┤
│  6a. Profile EXISTS                                  │
│      → Navigate to dashboard                         │
├──────────────────────────────────────────────────────┤
│  6b. Profile DOES NOT EXIST                          │
│      → Show ProfileCompletion screen                 │
│      → User enters profile name OR first/last        │
│      → Create profile → Navigate to dashboard        │
└──────────────────────────────────────────────────────┘
```

---

## 🎨 Profile Completion Screen

### **Two Entry Modes**

Users can choose how they want to set up their profile:

#### **Mode 1: Profile Name (Simple)**
```
┌──────────────────────────────────┐
│  Complete Your Profile           │
├──────────────────────────────────┤
│  [Profile Name] [Full Name]      │
│   ↑ Active                       │
├──────────────────────────────────┤
│  Profile Name: *                 │
│  [Tiger_________________]        │
│                                  │
│  This is how you'll appear       │
│  on scoreboards                  │
├──────────────────────────────────┤
│  Email:                          │
│  user@gmail.com (from Google)    │
├──────────────────────────────────┤
│  [Start Playing Golf! ⛳]        │
└──────────────────────────────────┘
```

**Result:**
```typescript
{
  id: "xyz-789",
  userId: "abc-123-def",
  name: "Tiger",          // Used for display
  firstName: undefined,
  lastName: undefined,
  email: "user@gmail.com"
}
```

#### **Mode 2: Full Name (Detailed)**
```
┌──────────────────────────────────┐
│  Complete Your Profile           │
├──────────────────────────────────┤
│  [Profile Name] [Full Name]      │
│                  ↑ Active        │
├──────────────────────────────────┤
│  First Name: *                   │
│  [John_________________]         │
│                                  │
│  Last Name: *                    │
│  [Smith________________]         │
│                                  │
│  Your full name will be used     │
│  for official records            │
├──────────────────────────────────┤
│  Email:                          │
│  user@gmail.com (from Google)    │
├──────────────────────────────────┤
│  [Start Playing Golf! ⛳]        │
└──────────────────────────────────┘
```

**Result:**
```typescript
{
  id: "xyz-789",
  userId: "abc-123-def",
  name: "John Smith",     // firstName + lastName
  firstName: "John",
  lastName: "Smith",
  email: "user@gmail.com"
}
```

---

## 📊 Data Structure

### **AWS Cognito (Authentication)**
```typescript
{
  userId: "abc-123-def",              // Auto-generated
  username: "google_123456789",       // From OAuth
  email: "user@gmail.com",            // From Google
  email_verified: true,
  identities: [{
    providerName: "Google",
    userId: "123456789",
    providerType: "Google"
  }]
}
```

### **Your Profile Store (Application)**
```typescript
{
  id: "xyz-789",                      // Your profile ID
  userId: "abc-123-def",              // Links to Cognito
  name: "Tiger" | "John Smith",       // Display name
  firstName: "John" | undefined,      // Optional
  lastName: "Smith" | undefined,      // Optional
  email: "user@gmail.com",            // From OAuth
  avatar: undefined,                  // Can add later
  handicapIndex: undefined,           // Can add later
  stats: {
    roundsPlayed: 0,
    averageScore: 0,
    bestScore: 0,
    totalBirdies: 0,
    totalEagles: 0
  },
  preferences: {
    theme: 'auto',
    defaultNetScoring: false,
    autoAdvanceScores: true,
    showHandicapStrokes: true
  },
  createdAt: "2025-10-04T...",
  lastActive: "2025-10-04T..."
}
```

---

## 🔧 Implementation Details

### **AuthContext Integration**

```typescript
// src/contexts/AuthContext.tsx
const fetchUser = async () => {
  const currentUser = await getCurrentUser();
  
  // Check if profile exists
  const hasProfile = profiles.some(p => p.userId === currentUser.userId);
  setNeedsProfileCompletion(!hasProfile);
  
  if (hasProfile) {
    // Load existing profile
    const profile = profiles.find(p => p.userId === currentUser.userId);
    useStore.getState().setCurrentProfile(profile.id);
  }
};
```

### **App.tsx Usage**

```typescript
// src/pages/App.tsx
const { user, loading, needsProfileCompletion, completeProfile } = useAuth();

if (loading) return <LoadingSpinner />;

if (!user) {
  // Not authenticated - show login
  return <LoginPage />;
}

if (needsProfileCompletion) {
  // Authenticated but no profile - show completion
  return (
    <ProfileCompletion
      userId={user.userId}
      email={user.email}
      suggestedName={user.name} // From Google OAuth
      onComplete={completeProfile}
    />
  );
}

// All good - show main app
return <Dashboard />;
```

---

## 🎯 Why Two Modes?

### **Profile Name Mode** (Simple)
**Use Case:**
- Casual players
- Quick setup
- Nickname/username style
- One field to fill

**Example:**
- "Tiger"
- "BigDrive"
- "ChipMaster"
- "Rory"

### **Full Name Mode** (Detailed)
**Use Case:**
- Formal tracking
- GHIN integration
- Tournament play
- Official records

**Example:**
- "Tiger Woods"
- "Phil Mickelson"
- "Rory McIlroy"

---

## 🔐 Security & Privacy

### **What OAuth Providers Give You**

| Provider | Email | Name | Photo | Phone |
|----------|-------|------|-------|-------|
| Google   | ✅    | ✅   | ✅    | ❌    |
| Apple    | ✅*   | ✅*  | ❌    | ❌    |
| Facebook | ✅    | ✅   | ✅    | Maybe |

*Apple allows users to hide email/name

### **Data Privacy**
- ✅ OAuth data stored in AWS Cognito (secure)
- ✅ Profile data in your DynamoDB (your control)
- ✅ No passwords stored (OAuth handles auth)
- ✅ Users can update profile anytime
- ✅ Can delete account (removes all data)

---

## 📱 User Experience

### **First Time User (Google Sign-In)**
```
1. Click "Continue with Google"          [2 seconds]
2. Google popup → Select account         [3 seconds]
3. Return to app                         [1 second]
4. "Complete Your Profile" screen        [Appears]
5. Enter "Tiger" → Submit                [5 seconds]
6. Navigate to Dashboard                 [Done!]

Total: ~11 seconds from click to dashboard
```

### **Returning User**
```
1. Click "Continue with Google"          [2 seconds]
2. Google popup → Auto-select           [1 second]
3. Return to app → Dashboard            [1 second]

Total: ~4 seconds (no profile completion needed!)
```

---

## 🎨 Design Consistency

The ProfileCompletion screen matches your existing design:
- ✅ Golf course background (`/File_000.jpeg`)
- ✅ Transparent card (`bg-white/75 backdrop-blur-sm`)
- ✅ Green buttons (`bg-primary-600`)
- ✅ Same fonts and spacing
- ✅ Mobile responsive
- ✅ Consistent with LoginPage

---

## 🚀 Future Enhancements

Potential additions to profile completion:

```typescript
// Optional fields to add later:
- Photo upload
- Handicap entry
- Home course selection
- Preferred tee selection
- Notification preferences
- Privacy settings
```

---

## ✅ Summary

**Profile Completion ensures:**
- ✓ Every authenticated user has a profile
- ✓ Scorecards show proper names
- ✓ Leaderboards work correctly
- ✓ Handicap tracking is attributed properly
- ✓ User has control over display name
- ✓ Flexible: simple nickname OR full name
- ✓ Seamless OAuth integration
- ✓ Beautiful, consistent UI

**The flow is automatic, fast, and user-friendly!** ⛳
