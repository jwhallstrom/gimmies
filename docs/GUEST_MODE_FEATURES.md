# Guest Mode vs. Authenticated User Features

## Overview
Guest mode allows users to use the app locally without signing in. Authenticated mode unlocks cloud-based collaboration features.

---

## Feature Access Matrix

| Feature | Guest Mode | Authenticated Mode | Notes |
|---------|------------|-------------------|-------|
| **Core Golf Features** |
| Create Events | ✅ | ✅ | Local only vs. Cloud synced |
| Add Scores | ✅ | ✅ | |
| View Scorecards | ✅ | ✅ | |
| Track Handicap | ✅ | ✅ | Local only vs. Cloud synced |
| Game Calculations (Nassau, Skins) | ✅ | ✅ | |
| Analytics Dashboard | ✅ | ✅ | |
| Multiple Profiles | ✅ | ✅ | Local storage vs. Cloud storage |
| **Collaboration Features** |
| Share Events (generate code) | ❌ | ✅ | Requires cloud sync |
| Join Events by Code | ❌ | ✅ | Requires cloud sync |
| Real-time Score Updates | ❌ | ✅ | Requires cloud sync |
| Event Chat | ❌ | ✅ | Requires cloud sync |
| Cross-device Sync | ❌ | ✅ | Guest data stays on device |
| **Profile Features** |
| Profile Photos | ⚠️ | ✅ | Local file only vs. Cloud storage (S3) |
| Profile Sharing | ❌ | ✅ | |
| Friend Connections | ❌ | ✅ | Future feature |
| **Data Management** |
| Export Data | ✅ | ✅ | JSON export works for both |
| Import Data | ✅ | ✅ | |
| Backup to Cloud | ❌ | ✅ | |
| Data Persistence | ⚠️ | ✅ | LocalStorage vs. DynamoDB |

**Legend:**
- ✅ = Fully Available
- ❌ = Not Available (Hidden or Disabled)
- ⚠️ = Limited Functionality

---

## Implementation Strategy

### Phase 1: Add Guest Mode Toggle (Current State)
```tsx
// App.tsx - Update login logic
if (!amplifyUser && !currentUser) {
  return <LoginPage onSuccess={handleLoginSuccess} onGuestMode={handleGuestMode} />;
}
```

### Phase 2: Conditional UI Rendering
Create a hook to check authentication status:

```tsx
// hooks/useAuthMode.ts
export function useAuthMode() {
  const { getCurrentUser } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    checkAuth().then(user => setIsAuthenticated(!!user));
  }, []);
  
  return {
    isAuthenticated,
    isGuest: !isAuthenticated,
    canShare: isAuthenticated,
    canSync: isAuthenticated,
  };
}
```

### Phase 3: Component Updates

#### EventSharing.tsx
```tsx
const EventSharing: React.FC<Props> = ({ eventId }) => {
  const { isAuthenticated } = useAuthMode();
  
  if (!isAuthenticated) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-blue-800 text-sm">
          🔒 <strong>Sign in to unlock sharing!</strong>
          <br />
          Event sharing requires a cloud account to sync data across devices.
        </p>
        <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">
          Sign In to Share
        </button>
      </div>
    );
  }
  
  // ... existing sharing UI
};
```

#### EventsPage.tsx (for Join Event button)
```tsx
// Hide/disable "Join Event" button in guest mode
{isAuthenticated && (
  <button onClick={() => navigate('/join')}>
    Join Event
  </button>
)}
```

#### UserMenu.tsx
```tsx
// Show guest badge
{isGuest && (
  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
    Guest Mode
  </span>
)}
```

### Phase 4: Data Warnings
Add warnings when guest users might lose data:

```tsx
// Before creating important content
{isGuest && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-yellow-400" ...>⚠️</svg>
      </div>
      <div className="ml-3">
        <p className="text-sm text-yellow-700">
          You're in <strong>Guest Mode</strong>. Your data is only stored on this device.
          <br />
          <a href="#" className="underline font-medium">Sign in</a> to sync across devices and share with friends.
        </p>
      </div>
    </div>
  </div>
)}
```

---

## User Experience Flow

### Guest User Journey:
1. Open app → "Continue as Guest" or "Sign In"
2. Use all core features (create events, track scores, handicap)
3. See "Sign in to unlock" prompts on collaboration features
4. Easy upgrade path: "Sign In" button always visible

### Authenticated User Journey:
1. Sign in with email or Google
2. All features available
3. Data syncs across devices
4. Can share events and collaborate

---

## Future Enhancements

### Smart Upgrade Prompts
- After creating 3rd event: "Want to share this with friends? Sign in!"
- After 10 rounds tracked: "Protect your data! Sign in to backup to cloud"
- Before clearing browser data: "Warning: Guest data will be lost"

### Guest Data Migration
When guest upgrades to authenticated:
```tsx
async function migrateGuestData() {
  const localEvents = getLocalEvents();
  const localRounds = getLocalRounds();
  
  // Upload to cloud
  await Promise.all([
    uploadEvents(localEvents),
    uploadRounds(localRounds),
  ]);
  
  // Clear local-only flag
  setMigrated(true);
}
```

---

## Implementation Checklist

- [ ] Add "Continue as Guest" button to LoginPage
- [ ] Create `useAuthMode()` hook
- [ ] Update EventSharing component with guest restrictions
- [ ] Hide "Join Event" feature for guests
- [ ] Add guest mode badge to UserMenu
- [ ] Add upgrade prompts to key features
- [ ] Test guest mode data persistence
- [ ] Test authenticated mode cloud sync
- [ ] Add data migration flow (guest → authenticated)
- [ ] Update documentation

---

## Technical Notes

### Data Storage
- **Guest Mode**: IndexedDB (Dexie) + LocalStorage
- **Authenticated**: DynamoDB + IndexedDB cache

### Authentication Check
```tsx
const isGuest = !amplifyUser;
const isAuthenticated = !!amplifyUser;
```

### Environment Variable
```env
VITE_ENABLE_CLOUD_SYNC=true  # Controls cloud features
```

Currently this is always true. Could make it dynamic:
```tsx
const cloudEnabled = import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && isAuthenticated;
```
