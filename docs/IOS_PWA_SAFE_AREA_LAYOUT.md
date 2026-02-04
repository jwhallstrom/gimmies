# iOS PWA Safe Area Layout - CRITICAL CONFIGURATION

**⚠️ DO NOT MODIFY WITHOUT TESTING ON iOS 26.2+ PWA**

This document describes the carefully tuned iOS PWA layout configuration that ensures proper safe-area handling on iPhone notch/Dynamic Island and home indicator.

## Problem History

After Jamie's merge, the iOS PWA layout broke:
- Content rendered under the notch/Dynamic Island
- Footer floated ~34px above the home indicator with large dark gap
- Multiple fix attempts failed because they focused on symptoms, not root cause

## Root Cause

The body element MUST use `position: fixed` with explicit bounds to establish proper viewport containment for safe-area env() variables to cascade correctly to child elements.

## Critical Configuration

### 1. Body CSS (`src/styles.css`)

```css
body {
  /* ⚠️ CRITICAL: position:fixed establishes proper viewport bounds */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  
  /* Apply safe area insets for top/left/right ONLY */
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  /* NO padding-bottom - fixed footer handles bottom safe area */
  
  height: 100dvh;
  height: 100%; /* Fallback */
  margin: 0;
  background-color: #09243F;
  overflow: hidden;
  box-sizing: border-box;
}

#root {
  height: 100%;  /* NOT 100dvh - fills body after safe-area padding */
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

### 2. Header (`src/pages/App.tsx`)

```tsx
<header className="flex-shrink-0 bg-primary-900/85 backdrop-blur text-white px-4 py-3 ...">
```

**Key points:**
- Uses `py-3` (12px top + bottom padding)
- NO `pt-safe-top` utility - body already handles top safe area
- Body's padding-top pushes header down from notch automatically

### 3. Footer (`src/pages/App.tsx`)

```tsx
<footer className="fixed bottom-0 left-0 right-0 z-40 ... h-[68px] pb-safe-bottom -mb-5 flex items-start justify-around px-2 pt-1">
```

**Key points:**
- `h-[68px]`: Fixed height (NOT min-height) prevents expansion
- `pb-safe-bottom`: Tailwind utility that adds `padding-bottom: env(safe-area-inset-bottom, 0px)`
- `-mb-5`: 20px negative margin pushes footer closer to home indicator (tuned to match Instagram)
- `items-start`: Icons align to top of footer container
- `pt-1`: Minimal 4px top padding for compact layout

### 4. Ticker Positioning (`src/styles.css`)

```css
.ticker-above-footer {
  /* Footer is 68px but has -mb-5 (20px), so effective position ~48px from bottom */
  bottom: 56px;
  bottom: calc(48px + env(safe-area-inset-bottom, 8px));
}
```

**Adjusted to account for footer's negative margin.**

## Why This Works

1. **Body position:fixed** creates a proper containing block that respects viewport bounds
2. **Body safe-area padding** (top/left/right only) pushes all content away from notch/sides
3. **Fixed footer** with `pb-safe-bottom` extends into bottom safe area
4. **Negative margin** on footer compensates for natural spacing, matching major PWAs like Instagram
5. **#root height:100%** (not 100dvh) prevents double-height calculation

## Testing Checklist

Before any changes to safe-area layout:

1. ✅ Build production bundle: `npm run build`
2. ✅ Test in preview: `npx vite preview --host`
3. ✅ Add to iPhone home screen from preview server
4. ✅ Open PWA and verify:
   - [ ] Content NOT under notch/Dynamic Island
   - [ ] Header has appropriate spacing at top
   - [ ] Footer nav icons positioned ~8-10px above home indicator
   - [ ] No large dark gap below footer
   - [ ] Ticker marquee sits just above footer
5. ✅ Compare with Instagram/major PWAs for consistency

## Reference Commits

- **Working version**: commit `9fef272~1`
- **Final fix**: commit with version 0.2.0
- **Test process**: Local preview with multiple iterations (v0.1.1 → v0.2.0)

## Common Mistakes to Avoid

❌ **DO NOT** add `pt-safe-top` to header (creates double padding)  
❌ **DO NOT** add `padding-bottom: env(safe-area-inset-bottom)` to body (breaks footer positioning)  
❌ **DO NOT** use `min-height` on footer (causes expansion)  
❌ **DO NOT** remove `position: fixed` from body (breaks safe-area cascade)  
❌ **DO NOT** change #root to `height: 100dvh` (creates mismatch with body)  

## Contact

If iOS safe-area issues occur:
1. Check this document first
2. Test with preview server on actual iOS device
3. Compare with commit `9fef272~1` or version 0.2.0
4. Iterate with version bumps to track changes

Last updated: February 4, 2026 (iOS 26.2 compatibility verified)
