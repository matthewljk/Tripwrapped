# TripWrapped

Next.js app for shared trip photo/video galleries. Users sign in (Google or email), create or join trips by code, set a default trip, upload media, and view a trip gallery.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind 4
- **Backend:** AWS Amplify Gen 2 — Auth (Cognito, Google + email), Data (AppSync/DynamoDB), Storage (S3)
- **Config:** `amplify/` (auth, data, storage, backend), **`amplify_outputs.json` at repo root only** (see [Local vs production](#local-vs-production-config) below).

## Data model (`amplify/data/resource.ts`)

- **Trip** — `tripCode`, `name`, `allowAnyMemberToDelete`; GSI on tripCode
- **TripMember** — `tripId`, `userId`, `role`; GSIs on tripId, userId
- **Media** — `tripId`, `storagePath`, `uploadedBy`, `uploadedByUsername`, optional `lat`, `lng`, `timestamp` (from image EXIF); GSI on tripId. Files in S3 at `media/{identityId}/*`
- **UserPreference** — `activeTripId` (default trip per user)
- **UserProfile** — `userId`, `username`; GSI on userId

Custom mutation **`deleteTripMedia(mediaId)`** — lets a trip member delete media when the trip setting “Any trip member can delete” is on (Lambda-enforced).

## Routes & features

- **/** — Upload: trip selector, “Add photo or video” opens modal; **multiple uploads** (drag/drop or pick several); recently uploaded list with thumbnails and delete.
- **/gallery** — Trip gallery: trip selector, masonry grid, lightbox (click to view full size). Hover the avatar on a photo to see who uploaded it. **Download/save** per item, **select mode** (select multiple → download selected), delete by policy.
- **/trips** — Create/join by code, set active trip, trip settings (owners): “Any trip member can delete”.
- **/profile** — Username, manage/leave trips.

**Auth:** Amplify `<Authenticator>` (Google + email). Set-username prompt for first-time email users. Optional login background video: `public/login-videos/background.mp4` or `.webm`.

**Upload:** Images (EXIF: lat, lng, DateTimeOriginal via exifr) and videos (≤15s). Upload to S3 then create Media record; delete removes from S3 then DB.

**Delete policy:** Per trip — only uploader can delete, or any member can delete; enforced by `deleteTripMedia` when allowed.

**Layout:** Mobile-friendly (dynamic viewport, safe areas). **Device detection** (user agent): desktop gets top nav only; mobile gets bottom nav + compact top bar. See `useLayoutMode` / `useIsMobile` in `src/hooks/useIsMobile.ts`.

## Key paths

- `src/app/` — pages (page, gallery, trips, profile), layout, globals.css
- `src/components/` — Navbar, MediaGallery, MediaUpload, UploadModal, TripSelector, SetUsernamePrompt, LoginVideoBackground, ConfigureAmplify, ClientLayout, LoadingSpinner
- `src/hooks/` — useActiveTrip, useUserProfile, useIsMobile
- `amplify/` — auth, data (schema + delete-media-handler), storage; backend.ts

## Run locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the backend (Amplify sandbox)**  
   In a separate terminal, from the project root:
   ```bash
   npm run sandbox
   ```
   If that fails with “could not determine executable”, use the full package name:
   ```bash
   npx @aws-amplify/backend-cli sandbox
   ```
   - Requires AWS CLI configured (`aws configure` or env vars).  
   - For **Google sign-in**: set secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (e.g. in Amplify Console → App settings → Environment variables, or the CLI will prompt). You can skip this and use **email/password** sign-in only.  
   - When the sandbox is ready, it prints the path to `amplify_outputs.json` (e.g. under `.amplify/` or in the CLI output).

3. **Put `amplify_outputs.json` at the repo root**  
   Copy the file from the path the sandbox printed to the project root:
   ```bash
   cp /path/sandbox/printed/amplify_outputs.json ./
   ```
   (Replace with the actual path from step 2.)

4. **Start the frontend**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Sign in with email or Google (if configured), then create/join a trip and try uploads and the gallery.

**Production:** Deploy backend with `npx ampx pipeline-deploy --branch main --app-id <ID>`. Frontend is hosted on **AWS Amplify Hosting** (e.g. [trip-wrapped.com](https://trip-wrapped.com)). Auth callback/logout URLs in `amplify/auth/resource.ts` include localhost and trip-wrapped.com. Keep `package.json` and `package-lock.json` in sync so Hosting’s `npm ci` succeeds.

### Local vs production config

Use **one** `amplify_outputs.json` at the **repo root** for both local and Amplify Hosting so behavior stays in sync.

| Environment | What to do |
|-------------|------------|
| **Local** | After `npm run sandbox`, copy the generated file to the repo root: `cp .amplify/artifacts/amplify_outputs.json ./` (or the path the CLI prints). |
| **Production (Hosting)** | Either (1) **commit** production `amplify_outputs.json` at root and push, or (2) in Amplify Hosting build settings set **NEXT_PUBLIC_AMPLIFY_OUTPUTS** to the stringified JSON so the pipeline injects config without relying on the repo file. |

Do not commit a second copy under `src/`; the app only reads from the root file (or the env var). This avoids local vs production conflicts.

## Repo

[https://github.com/matthewljk/Tripwrapped](https://github.com/matthewljk/Tripwrapped)
