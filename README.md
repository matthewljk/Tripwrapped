# TripWrapped

Next.js app for shared trip photo/video galleries. Users sign in (Google or email), create or join trips by code, set a default trip, upload media, and view a trip gallery.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind 4
- **Backend:** AWS Amplify Gen 2 — Auth (Cognito, Google + email), Data (AppSync/DynamoDB), Storage (S3)
- **Config:** `amplify/` (auth, data, storage, backend), `amplify_outputs.json` (generated; use `src/amplify_outputs.json` for the app)

## Data model (`amplify/data/resource.ts`)

- **Trip** — `tripCode`, `name`, `allowAnyMemberToDelete` (trip setting for who can delete gallery media); GSI on tripCode
- **TripMember** — `tripId`, `userId`, `role`; GSIs on tripId, userId
- **Media** — `tripId`, `storagePath`, `uploadedBy`, `uploadedByUsername`; GSI on tripId. Files in S3 at `media/{entity_id}/*`
- **UserPreference** — `activeTripId` (default trip per user)
- **UserProfile** — `userId`, `username` (display name for uploads); GSI on userId

Custom mutation **`deleteTripMedia(mediaId)`** — allows a trip member to delete media when the trip setting “Any trip member can delete” is on (enforced via Lambda).

## Routes & features

- **/** — Upload: default-trip selector, “Add photo or video” → UploadModal
- **/gallery** — Trip gallery: default-trip selector, MediaGallery (masonry, lightbox, refresh, uploader avatar, delete with policy)
- **/trips** — Create/join trip by code, switch active trip, trip settings (owners): “Any trip member can delete photos/videos”
- **/profile** — Set/change username; manage/leave trips

**Auth:** Amplify `<Authenticator>` (Google + email). First-time email users get a set-username prompt; Google users use profile from name. Optional login background video from `public/login-videos/background.mp4` or `.webm`.

**Delete policy:** Per trip, owners choose:
- **Only delete my own uploads** — only the uploader sees a delete button on their items.
- **Any trip member can delete** — all members can delete any photo/video in the gallery.

## Key paths

- `src/app/` — pages (page.tsx, gallery, trips, profile), layout.tsx, globals.css
- `src/components/` — Navbar, MediaGallery, MediaUpload, UploadModal, TripSelector, SetUsernamePrompt, LoginVideoBackground, ConfigureAmplify
- `src/hooks/` — useActiveTrip, useUserProfile
- `amplify/` — auth, data (schema + delete-media-handler), storage resource definitions; backend.ts

## Run

```bash
npm install
npm run dev
```

**Backend:** `npx ampx sandbox` (uses secrets for Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Copy generated `amplify_outputs.json` into `src/` if needed.

**Production:** Deploy backend with `npx ampx pipeline-deploy --branch main --app-id <ID>`; host frontend (e.g. Vercel) with production outputs. Auth callback/logout URLs in `amplify/auth/resource.ts` include localhost and trip-wrapped.com.

## Repo

[https://github.com/matthewljk/Tripwrapped](https://github.com/matthewljk/Tripwrapped)
