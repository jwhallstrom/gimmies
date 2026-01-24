# GitHub Copilot Instructions (Gimmies Golf)

These instructions apply to GitHub Copilot Chat/Agents working in this repository.

## Repo workflow (IMPORTANT)
- Default branch is `master`.
- Do **not** push directly to `master` unless explicitly instructed by the repo owner.
- All work should be done on a feature branch and delivered via a Pull Request into `master`.

### Branch / PR workflow
- Create a feature branch from the latest `master`:
  - `git checkout master`
  - `git pull --ff-only`
  - `git checkout -b <username>/<short-description>`
- Push the branch and open a PR targeting `master`.
- Keep PRs small and focused. Prefer incremental PRs over “mega merges”.

## Deployment awareness (Amplify)
- AWS Amplify Hosting is wired to auto-build/deploy from `master`.
- Treat merges into `master` as production-impacting.
- Avoid changing deployment config files unless explicitly requested:
  - `amplify.yml`
  - `amplify_outputs.json`
  - `amplify/` backend files

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
- Avoid changing service worker / caching behavior unless explicitly requested; if changed, validate update/refresh behavior in a production preview.

## Change quality bar
- Keep changes minimal, consistent with existing style.
- If you modify behavior, update any relevant docs under `docs/`.
- Avoid large refactors unless asked.

## When in doubt
- If a change could affect deployments, authentication, or cloud sync, stop and ask before proceeding.
