# Step 2: Connect the hosted app to your production backend

The frontend needs `amplify_outputs.json` at **build time** (it’s imported in `ConfigureAmplify.tsx`). Use one of the two options below.

---

## Option A – Use the file you already have (simplest)

If your **production** backend is already deployed (e.g. from sandbox or pipeline) and the app at trip-wrapped.com should use that same backend:

1. **Use the correct outputs file**
   - From your **production** backend (same region, same Cognito/AppSync you want for trip-wrapped.com), get `amplify_outputs.json`.
   - If you’re still using the sandbox backend for now, use the file generated after `npx ampx sandbox` (in the project root or the path your CLI shows).
   - Ensure it includes the **production** callback URLs (`https://trip-wrapped.com/`, etc.) in the auth config. If not, update them in `amplify/auth/resource.ts`, redeploy the backend, then regenerate this file.

2. **Put it at the repo root**
   - Save that file as **`amplify_outputs.json`** at the **root** of your repo (same level as `package.json`).
   - Your app imports it from the root (`../../amplify_outputs.json` from `src/components/`), so the build will find it.

3. **Commit and push**
   ```bash
   git add amplify_outputs.json
   git commit -m "chore: add production amplify_outputs for Hosting"
   git push origin main
   ```
   The next Amplify Hosting build will use this file and the app will talk to your backend.

**Note:** `amplify_outputs.json` does not contain secrets (only resource IDs, endpoints, region). Committing it for a single production environment is a common approach.

---

## Option B – Deploy the backend with the CLI and then use its outputs

Use this when you want a dedicated **production** backend (e.g. from the `main` branch) and will point trip-wrapped.com at it.

1. **Deploy the backend**
   ```bash
   npx ampx pipeline-deploy --branch main --app-id <YOUR_AMPLIFY_APP_ID>
   ```
   Use the **backend** Amplify app ID (the one that has your Gen 2 backend, not necessarily the Hosting app). If you only have one Amplify app, use that ID.

2. **Get the generated outputs**
   - After the deploy finishes, the CLI may print the path to the generated `amplify_outputs.json`, or you can find it under the app’s build output / artifact folder (e.g. `.amplify/artifacts/...` or the path shown in the CLI).
   - Copy that file to the **root** of your repo as **`amplify_outputs.json`**.

3. **Commit and push**
   ```bash
   git add amplify_outputs.json
   git commit -m "chore: add production amplify_outputs for Hosting"
   git push origin main
   ```
   Trigger a new build in Amplify Hosting (or wait for the push to trigger it). The hosted app will now use this backend.

---

## After step 2

- Amplify Hosting will run `npm run build` with `amplify_outputs.json` at the root, so the bundle will have the correct backend config.
- Your auth already includes `https://trip-wrapped.com/` and `https://www.trip-wrapped.com/` in callback/logout URLs, so once the domain is set up (step 3), login will work at trip-wrapped.com.

If you use a **different** Amplify app for Hosting than for the backend, the Hosting app only needs this file in the repo; it doesn’t need the backend app ID for the build.
