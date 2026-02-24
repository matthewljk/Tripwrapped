# Run TripWrapped locally

Do these steps **in your terminal** (from the project root: `tripwrapped/`).

## 1. Clean install (if you had "next: command not found" or npm errors)

```bash
cd /Users/matthew/tripwrapped
rm -rf node_modules
npm cache clean --force
npm install
```

If `rm -rf node_modules` fails on some files (e.g. `.vscode` inside a package), close VS Code/Cursor, then run the `rm` again, or delete the `node_modules` folder from Finder.

## 2. Start the backend (Amplify sandbox)

Open a **second terminal**, same folder:

```bash
cd /Users/matthew/tripwrapped
npm run sandbox
```

If you see "could not determine executable":

```bash
npx @aws-amplify/backend-cli sandbox
```

- Use AWS CLI configured (`aws configure`).
- When it finishes, it will print where it wrote **amplify_outputs.json** (e.g. `.amplify/artifacts/amplify_outputs.json`).

## 3. Copy amplify_outputs.json to project root

In a **third terminal** (or after sandbox is running), copy the file using the path from step 2:

```bash
cd /Users/matthew/tripwrapped
cp .amplify/artifacts/amplify_outputs.json ./
```

(If the sandbox printed a different path, use that instead.)

## 4. Start the frontend

In your **first terminal** (or any terminal):

```bash
cd /Users/matthew/tripwrapped
npm run dev
```

## 5. Open the app

Go to **http://localhost:3000** and sign in (email or Google).

---

**Summary:** Terminal 1 → `npm install` then `npm run dev`. Terminal 2 → `npm run sandbox`. After sandbox is up → copy `amplify_outputs.json` to repo root → refresh or start dev server.
