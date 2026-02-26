# TripWrapped

Shared trip photo/video galleries and expense splitting. Sign in (Google or email), create or join trips by code, upload media, view gallery, daily journal (photo trail + per-location ratings/reviews), trip map, and O$P$ (balances, budget, settlements). Next.js 16 (App Router) + AWS Amplify Gen 2.

---

## Quick start

1. **Install and run backend** (separate terminal): `npm install` then `npm run sandbox`. Requires AWS CLI.
2. **Copy config:** `cp .amplify/artifacts/amplify_outputs.json ./`
3. **Run app:** `npm run dev` → [http://localhost:3000](http://localhost:3000)

**Deploy:** Push to `main` to trigger AWS Amplify Hosting build. Backend is deployed via `ampx pipeline-deploy` in `amplify.yml`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Amplify Console → Hosting → **Secrets** (not just env vars). Ensure `package-lock.json` is committed when deps change.

**Ratings, reviews, or location names not persisting after refresh?** The journal saves them to the `Media` model (rating, review, locationName). If they disappear on reload, the backend API may not have the latest schema. Re-run the sandbox so AppSync/DynamoDB pick up schema changes: stop sandbox, then `npm run sandbox` again (and re-copy `amplify_outputs.json` if the API URL changed).

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
    page.tsx            # / — Add: upload, Add transaction (expandable)
    gallery/page.tsx    # /gallery
    journal/page.tsx    # Daily Journal (POIs, highlight, ratings)
    ops/page.tsx        # O$P$ — balances, budget, settlements, transaction history
    wrap-it-up/page.tsx # Trip map (Mapbox) + trip recap video (stats, media selection, orientation, generate/play/download)
    trips/page.tsx      # /trips — Account (active trip, join, create, profile, sign out)
    profile/page.tsx    # Redirects to /trips
    globals.css
  components/
    ClientLayout.tsx    # Auth gate: landing (Join/Create trip) or Authenticator + app; redirect to / after sign-in
    ConfigureAmplify.tsx # Amplify.configure(outputs); single entry for config
    Navbar.tsx          # Logo (public/login-videos/Icon.png) + TripWrapped, nav links
    LoginVideoBackground.tsx # Horses.mp4 background when unauthenticated
    LoginCover.tsx      # Icon + TripWrapped + tagline (used in auth modal)
    LoginLanding.tsx    # Unauthenticated: cover + Join a trip / Create a trip (opens auth modal)
    AuthModal.tsx       # Sign-in/sign-up modal (Authenticator); light overlay so background visible
    RedirectToTripsIfNeeded.tsx # Redirect to / after login when auth_redirect=home
    MediaUpload.tsx     # Upload UI, S3 + Media create (EXIF/video metadata); 50 MB max, 15 s max video
    MediaGallery.tsx    # Grid + metadata view, sort, load more, list cache, download/delete
    UploadModal.tsx
    TripSelector.tsx
    TransactionForm.tsx # Add transaction: category, date (or accommodation start/end), split; currency from trip
    TripMap.tsx         # Mapbox Standard, 3D terrain, memory heatmap, photo markers
    DailyCard.tsx       # Journal day card (highlight, Photo Trail, per-location expand, rating/review, summary)
    WrapRecap.tsx       # Stats + media selector (check/uncheck) + TripVideoCompiler
    WrapRecapMediaSelector.tsx # Per-day grid of thumbnails; exclude from recap by unchecking
    TripVideoCompiler.tsx # Orientation (landscape/portrait), compile video in-browser (canvas + MediaRecorder), play or download
    SetUsernamePrompt.tsx
    LoadingSpinner.tsx
  hooks/
    useActiveTrip.ts
    useUserProfile.ts
    useIsMobile.ts
    useWrapRecapData.ts # Fetches trip, media, transactions; buildWrapRecap for stats + days/highlights
  lib/
    poiClustering.ts   # POI clustering (100 m for journal), highlight score, date grouping
    tripStats.ts       # Journey distance (Haversine) from time-sorted media with lat/lng
    wrapRecap.ts       # buildWrapRecap, getVideoTimeline, getLocationNamesForDay, filterRecapByExcluded
    googlePlaces.ts    # Resolve POI name via /api/places/nearby (Google Places searchNearby), SavedLocation fallback
  app/api/places/nearby/
    route.ts           # POST: proxy to Google Places API (New) searchNearby; type-priority pick; GOOGLE_MAPS_API_KEY
amplify/
  backend.ts            # DynamoDB on-demand billing (pay-per-request, hobby-friendly)
  auth/resource.ts
  data/resource.ts      # Schema (Trip startDate, endDate, budgetPerPax; any authenticated can update Trip), deleteTripMedia + cleanupEmptyTrip
  data/delete-media-handler/handler.ts   # deleteTripMedia (name: deleteTripMedia)
  data/cleanup-empty-trip-handler/handler.ts  # cleanupEmptyTrip when last member leaves (name: cleanupEmptyTrip)
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
- **Backend cost:** DynamoDB is set to on-demand (pay-per-request). Two Lambdas (delete-media, cleanup-empty-trip) use minimal memory; suitable for hobby use. Each function has an explicit `name` in `amplify/data/resource.ts` to avoid CDK construct ID clashes (both entry files are `handler.ts`).

**Two backends:** Local and production use **different** Amplify backends (e.g. sandbox vs pipeline-deployed). When you change the schema, deploy the production backend too so both have the same models (e.g. `Media` with `lat`, `lng`, `timestamp`).

**How to sync both backends:** The schema in `amplify/` is the single source of truth. (1) **Sandbox (local):** run `npm run sandbox` so the local backend has the latest schema; copy `cp .amplify/artifacts/amplify_outputs.json ./` for the Next app. (2) **Production:** push your branch (e.g. `main`) to trigger the Amplify build. If the app is set up for fullstack (backend + frontend), the build deploys the backend for that branch, then the frontend. If only the frontend is deployed by Amplify, deploy the production backend yourself: from the repo run `npx ampx pipeline-deploy --branch <branch> --app-id <AMPLIFY_APP_ID>` (get the app id in Amplify Console → App settings → General). After the backend deploy, run `npx ampx generate outputs --app-id <id> --branch <branch> --out-dir .` to get the new `amplify_outputs.json`, then set `NEXT_PUBLIC_AMPLIFY_OUTPUTS` in Hosting to that file’s stringified contents and redeploy the frontend.

**Deployed app can't see metadata but local can:** Production talks to the production backend. Deploy that backend with the current schema, set hosting's `NEXT_PUBLIC_AMPLIFY_OUTPUTS` to its outputs, and redeploy the frontend. New uploads will then have metadata; existing production records may need re-upload.

**Production deploy:** The repo has `amplify.yml` so each build deploys the backend then the frontend. In Amplify Console → Hosting → **Secrets**, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the branch. Trigger a build (push to `main` or Redeploy). **Google sign-in:** In Google Cloud Console → Credentials → your OAuth client, add this exact Authorized redirect URI: `https://<cognito-domain>.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse` (get `<cognito-domain>` from Amplify backend outputs or Hosting env, e.g. `065e0ecce9ee9ba17e6a`).

**Metadata not saved on upload in production:** The app sends lat/lng/timestamp when creating each Media record. If the production backend was deployed before the `Media` model had these fields, they won't be stored. Fix: deploy the production backend with the current schema (see "How to sync both backends" above). After that, new uploads will persist metadata. No frontend change required.

**Trip currency (or other Trip settings) not saving in production:** Trip settings are stored on the `Trip` model (e.g. `baseCurrency`). If the production backend was deployed before these fields existed in the schema, the server won't persist them. The app will show an amber message after Save if it detects the server didn't store the currency. Fix: ensure the **backend** phase of your Amplify build runs and succeeds (see `amplify.yml`: `npx ampx pipeline-deploy`). If you use a build that only runs the frontend, run `npx ampx pipeline-deploy --branch main --app-id <AMPLIFY_APP_ID>` from the repo, then redeploy the frontend. After the production backend has the current schema, Trip settings will persist.

**Still seeing "server did not store it" after a successful deploy?** (1) In Amplify Console → your build → **Build logs**, confirm the **backend** phase ran and you see "Deployment completed" and "Completed Backend Build". If only the frontend phase runs, the API in production is unchanged. (2) If Hosting has **Environment variables** set for `NEXT_PUBLIC_AMPLIFY_OUTPUTS`, that overrides the `amplify_outputs.json` produced in the same build. Either remove that variable so the app uses the backend from the current build, or after every backend deploy run `npx ampx generate outputs --branch main --app-id <ID> --out-dir .`, stringify the new `amplify_outputs.json`, and update that env var in Hosting, then redeploy.

**Schema and verifying the backend:** The source of truth is `amplify/data/resource.ts`. When you redeploy (push to `main` or Redeploy in Amplify), the **backend** phase deploys this schema to production (AppSync + DynamoDB). The **Trip** model includes `baseCurrency`, `startDate`, `endDate`, `budgetPerPax`, `allowAnyMemberToDelete`, etc. After a full deploy, the frontend build uses the `amplify_outputs.json` just written by the backend; that file includes `data.model_introspection` describing the deployed API (e.g. `Trip.fields.baseCurrency`). So if you redeploy now, the backend will have the current schema and Trip settings (including currency) should persist. To inspect the schema locally: open `amplify_outputs.json` (after a sandbox or `ampx generate outputs`) and see `data.model_introspection.models.Trip.fields`.

**Save settings flow and why server might not persist:** (1) **Expected:** User enters currency (or dates, budget, etc.) → clicks **Save settings** → app calls `client.models.Trip.update({ id, baseCurrency, ... })` → AppSync runs the update mutation → DynamoDB is updated → response returns the updated Trip including `baseCurrency`. (2) **What can go wrong:** If the production AppSync API was deployed from an older schema that did not include `baseCurrency`, the GraphQL type and resolvers won’t know about it. The client still sends the field, but AppSync/VTL resolvers typically ignore unknown fields. The mutation succeeds (no error), DynamoDB is not updated for that field, and the response may omit `baseCurrency` or return the old value. The app then compares `updated?.baseCurrency` to the value just saved and shows the amber “Currency is saved in this browser but the server did not store it” message. (3) **Fix:** Deploy the backend with the current schema (full Amplify build or `ampx pipeline-deploy`); do not override `NEXT_PUBLIC_AMPLIFY_OUTPUTS`. (4) **Workaround:** The app writes the chosen currency to `sessionStorage` so the Add page and forms use it even if the server didn’t persist it, and uses a **default currency** (e.g. KRW, see `src/lib/constants.ts`) when neither trip nor session has a value.

**How to check if production has `baseCurrency`:** (1) **Browser:** On the deployed app, open DevTools → **Network**. Change trip currency and click **Save settings**. Find the GraphQL request (e.g. `updateTrip` or the AppSync endpoint). In the **Response** tab, look at the returned `data.updateTrip` (or similar) object: if it does **not** include `baseCurrency`, the production API is not returning it (schema/resolver doesn’t have it). (2) **Production outputs:** Run `npx ampx generate outputs --branch main --app-id <AMPLIFY_APP_ID> --out-dir .` (with your app id from Amplify Console). Open the generated `amplify_outputs.json` and check `data.model_introspection.models.Trip.fields`: if `baseCurrency` is missing, the deployed schema doesn’t include it. (3) **AWS Console:** AWS → **AppSync** → select your API (name usually includes the branch) → **Schema**. Search for the `Trip` type and see if `baseCurrency` is listed; if not, the live schema is old.

**"Unauthorized on [endDate, startDate, budgetPerPax]" when saving trip settings:** If the GraphQL response has `data.updateTrip: null` and `errors: [{ message: "Unauthorized on [endDate, startDate, budgetPerPax]" }]`, the production AppSync API is **rejecting the update** due to authorization (not a missing field). The repo schema has `allow.authenticated().to(['read', 'create', 'update'])` on Trip so any signed-in user should be able to update. If production was deployed from an older schema where only the trip owner could update, you get this error. **Fix:** Redeploy the backend from the current repo (full Amplify build or `npx ampx pipeline-deploy --branch main --app-id <ID>`). After deploy, any authenticated trip member can update Trip settings.

---

## First-time user experience

1. **Landing:** User sees the cover (video background, TripWrapped + “Collecting your memories”) and two actions: **Join a trip** and **Create a trip**. Both open the same auth flow.
2. **Sign-in popup:** Clicking either opens a modal to **sign in** or **create an account** (Google or email). After they complete auth, the modal closes.
3. **Username (first time only):** If they don’t have a username yet, a modal asks them to **choose a username** (how they’ll appear on photos/videos). After they save, they’re taken to the account page.
4. **Landing after sign-in:** They land on **/** (add page: upload, add transaction). From the account area they can go to **/trips** to join or create a trip.

---

## Routes

| Path           | Role |
|----------------|------|
| `/`            | **Add:** trip selector; photo/video upload (50 MB max per file, 15 s max video; HEIC → JPEG in-browser); **Add transaction** (expandable, category → date; accommodation = start/end date; currency defaults to trip currency from Trip settings, then sessionStorage, then app default (KRW)). |
| `/gallery`     | Masonry grid (load more), sort (date/type/user/favorites), lightbox, select mode for download/delete, favorite. Media loads when ready (no flash). |
| `/journal`    | Daily Journal: media by date and POI (~100 m). Photo Trail, per-location rating/review, Google Places POI names, highlight image. |
| `/wrap-it-up`  | **Map** (Mapbox Standard, 3D terrain): memory heatmap, photo markers. **Trip recap:** stats, choose which photos/videos to include, pick orientation (landscape/portrait), generate a Spotify-style recap video in-browser (intro + day cards with locations + media); play in app or download WebM. Days with no selected/orientation-matching media are skipped. |
| `/ops`         | **O$P$:** your balance, budget (trip budget per person, total expense, % utilised, per person), settle-up list, transaction history (top 3 days by default, expand for more). |
| `/trips`       | **Account:** active trip (selector, trip settings expandable, leave trip), join by code, create trip (expandable). **Trip codes** are normalised to uppercase with no spaces (e.g. BALI2026) for uniqueness; create and join inputs enforce this. Profile (username), sign out (red button). Trip settings: currency (default SGD), start/end date, budget per person, who can delete; any member can edit and save. Leave trip (red button); when last member leaves, trip and all media/transactions are deleted. |
| `/profile`     | Redirects to `/trips`. |

**Wrap It Up:** Requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local` (or in Amplify Hosting env). Get a token at [mapbox.com](https://account.mapbox.com/access-tokens/).

**Daily Journal (POI names):** Uses Google Places API (New) via server route `/api/places/nearby`. Set `GOOGLE_MAPS_API_KEY` in `.env.local` for local dev (server-side only; never use `NEXT_PUBLIC_`). For production, add `GOOGLE_MAPS_API_KEY` in the same place as your other Google keys: Amplify Console → Hosting → Environment variables (or Secrets) for the branch, then redeploy; otherwise `/api/places/nearby` returns 503. The build writes it into `.env.production` so API routes can use it (see `amplify.yml`). In Google Cloud Console enable "Places API (New)", create an API key, and restrict it by HTTP referrer or IP. See `.env.example`.

---

## Repo

[https://github.com/matthewljk/Tripwrapped](https://github.com/matthewljk/Tripwrapped)
