# Monorepo Architecture & Amplify Multi-App Setup

## Overview

The Gimmies Golf project is transitioning to a monorepo architecture with multiple PWA apps sharing a single AWS Amplify backend.

## Domain Structure

| Subdomain | Purpose | PWA App |
|-----------|---------|---------|
| `golfwithgimmies.com` | Marketing/Landing Page | Static site (optional) |
| `app.golfwithgimmies.com` | Main Gimmies App | `/` (current root) |
| `play.golfwithgimmies.com` | Tournament Platform | `/apps/tournaments` |
| `clubs.golfwithgimmies.com` | Club Management | `/apps/clubs` (future) |

## Directory Structure

```
gimmies-golf/
├── amplify/                    # Shared Amplify backend (Gen 2)
│   ├── backend.ts
│   ├── auth/
│   └── data/
├── packages/
│   └── shared/                 # Shared code across all apps
│       ├── src/
│       │   ├── types/          # TypeScript types
│       │   ├── auth/           # Amplify auth utilities
│       │   ├── sync/           # Cloud sync utilities
│       │   └── utils/          # Common utilities
│       └── package.json
├── apps/
│   ├── main/                   # Main Gimmies app (future move)
│   └── tournaments/            # Tournament PWA
│       ├── src/
│       ├── public/
│       ├── vite.config.ts
│       └── package.json
├── src/                        # Current main app location
├── public/                     # Current main app assets
├── amplify_outputs.json        # Shared Amplify config
├── package.json                # Main app package.json
└── monorepo-package.json       # Future root package.json
```

## Shared Backend Architecture

All apps share:
- **Same Cognito User Pool** - Single sign-on across all subdomains
- **Same DynamoDB Tables** - Tournaments, Profiles, Clubs share data
- **Same AppSync API** - Single GraphQL endpoint

This means:
- Users sign in once, authenticated everywhere
- Tournament data is accessible from both main app and tournament app
- Clubs can manage tournaments from either interface

## AWS Amplify Hosting Setup

### Option 1: Multi-Branch with Path Rewrites (Simplest)

Configure Amplify Hosting to deploy different apps based on git branches:

```yaml
# amplify.yml
version: 1
applications:
  - appRoot: .
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
    # Main app branch
    
  - appRoot: apps/tournaments
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
```

### Option 2: Separate Amplify Apps (More Isolation)

Create multiple Amplify Hosting apps:
1. **gimmies-main** → `app.golfwithgimmies.com`
2. **gimmies-tournaments** → `play.golfwithgimmies.com`
3. **gimmies-clubs** → `clubs.golfwithgimmies.com`

Each app:
- Points to the same repository
- Uses different `appRoot` settings
- Shares `amplify_outputs.json` (copy to each app's public folder)

### Configuring Custom Domains in Amplify

1. Go to Amplify Console → App → Domain management
2. Add custom domain: `golfwithgimmies.com`
3. Configure subdomains:
   - `app` → main branch
   - `play` → tournaments branch (or separate app)
   - `clubs` → clubs branch (future)

### Sharing amplify_outputs.json

Each app needs access to the Amplify configuration. Options:

**Option A: Symlink (Development)**
```powershell
# In apps/tournaments/
New-Item -ItemType SymbolicLink -Path "amplify_outputs.json" -Target "../../amplify_outputs.json"
```

**Option B: Copy in Build (Production)**
```yaml
# In tournaments app amplify.yml
preBuild:
  commands:
    - cp ../../amplify_outputs.json ./
    - npm ci
```

**Option C: Environment Variable**
Store the config as a build-time env var and inject it.

## Cross-Origin Considerations

Since all apps are on subdomains of `golfwithgimmies.com`:
- Cookies can be shared with `domain=.golfwithgimmies.com`
- CORS is simpler (same-origin policy is relaxed for subdomains)
- Cognito tokens work across subdomains automatically

## Migration Path

### Phase 1 (Current) - Scaffolding
- [x] Create shared package structure
- [x] Create tournaments app scaffold
- [x] Update main app links to external tournament URL
- [ ] Copy icons to tournaments app

### Phase 2 - Development
- [ ] Move tournament components to tournaments app
- [ ] Migrate tournament state management
- [ ] Test tournament CRUD operations
- [ ] Add tournament-specific features (live scoring, etc.)

### Phase 3 - Deployment
- [ ] Set up second Amplify Hosting app
- [ ] Configure DNS for play.golfwithgimmies.com
- [ ] Verify shared auth works across subdomains
- [ ] Remove tournament routes from main app

### Phase 4 - Future Apps
- [ ] Create clubs app scaffold
- [ ] Move club management features
- [ ] Set up clubs.golfwithgimmies.com

## Local Development

### Running Individual Apps

```powershell
# Main app (current)
npm run dev -- --host

# Tournament app
cd apps/tournaments
npm install
npm run dev -- --host
```

### Running with Monorepo (Future)

When monorepo is fully set up:
```powershell
# From root
npm run dev           # Main app
npm run dev:tournaments   # Tournament app
```

## Testing Cross-App Auth

1. Sign in on main app (localhost:5173)
2. Navigate to tournaments app (localhost:5174)
3. User should be recognized (same Cognito user pool)

Note: In production, cookies are shared via domain settings. In local dev, you may need to sign in separately on each port.

## Troubleshooting

### "Module not found: @gimmies/shared"
- Ensure shared package is built: `cd packages/shared && npm run build`
- Check tsconfig paths are configured

### Different users on different apps
- Cognito tokens are stored in localStorage
- Clear localStorage or use incognito to test fresh

### Tournament data not syncing
- Both apps must use same `amplify_outputs.json`
- Check API endpoint matches in both apps

---

## Summary

This architecture allows:
1. **Focused UX** - Each app optimized for its purpose
2. **Shared Users** - Single Cognito pool, sign in once
3. **Shared Data** - Same DynamoDB, real-time sync
4. **Independent Deployment** - Deploy apps separately
5. **Scalability** - Add more apps without complexity
