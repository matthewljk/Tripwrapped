# TripWrapped

Shared trip photo/video galleries. Sign in (Google or email), create or join trips by code, upload media, view gallery and a trip map. Next.js 16 (App Router) + AWS Amplify Gen 2.

---

## Quick start

1. **Install and run backend** (separate terminal): `npm install` then `npm run sandbox`. Requires AWS CLI.
2. **Copy config:** `cp .amplify/artifacts/amplify_outputs.json ./`
3. **Run app:** `npm run dev` → [http://localhost:3000](http://localhost:3000)

**Deploy:** Push to `main` to trigger AWS Amplify Hosting build. Ensure `amplify_outputs.json` is at root (committed or injected via `NEXT_PUBLIC_AMPLIFY_OUTPUTS`) and that `package-lock.json` is committed when deps change.

---

## Context for AI

- **Stack:** Next.js 16, React 19, Tailwind 4. Backend: Amplify Gen 2 (Cognito, AppSync, S3). Config: `amplify_outputs.json` at **repo root only**; app reads it via `src/components/ConfigureAmplify.tsx` (or env `NEXT_PUBLIC_AMPLIFY_OUTPUTS`).
- **Run:** `npm install` → `npm run sandbox` (separate terminal) → `cp .amplify/artifacts/amplify_outputs.json ./` → `npm run dev`. Build: `npm run build`. If local install is broken: `rm -rf node_modules && npm install`. Hosting uses `npm ci` — always commit `package-lock.json` when deps change.
- **Codebase:** App Router under `src/app/`. Shared layout + Amplify config in `src/components/ClientLayout.tsx` and `ConfigureAmplify.tsx`. Backend schema and auth/storage in `amplify/`. TypeScript excludes `amplify/` (see `tsconfig.json`); do not import from `amplify/` in frontend.

---

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4 |
| Backend  | AWS Amplify Gen 2 — Auth (Cognito), Data (AppSync/DynamoDB), Storage (S3) |

---

## Codebase layout

```
src/
  app/
    layout.tsx          # Root layout, font, ClientLayout
    page.tsx            # / — upload
    gallery/page.tsx    # /gallery
    wrap-it-up/page.tsx # Trip map (Mapbox)
    trips/page.tsx      # /trips
    profile/page.tsx    # /profile
    globals.css
  components/
    ClientLayout.tsx    # Wraps children with Navbar, ConfigureAmplify
    ConfigureAmplify.tsx # Amplify.configure(outputs); single entry for config
    Navbar.tsx          # Logo (public/login-videos/Icon.png) + TripWrapped, nav links
    MediaUpload.tsx     # Upload UI, S3 + Media create (EXIF/video metadata)
    MediaGallery.tsx    # Grid + metadata view, sort, load more, list cache, download/delete
    UploadModal.tsx
    TripSelector.tsx
    TripMap.tsx         # Mapbox Standard, 3D terrain, photo markers, travel path, Start tour
    SetUsernamePrompt.tsx
    LoginVideoBackground.tsx
    LoadingSpinner.tsx
  hooks/
    useActiveTrip.ts
    useUserProfile.ts
    useIsMobile.ts
amplify/
  backend.ts            # DynamoDB on-demand billing (pay-per-request, hobby-friendly)
  auth/resource.ts
  data/resource.ts      # Schema (Trip, TripMember, Media, UserPreference, UserProfile), deleteTripMedia
  data/delete-media-handler/handler.ts
  storage/resource.ts
```

**Paths:** `@/*` → `src/*` (see `tsconfig.json`).

---

## Commands

| Command           | Purpose |
|-------------------|--------|
| `npm install`     | Install deps (use after clone or when lockfile changes). |
| `npm run sandbox` | Start Amplify backend (AWS CLI; separate terminal). |
| `npm run dev`     | Next dev server (after `amplify_outputs.json` at root). |
| `npm run build`   | Production build. |
| `npm run lint`    | ESLint. |

---

## Local vs production

- **One lockfile:** Commit `package-lock.json` whenever you change deps so Amplify’s `npm ci` succeeds. Use `npm install` locally (not `npm ci`) for day-to-day installs.
- **Broken local install:** Run `rm -rf node_modules && npm install`.
- **Config:** Local uses `amplify_outputs.json` at repo root (copy from sandbox: `cp .amplify/artifacts/amplify_outputs.json ./`). Production uses a **different** backend: set `NEXT_PUBLIC_AMPLIFY_OUTPUTS` in Amplify Hosting to the stringified JSON from the production backend.
- **Backend cost:** DynamoDB is set to on-demand (pay-per-request) and the delete-media Lambda uses minimal memory; suitable for hobby use.

**Two backends:** Local and production use **different** Amplify backends (e.g. sandbox vs pipeline-deployed). When you change the schema, deploy the production backend too so both have the same models (e.g. `Media` with `lat`, `lng`, `timestamp`).

**How to sync both backends:** The schema in `amplify/` is the single source of truth. (1) **Sandbox (local):** run `npm run sandbox` so the local backend has the latest schema; copy `cp .amplify/artifacts/amplify_outputs.json ./` for the Next app. (2) **Production:** push your branch (e.g. `main`) to trigger the Amplify build. If the app is set up for fullstack (backend + frontend), the build deploys the backend for that branch, then the frontend. If only the frontend is deployed by Amplify, deploy the production backend yourself: from the repo run `npx ampx pipeline-deploy --branch <branch> --app-id <AMPLIFY_APP_ID>` (get the app id in Amplify Console → App settings → General). After the backend deploy, run `npx ampx generate outputs --app-id <id> --branch <branch> --out-dir .` to get the new `amplify_outputs.json`, then set `NEXT_PUBLIC_AMPLIFY_OUTPUTS` in Hosting to that file’s stringified contents and redeploy the frontend.

**Deployed app can't see metadata but local can:** Production talks to the production backend. Deploy that backend with the current schema, set hosting's `NEXT_PUBLIC_AMPLIFY_OUTPUTS` to its outputs, and redeploy the frontend. New uploads will then have metadata; existing production records may need re-upload.

**Production from Console only:** The repo has `amplify.yml` so each build deploys the backend then the frontend. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Amplify Console for the branch; then trigger a build (push to main or Redeploy). No local terminal needed.

**Metadata not saved on upload in production:** The app sends lat/lng/timestamp when creating each Media record. If the production backend was deployed before the `Media` model had these fields, they won't be stored. Fix: deploy the production backend with the current schema (see "How to sync both backends" above). After that, new uploads will persist metadata. No frontend change required.

---

## Routes

| Path           | Role |
|----------------|------|
| `/`            | Upload: trip selector, multi-file upload, recent list, delete. |
| `/gallery`     | Masonry grid (load more), metadata table view, sort (date/type/user), lightbox, download/delete in both views. |
| `/wrap-it-up`  | Map (Mapbox Standard, 3D terrain): photo markers, travel path, Start tour with time-based lighting. |
| `/trips`       | Create or join by code, set active trip, trip settings (e.g. who can delete). |
| `/profile`     | Username, manage/leave trips. |

**Wrap It Up:** Requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local` (or in Amplify Hosting env). Get a token at [mapbox.com](https://account.mapbox.com/access-tokens/).

---

## Repo

[https://github.com/matthewljk/Tripwrapped](https://github.com/matthewljk/Tripwrapped)
