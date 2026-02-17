# iOS PWA Layout - CRITICAL CONFIGURATION

**DO NOT MODIFY** these settings without extensive iOS 26.2+ testing on actual devices!

## Background
After iOS 26.2 update, PWA safe-area handling changed significantly. This configuration was achieved through extensive iteration and testing to match Instagram/Starbucks PWA positioning.

## Critical Files & Settings

### 1. `src/styles.css` - Body Layout
```css
body {
  position: fixed;  /* REQUIRED for safe areas to work */
  top: 0; left: 0; right: 0; bottom: 0;
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  /* NO padding-bottom - footer handles it */
  height: 100dvh;
  overflow: hidden;
  box-sizing: border-box;
}

#root {
  height: 100%;  /* NOT 100dvh! */
  width: 100%;
}
```

**Why these matter:**
- `position: fixed` establishes proper viewport bounds for safe-area cascade
- Top/left/right/bottom: 0 fills entire screen including safe areas
- NO `padding-bottom` on body because footer needs to control bottom positioning
- `#root` uses `height: 100%` to fill remaining space after body padding

### 2. `src/pages/App.tsx` - Header
```tsx
<header className="flex-shrink-0 bg-primary-900/85 backdrop-blur text-white px-4 py-3 flex items-center justify-between shadow-md z-40 border-b border-white/10">
```

**Critical:**
- Uses `py-3` for padding (NOT `pt-safe-top` or any safe-area class)
- Body's `padding-top: env(safe-area-inset-top)` handles notch spacing
- Adding extra safe-area padding here causes double padding

### 3. `src/pages/App.tsx` - Footer
```tsx
<footer className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#09243F] border-t border-gray-200 dark:border-white/10 h-[68px] pb-safe-bottom -mb-4 flex items-start justify-around px-2 pt-1">
```

**Critical values (tested extensively):**
- `h-[68px]` - Fixed height (NOT min-h)
- `pb-safe-bottom` - Extends into safe area
- **`-mb-4`** - Negative margin (16px) pushes footer down to match Instagram/Starbucks
  - `-mb-5` (20px) caused text cutoff (handicap "p" cut off)
  - `-mb-6` (24px) went into safe area (too far)
  - `-mb-3` (12px) was too high (gap visible)
  - **`-mb-4` (16px) is the sweet spot**
- `pt-1` - Minimal top padding (4px)
- `items-start` - Aligns icons to top of flex container

### 4. `src/styles.css` - Ticker Positioning
```css
.ticker-above-footer {
  bottom: 56px;
  bottom: calc(52px + env(safe-area-inset-bottom, 4px));
}
```

**Math:**
- Footer effective height: 68px - 16px (from -mb-4) = 52px from viewport bottom
- Ticker needs 4px buffer + safe area inset

## Testing Checklist
If you MUST modify these settings:
1. Test on iOS 26.2+ device (NOT simulator - safe areas behave differently)
2. Add PWA to home screen (browser view doesn't show the issue)
3. Check:
   - [ ] Header content NOT under notch/Dynamic Island
   - [ ] Footer icons NOT cut off (check "p" in "Handicap")
   - [ ] Footer positioned close to bottom (compare to Instagram app)
   - [ ] Ticker scrolls just above footer (no large gap)
   - [ ] No dark gap below footer
4. Test on multiple iPhone models (different safe-area sizes)

## What NOT To Do
❌ Do NOT add `pt-safe-top` or similar to header - body handles it
❌ Do NOT remove `position: fixed` from body
❌ Do NOT add `padding-bottom: env(safe-area-inset-bottom)` to body
❌ Do NOT change `#root` to `height: 100dvh`
❌ Do NOT change footer `-mb-4` without device testing
❌ Do NOT use `min-h-[68px]` on footer (must be fixed `h-[68px]`)

## Version History
- v0.2.1 (Feb 2026): Final tuned version with -mb-4, position:fixed body
- Iterations: Tested -mb-3 through -mb-6, settled on -mb-4
- Reference: Matches Instagram/Starbucks PWA positioning on iOS 26.2

## Related Files
- `src/styles.css` - Body and ticker positioning
- `src/pages/App.tsx` - Header and footer components
- `tailwind.config.cjs` - Safe-area utility definitions
- `index.html` - viewport-fit=cover meta tag
