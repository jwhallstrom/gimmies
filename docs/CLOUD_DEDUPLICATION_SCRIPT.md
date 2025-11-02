# Cloud IndividualRounds Deduplication Script

**Problem**: Duplicate IndividualRounds exist in the cloud database (DynamoDB) from the previous bug.

**Solution**: Run this script from the browser console to clean up cloud duplicates.

---

## How to Use

1. **Open Browser Console** (F12) while logged in as Phil
2. **Copy and paste** the script below
3. **Press Enter** to run
4. **Refresh the page** to see clean data

---

## The Script

```javascript
// Deduplicate Phil's IndividualRounds in cloud database
(async function deduplicatePhilRounds() {
  console.log('🧹 Starting cloud deduplication...');
  
  // Get current profile ID
  const store = window.useStore.getState();
  const currentProfile = store.currentProfile;
  
  if (!currentProfile) {
    console.error('❌ No profile found. Please make sure you are logged in.');
    return;
  }
  
  console.log('Current profile:', currentProfile.name, currentProfile.id);
  
  // Import the deduplication function
  const { deduplicateCloudRounds } = await import('./utils/roundSync.js');
  
  // Run deduplication
  const result = await deduplicateCloudRounds(currentProfile.id);
  
  console.log('✅ Deduplication complete!');
  console.log(`  - Kept: ${result.kept} unique rounds`);
  console.log(`  - Removed: ${result.removed} duplicates`);
  console.log('');
  console.log('🔄 Refreshing page to reload clean data...');
  
  // Clear local storage and reload
  const profiles = store.profiles.map(p => ({
    ...p,
    individualRounds: []
  }));
  store.setState({ profiles });
  
  setTimeout(() => location.reload(), 1000);
})();
```

---

## What It Does

1. **Gets current profile ID** from Zustand store
2. **Loads all IndividualRounds** from cloud for that profile
3. **Groups rounds** by unique key: `date + courseId + teeName`
4. **Keeps first occurrence** of each unique round
5. **Deletes duplicates** from DynamoDB
6. **Clears local storage** rounds
7. **Reloads page** to fetch clean data from cloud

---

## Expected Output

```
🧹 Starting cloud deduplication...
Current profile: Phil 1234-5678-...
Loading individual rounds from cloud for profile: 1234-5678-...
Loaded 4 individual rounds from cloud
Found 4 total rounds in cloud
Found 2 unique rounds, 2 duplicates to remove
Deleting duplicate round: Oct 7, 2025 at Davenport (Blue)
Deleting individual round from cloud: abc123...
Individual round deleted successfully
Deleting duplicate round: Oct 7, 2025 at Davenport (Blue)
Deleting individual round from cloud: def456...
Individual round deleted successfully
✅ Deduplication complete: Kept 2, Removed 2
✅ Deduplication complete!
  - Kept: 2 unique rounds
  - Removed: 2 duplicates

🔄 Refreshing page to reload clean data...
```

---

## After Running

The page will reload and you should see:

- **4 Individual Rounds** → **2 Individual Rounds**
- Only one entry for each event (Master2, Masters 4)
- Console shows: `✅ loadEventsFromCloud: No new events to add`
- Handicap page shows 2 unique rounds

---

## If Script Fails

### Error: "Cannot import from './utils/roundSync.js'"

The import path may need adjustment. Try this alternative:

```javascript
// Alternative: Call cloud client directly
(async function deduplicatePhilRounds() {
  const { generateClient } = await import('aws-amplify/data');
  
  const store = window.useStore.getState();
  const currentProfile = store.currentProfile;
  
  console.log('Loading rounds from cloud...');
  const client = generateClient();
  
  const { data: cloudRounds, errors } = await client.models.IndividualRound.list({
    filter: { profileId: { eq: currentProfile.id } },
  });
  
  if (errors) {
    console.error('Error loading rounds:', errors);
    return;
  }
  
  console.log(`Found ${cloudRounds.length} rounds in cloud`);
  
  // Group by unique key
  const seen = new Set();
  const toDelete = [];
  
  cloudRounds.forEach(round => {
    const key = `${round.date}|${round.courseId}|${round.teeName}`;
    if (seen.has(key)) {
      toDelete.push(round);
      console.log(`Marking duplicate: ${round.date} at ${round.courseId}`);
    } else {
      seen.add(key);
    }
  });
  
  console.log(`Deleting ${toDelete.length} duplicates...`);
  
  // Delete duplicates
  for (const round of toDelete) {
    await client.models.IndividualRound.delete({ id: round.id });
    console.log(`Deleted round ${round.id}`);
  }
  
  console.log(`✅ Removed ${toDelete.length} duplicates, kept ${seen.size} unique rounds`);
  
  // Clear local and reload
  const profiles = store.profiles.map(p => ({...p, individualRounds: []}));
  store.setState({ profiles });
  
  setTimeout(() => location.reload(), 1000);
})();
```

---

## Prevention

The code fix in `store.ts` prevents NEW duplicates from being created. This script cleans up OLD duplicates that were already saved to the cloud.

**You only need to run this once** to clean up the existing mess.

---

**Next**: After running this script and seeing 2 clean rounds, test by:
1. Refreshing the page multiple times
2. Verifying count stays at 2 (no new duplicates)
3. Logging out and back in
4. Verifying still 2 rounds (cross-device sync working)

