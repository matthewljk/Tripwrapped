# TripWrapped

Shared trip photo/video galleries. Sign in (Google or email), create or join trips by code, upload media, view gallery. Next.js 16 (App Router) + AWS Amplify Gen 2.

---

## Context for AI

- **Stack:** Next.js 16, React 19, Tailwind 4. Backend: Amplify Gen 2 (Cognito, AppSync, S3). Config: `amplify_outputs.json` at **repo root only**; app reads it via `src/components/ConfigureAmplify.tsx` (or env `NEXT_PUBLIC_AMPLIFY_OUTPUTS`).
- **Run:** `npm install` → `npm run sandbox` (separate terminal) → `cp .amplify/artifacts/amplify_outputs.json ./` → `npm run dev`. Build: `npm run build`. If local install is broken: `rm -rf node_modules && npm install`. Hosting uses `npm ci` — always commit `package-lock.json` when deps change.
- **Codebase:** App Router under `src/app/`. Shared layout + Amplify config in `src/components/ClientLayout.tsx` and `ConfigureAmplify.tsx`. Backend schema and auth/storage in `amplify/`. TypeScript excludes `amplify/` (see `tsconfig.json`); do not import from `amplify/` in frontend.

---

## Stack

| Layer   | Tech |
|---------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4 |
| Backend | AWS Amplify Gen 2 — Auth (Cognito), Data (AppSync/DynamoDB), Storage (S3) |

---

## Codebase layout

```
src/
  app/
    layout.tsx          # Root layout, font, ClientLayout
    page.tsx            # / — upload
    gallery/page.tsx    # /gallery
    trips/page.tsx      # /trips
    profile/page.tsx    # /profile
    globals.css
  components/
    ClientLayout.tsx    # Wraps children with Navbar, ConfigureAmplify
    ConfigureAmplify.tsx # Amplify.configure(outputs); single entry for config
    Navbar.tsx
    MediaUpload.tsx     # Upload UI, S3 + Media create
    MediaGallery.tsx    # Gallery grid, lightbox, download, delete
    UploadModal.tsx
    TripSelector.tsx
    SetUsernamePrompt.tsx
    LoginVideoBackground.tsx
    LoadingSpinner.tsx
  hooks/
    useActiveTrip.ts
    useUserProfile.ts
    useIsMobile.ts
amplify/
  backend.ts
  auth/resource.ts
  data/resource.ts      # Schema (Trip, TripMember, Media, UserPreference, UserProfile), deleteTripMedia
  data/delete-media-handler/handler.ts
  storage/resource.ts
```

**Paths:** `@/*` → `src/*` (see `tsconfig.json`).

---

## Commands

| Command | Purpose |
|---------|--------|
| `npm install` | Install deps |
| `npm run sandbox` | Start Amplify backend (needs AWS CLI; separate terminal) |
| `npm run dev` | Next dev server (after copying `amplify_outputs.json` to root) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

---

## Local vs production: one workflow that works for both

**Idea:** Use the same lockfile for local and Amplify. Amplify runs `npm ci` (strict); local uses `npm install` (respects the lockfile). Keep the lockfile committed and in sync so both environments get identical dependency trees.

| Do this | Why |
|--------|-----|
| **Always commit `package-lock.json`** when you change `package.json` or add/remove deps. | Amplify runs `npm ci`, which fails if the lockfile is missing or out of sync. |
| **Local: use `npm install`** (not `npm ci`) for day-to-day installs. | Matches what the lockfile expects and avoids strict sync errors while developing. |
| **After changing deps:** run `npm install`, then commit both `package.json` and `package-lock.json`. | So the next Amplify build has everything it needs. |
| **If local is broken** (e.g. `next` not found, weird module errors): run `rm -rf node_modules && npm install`. | Cleans a bad or partial install; reinstalls from the lockfile. |
| **Optional:** Use the same Node version as Amplify (e.g. set in Amplify build settings; use `.nvmrc` or `engines` locally). | Reduces lockfile differences between local and CI. |

**Config (same for both):** One `amplify_outputs.json` at repo root. Local: copy from sandbox (`cp .amplify/artifacts/amplify_outputs.json ./`). Production: commit that file at root or set `NEXT_PUBLIC_AMPLIFY_OUTPUTS` in Amplify Hosting build env.

---

## Routes

| Path | Role |
|------|------|
| `/` | Upload: trip selector, multi-file upload, recent list, delete |
| `/gallery` | Masonry grid, lightbox (click), hover avatar for uploader name, download / select-download, delete by policy |
| `/trips` | Create or join by code, set active trip, trip settings (e.g. who can delete) |
| `/profile` | Username, manage/leave trips |

---

## Repo

[https://github.com/matthewljk/Tripwrapped](https://github.com/matthewljk/Tripwrapped)
