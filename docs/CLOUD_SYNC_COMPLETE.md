# Cloud Sync Completion Summary

**Date**: January 2025  
**Purpose**: Ensure all user data persists to AWS cloud storage, protecting against cache/browser data loss

## Overview

This document summarizes the cloud sync implementation to protect user data. Previously, Tournaments and Wallet/Settlements were stored only in IndexedDB (local browser storage), meaning they would be lost if a user cleared their cache.

## Changes Made

### 1. Amplify Schema Updates (`amplify/data/resource.ts`)

Added two new DynamoDB models:

**Tournament Model**
- `name`, `description`, `format`, `visibility`, `status`
- `startDate`, `endDate`, `registrationDeadline`
- `courseId`, `courseName`, `teeName`
- `ownerProfileId`, `clubId`
- JSON fields: `configJson`, `divisionsJson`, `teeTimesJson`, `registrationsJson`, `roundsJson`, `standingsJson`
- Timestamps: `publishedAt`, `completedAt`

**Settlement Model**
- `eventId`, `eventName`
- `fromProfileId`, `fromProfileName`, `toProfileId`, `toProfileName`
- `amount`, `currency`, `status`
- `paidAt`, `paymentMethod`
- JSON field: `breakdownJson` (stores calculatedAmount, roundedAmount, tipFundAmount)
- `note`

### 2. New Sync Utilities

**`src/utils/tournamentSync.ts`**
- `saveTournamentToCloud(tournament)` - Saves/updates tournament in DynamoDB
- `loadTournamentById(id)` - Loads single tournament
- `loadTournamentsFromCloud(profileId)` - Loads all tournaments for user
- `loadPublicTournaments()` - Loads public tournaments for discovery
- `deleteTournamentFromCloud(id)` - Removes tournament from cloud

**`src/utils/walletSync.ts`**
- `saveSettlementToCloud(settlement)` - Saves single settlement
- `saveSettlementsToCloud(settlements)` - Batch save
- `loadSettlementsForProfile(profileId)` - Load user's settlements
- `loadSettlementsForEvent(eventId)` - Load event's settlements
- `updateSettlementStatus(id, status, method)` - Update payment status
- `deleteSettlementFromCloud(id)` - Remove settlement

### 3. Slice Integration

**`src/state/slices/tournamentSlice.ts`**
All tournament mutations now sync to cloud:
- `createTournament` → saves new tournament
- `updateTournament` → syncs changes
- `deleteTournament` → removes from cloud
- `publishTournament`, `startTournament`, `completeTournament`, `cancelTournament` → status sync
- `registerForTournament`, `updateRegistration`, `removeRegistration` → registration sync
- `addDivision`, `updateDivision`, `removeDivision` → division sync
- `addTeeTime`, `updateTeeTime`, `removeTeeTime`, `generatePairings` → tee time sync
- `updateTournamentScore`, `completeRound`, `recalculateStandings` → scoring sync

**`src/state/slices/walletSlice.ts`**
Settlement mutations now sync to cloud:
- `createSettlements` → saves all new settlements for event
- `markSettlementPaid` → updates status in cloud
- `forgiveSettlement` → updates status in cloud

### 4. Cloud Loading on App Startup

Modified `src/state/store.ts` `loadEventsFromCloud()` function to also load:
- Tournaments via `loadTournamentsFromCloud()`
- Settlements via `loadSettlementsForProfile()`

This ensures when a user logs in on a new device or after clearing cache, all their data is restored.

## Data Flow

### Saving Data
```
User Action → Zustand Slice → 1) Update local state
                             → 2) Async cloud sync (fire-and-forget)
```

### Loading Data (on login/page load)
```
loadEventsFromCloud() → Load Events from cloud
                      → Load CompletedRounds from cloud
                      → Load Tournaments from cloud (NEW)
                      → Load Settlements from cloud (NEW)
                      → Merge with existing local state
```

## Testing Checklist

- [ ] Create a tournament → appears in DynamoDB Tournament table
- [ ] Update tournament status → cloud record updates
- [ ] Register for tournament → registrationsJson updates
- [ ] Create settlements from completed event → Settlement records created
- [ ] Mark settlement as paid → status updates in cloud
- [ ] Clear browser cache → login → data restored from cloud

## What's Still Local Only (Low Risk)

1. **Notification Read States** - UI preference, no data loss impact
2. **Transactions** (detailed game-by-game breakdown) - Can be recalculated from events
3. **TipFunds** - Calculated from settlements, can be reconstructed

## Technical Notes

- All sync operations are async/fire-and-forget to keep UI responsive
- Errors are logged to console but don't block user actions
- Deduplication happens on load (by ID matching)
- Cloud sync is gated by `VITE_ENABLE_CLOUD_SYNC=true` env var
