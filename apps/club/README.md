# Gimmies Club Dashboard

Standalone PWA for golf club tournament management and member organization.

## Deployment

This app deploys to **club.golfwithgimmies.com** via AWS Amplify Hosting.

### Amplify Console Setup Required:

1. **Connect Branch:**
   - Go to Amplify Console → App: dtsoc1sfk1bk8
   - Connect branch: `club`
   - App name: `Club Dashboard`

2. **Configure Subdomain:**
   - Add subdomain: `club.golfwithgimmies.com`
   - Point to branch: `club`
   - SSL auto-provisioned

3. **Build Settings:**
   - Uses amplify.yml from root (already configured)
   - Builds: `apps/club/`
   - Output: `dist/`

4. **SPA Rewrites (Critical):**
   Add rewrite rule in Amplify Console:
   - Source: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>`
   - Target: `/index.html`
   - Type: `200 (Rewrite)`

## Local Development

```bash
cd apps/club
npm install
npm run dev
```

Runs on: http://localhost:5174

## Features (Coming Soon)

- Tournament management
- Member directory
- Email list building
- CSV export
- Branded event pages
- Stripe Connect integration
- Apple/Google Pay support

## Current Status

- ✅ App structure created
- ✅ Build configuration added to amplify.yml
- ⏳ Awaiting Amplify Console configuration
- ⏳ Feature migration from main app `/club` route
