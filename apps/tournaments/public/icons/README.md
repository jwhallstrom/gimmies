# Placeholder Icons

This directory should contain tournament app icons:

## Required files:
- `icon-192.png` - 192x192 PWA icon  
- `icon-512.png` - 512x512 PWA icon
- `favicon.png` - Browser favicon
- `apple-touch-icon.png` - iOS home screen icon

## Design suggestions:
- Use a trophy or tournament theme
- Tournament-themed colors: Navy (#1e3a5f), Blue (#2d5a87), Accent (#4a90c2)
- Distinct from main Gimmies app icon

## Temporary workaround:
Until custom icons are provided, you can copy from the main app's public/icons
and they will work, just won't be tournament-branded.

```powershell
# Copy from main app as placeholder
Copy-Item -Path "public/icons/*" -Destination "apps/tournaments/public/icons/" -Recurse
Copy-Item -Path "public/favicon.png" -Destination "apps/tournaments/public/"
Copy-Item -Path "public/apple-touch-icon.png" -Destination "apps/tournaments/public/"
```
