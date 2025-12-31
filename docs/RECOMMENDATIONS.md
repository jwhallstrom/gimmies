# Gimmies Golf - Improvement Recommendations

Comprehensive list of recommendations from the code review. Check items off as they're completed.

---

## ✅ Completed

### Performance
- [x] **Split store.ts into domain slices** - Reduced from 2,257 → 514 lines (77% reduction)
  - Created: `types.ts`, `userSlice.ts`, `eventSlice.ts`, `gameSlice.ts`, `handicapSlice.ts`, `uiSlice.ts`

### Testing
- [x] **Add comprehensive unit tests** - 97 tests covering store, events, users, games, handicaps, wallet, integration

### Wallet Feature
- [x] **Wallet types and slice** - Created wallet data types and walletSlice.ts with:
  - Settlement tracking (pending/paid/forgiven)
  - Transaction history per profile
  - Tip fund management
  - Configurable rounding (whole dollar or $0.50)
  - Optimized net settlement calculation

---

## 🎮 Game Recommendations

### New Games to Add
- [ ] **Wolf** - Popular 4-player game with rotating "wolf" who picks partners
- [ ] **Bingo Bango Bongo** - 3 points per hole (first on green, closest to pin, first in hole)
- [ ] **Vegas** - Team game using combined scores as a number (e.g., 4+5 = 45 or 54)
- [ ] **Stableford** - Points-based scoring system
- [ ] **Match Play** - Hole-by-hole winner format

### Existing Game Improvements
- [ ] **Nassau enhancements**
  - Add "press" functionality (automatic or manual)
  - Support 2-down auto-press option
  - Add match play scoring display alongside stroke play
- [ ] **Skins improvements**
  - Carryover visualization (show accumulated pot)
  - Validation skins (require par or better)
  - Team skins option
- [ ] **Pinky/Greenie**
  - Photo proof upload for greenies
  - Distance tracking for closest-to-pin competitions

---

## 💰 Wallet Feature

### ✅ Core Wallet (Implemented)
- [x] **Wallet types** - EventWalletSettings, Settlement, WalletTransaction, TipFund, ProfileWallet
- [x] **Settlement calculation** - Optimized who-owes-whom algorithm
- [x] **Rounding options** - Configurable whole dollar or $0.50 rounding
- [x] **Tip fund support** - Optional per-event tip fund from rounded amounts
- [x] **Transaction tracking** - Per-event transaction history
- [x] **Profile wallet stats** - Lifetime/season net, pending amounts, biggest win/loss

### 🔨 Wallet UI (In Progress)
- [ ] **Event settlement screen** - Show settlements after round completion
- [ ] **Settlement cards** - Mark paid (cash/Venmo/Zelle), forgive
- [ ] **Wallet summary page** - Profile view with balance and history
- [ ] **Event wallet settings** - Configure rounding, tip fund per event

### 💡 Payment Integration (Future)
- [ ] **Venmo deep links** - Quick payment requests
- [ ] **PayPal integration** - Direct transfers
- [ ] **Cash tracking** - Manual settlement recording

---

## 🎨 UX/UI Improvements

### Scorecard
- [ ] **Swipe gestures** - Swipe between holes on mobile
- [ ] **Quick score entry** - Tap +/- buttons instead of typing
- [ ] **Score validation warnings** - Highlight unlikely scores (e.g., 1 or 15+)
- [ ] **Running totals** - Show front 9, back 9, and total as you go
- [ ] **Hole-by-hole stats** - Show par, handicap stroke indicator per hole

### Event Management
- [ ] **Event templates** - Save course + game configurations for reuse
- [ ] **Recurring events** - Weekly/monthly game scheduling
- [ ] **Event history search** - Filter by course, date, players
- [ ] **Bulk score entry** - Enter all scores for a hole at once (for scorer)

### Navigation
- [ ] **Bottom navigation bar** - Persistent nav for mobile
- [ ] **Breadcrumb navigation** - Show where you are in the app
- [ ] **Quick actions** - FAB for common actions (new event, add score)

### Accessibility
- [ ] **Dark mode** - System preference or manual toggle
- [ ] **Font size options** - Larger text for outdoor visibility
- [ ] **High contrast mode** - Better visibility in bright sunlight

---

## ⚡ Performance Optimizations

### Code Splitting
- [ ] **Lazy load routes** - Split by page (Home, Event, Handicap, etc.)
- [ ] **Lazy load game calculators** - Only load Nassau/Skins/etc. when needed
- [ ] **Dynamic imports for charts** - Load visualization libs on demand

### Data Management
- [ ] **Pagination for completed events** - Don't load all history at once
- [ ] **Virtual scrolling** - For long lists (scorecards, event history)
- [ ] **Optimistic updates** - Update UI before cloud sync confirms
- [ ] **Background sync** - Queue updates when offline

### Caching
- [ ] **Course data caching** - Cache course info locally after first load
- [ ] **Memoize expensive calculations** - Handicap, payouts, standings
- [ ] **Service worker improvements** - Better offline experience

---

## 🔧 Technical Debt

### Testing
- [x] **Add comprehensive unit tests** - 97 tests covering store, events, users, games, handicaps, wallet, integration
- [ ] **E2E test suite** - Cover critical user flows
- [ ] **Visual regression tests** - Catch UI changes

### Code Quality
- [ ] **Extract game logic to separate modules** - Each game in its own directory
- [ ] **TypeScript strict mode** - Enable stricter type checking
- [ ] **Error boundaries** - Graceful error handling in UI
- [ ] **Logging/monitoring** - Track errors in production

### DevOps
- [ ] **CI/CD pipeline** - Automated testing on PR
- [ ] **Preview deployments** - Per-PR preview URLs
- [ ] **Performance monitoring** - Track Core Web Vitals

---

## 📊 Analytics & Insights (Future)

### Player Stats
- [ ] **Scoring trends** - Charts showing improvement over time
- [ ] **Course performance** - Best/worst courses
- [ ] **Game win rates** - Nassau/Skins performance history
- [ ] **Head-to-head records** - Track matchups between players

### Group Stats
- [ ] **Leaderboards** - Season standings
- [ ] **Money leaders** - Total winnings/losses
- [ ] **Achievement badges** - Eagles, hole-in-ones, etc.

---

## Priority Order (Suggested)

### Phase 1 - Foundation ✅
1. ✅ Store refactoring (77% reduction)
2. ✅ Comprehensive tests (97 tests)
3. ✅ Wallet backend (types, slice, settlement logic)

### Phase 2 - Wallet UI (Current)
4. 🔨 Event settlement screen
5. 🔨 Settlement cards (mark paid/forgive)
6. 🔨 Wallet summary page
7. 🔨 Quick score entry UX

### Phase 3 - Games
8. Nassau press functionality
9. Wolf game
10. Bingo Bango Bongo

### Phase 4 - Polish
11. Dark mode
12. Event templates
13. Scoring trends/analytics

---

## Notes

- Update this file as items are completed
- Add new recommendations as they come up
- Priority can shift based on user feedback

Last updated: December 29, 2025
