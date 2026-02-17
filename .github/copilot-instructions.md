# GitHub Copilot Instructions (Gimmies Golf)

These instructions apply to GitHub Copilot Chat/Agents working in this repository.

## Multi-App Architecture (IMPORTANT - Updated Feb 2026)

This repo hosts **four separate apps** deployed to different subdomains:

| Branch | Subdomain | App | Build Output |
|--------|-----------|-----|--------------|
| `master` | app.golfwithgimmies.com | Main Gimmies App | `dist/` (root) |
| `landing` | golfwithgimmies.com + www | Marketing Landing Page | `apps/landing/dist/` |
| `tournaments` | play.golfwithgimmies.com | Tournaments PWA | `apps/tournaments/dist/` |
| `club` | club.golfwithgimmies.com | Club Dashboard PWA | `apps/club/dist/` |

### Key Architecture Points
- **Main app** (`src/`): Full-featured golf app with rounds, events, handicaps, cloud sync, games (Nassau, Skins, Wolf, BBB, Dots, etc.)
- **Landing page** (`apps/landing/`): Marketing site with PWA install instructions, links to apps
- **Tournaments app** (`apps/tournaments/`): Standalone PWA for tournament discovery/management
- **Club app** (`apps/club/`): Standalone PWA for club/tournament management (in development)
- All four apps share the same Amplify backend (Cognito auth, AppSync, DynamoDB)
- Each branch auto-deploys to its subdomain when pushed
- Sub-apps import `amplify_outputs.json` from the repo root (3 levels up from `apps/<name>/src/`)
- `packages/shared/` provides shared types, auth, and sync utilities across apps

## Repo workflow (IMPORTANT)
- Default branch is `master` (deploys to app.golfwithgimmies.com).
- Do **not** push directly to `master`, `landing`, or `tournaments` unless explicitly instructed.
- All work should be done on a feature branch and delivered via a Pull Request.

### Branch / PR workflow
- Create a feature branch from the appropriate base:
  - Main app changes: branch from `master`
  - Landing page changes: branch from `landing`
  - Tournament app changes: branch from `tournaments`
  - Club app changes: branch from `club`
- Example:
  - `git checkout master && git pull --ff-only`
  - `git checkout -b <username>/<short-description>`
- Push the branch and open a PR targeting the correct base branch.
- Keep PRs small and focused. Prefer incremental PRs over "mega merges".

### Syncing branches
When core changes in `master` need to propagate to other apps:
```bash
git checkout landing && git merge master --no-edit && git push origin landing
git checkout tournaments && git merge master --no-edit && git push origin tournaments
git checkout club && git merge master --no-edit && git push origin club
git checkout master
```

## Deployment awareness (Amplify)
- AWS Amplify Hosting auto-builds/deploys from `master`, `landing`, `tournaments`, and `club`.
- **All four branches are production-impacting** - merges trigger live deployments.
- Default workflow: implement on a feature branch, validate locally, then ask for explicit approval.
- Avoid changing deployment config files unless explicitly requested:
  - `amplify.yml`
  - `amplify_outputs.json`
  - `amplify/` backend files

## Local validation before deploy (REQUIRED)
- Before any deploy-impacting change, the agent MUST offer a local verification pass first.
- Preferred verification path for UI/UX changes:
  - Run **Build (prod)** (`npm run build`)
  - Run **Preview (prod build)** (`npx vite preview --host`)
  - Wait for the repo owner to confirm the change looks good in preview.
- Only after confirmation should the agent proceed to merge/PR.
- This enables batching multiple related fixes into larger chunks with one deploy.

## Dev/build tasks (VS Code)
- Prefer existing VS Code tasks over starting duplicate processes:
  - **Dev Server**: `npm run dev -- --host`
  - **Build (prod)**: `npm run build`
  - **Preview (prod build)**: `npx vite preview --host`
- Before starting a dev server, check whether one is already running.
- Do not run multiple builds concurrently.

## Tests, lint, formatting
- Prefer running the focused checks relevant to your change before opening a PR:
  - `npm run lint`
  - `npm run test:ci`
  - `npm run e2e:preview` (when changes affect routing/auth/sync or core flows)
- Formatting is Prettier-driven: use `npm run format` (avoid drive-by reformatting unrelated files).

## Cloud sync & data safety
- App is offline-first with local persistence (IndexedDB) and cloud sync (Amplify Gen 2).
- Avoid changing Amplify backend/auth/data schema unless explicitly requested (high blast radius).
- Do not hand-edit generated deployment artifacts (e.g. `amplify_outputs.json`).
- Never commit secrets/credentials; only add non-sensitive `VITE_*` env vars when necessary.

## PWA / service worker
- PWA uses `vite-plugin-pwa` with `registerType: 'prompt'` (user-controlled updates).
- Avoid changing service worker / caching behavior unless explicitly requested.
- Each app (main, tournaments, club) has its own PWA manifest and service worker.

## Game modals & UI patterns
- Game modals (Nassau, Skins, BBB, Wolf, Dots) use `createPortal(...)` for proper z-index stacking.
- Modal backdrop: `z-[9999] bg-black/60 backdrop-blur-sm`.
- First-time help modals use localStorage flags (e.g. `gimmies_event_help_dismissed`).
- Admin game controls are gated on `isOwner` check.

## External contributor repos
- Jamie's repo is configured as a git remote (`jamie` -> `E:\VSCodeRepo\gimmies`).
- When merging external changes: always use a feature branch, never direct-merge to production branches.
- Preserve the multi-app architecture — do NOT accept changes that flatten apps/ or packages/ directories.

## Change quality bar
- Keep changes minimal, consistent with existing style.
- If you modify behavior, update any relevant docs under `docs/`.
- Avoid large refactors unless asked.

## When in doubt
- If a change could affect deployments, authentication, or cloud sync, stop and ask before proceeding.
