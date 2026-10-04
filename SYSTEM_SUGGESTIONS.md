# Nexus system analysis & suggestions

This document is based on what’s currently in the repository (front-end code under `src/`, Vite config, and env examples). It focuses on **actionable, file-specific improvements**.

## Current system (what you have today)

- **Frontend**: React 19 + TypeScript (Vite). See `package.json`, `src/main.tsx`, `src/App.tsx`.
- **Styling**: Tailwind v4 via `@tailwindcss/vite`. See `vite.config.ts`, `src/index.css`.
- **Environment variables**: `.env.example` includes `GEMINI_API_KEY` and `APP_URL`.
- **Tracking/audit (client-side)**:
  - `src/lib/session.ts` writes session events to `localStorage` key `nexus.sessions`.
  - `src/lib/actions.ts` captures UI interactions and writes them to `localStorage` key `nexus.actions`.
  - `src/screens/TrackingScreen.tsx` reads `nexus.sessions` and allows exporting to JSON/CSV.
- **Auth/roles**: Currently simulated (mock users + role-based view filtering) in `src/App.tsx`.
- **Backend**: `express` is listed as a dependency, but there’s no Express entrypoint visible in the repo root yet.

## Highest-priority issues (fix first)

### 1) **Do not ship `GEMINI_API_KEY` to the browser**

In `vite.config.ts`, you define:

- `define: { 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY) }`

That makes the key available in the client bundle (anyone can extract it from DevTools / the built JS). Even if this is “only dev”, it’s an unsafe default and usually becomes production by accident.

**Suggestions**

- **Move Gemini calls server-side** (recommended): create a small backend endpoint (Express or serverless) that receives a user request and calls Gemini using the secret on the server only.
- **Remove the `define` injection** and stop referencing `process.env.*` from browser code.
- If you absolutely must pass a non-secret value to the client, use Vite’s safe mechanism: `import.meta.env.VITE_*` (and only for non-secrets).

**Why it matters**

- Exposed API keys can be abused, incur costs, and can get your project locked.

### 2) Treat `localStorage` tracking as sensitive data

Right now you store a lot of event metadata, including form field values (`src/lib/actions.ts` captures `value` for inputs/selects/textarea). This can accidentally collect phone numbers, addresses, notes, or other personal data.

**Suggestions**

- **Stop capturing raw input values by default**. In `src/lib/actions.ts`, remove `value` capture (or redact it) unless explicitly allowed per field.
- Add a clear **retention policy** (e.g., 7 days) and implement it when writing `nexus.sessions` / `nexus.actions` (currently only capped by count, default 500).
- Add a **“Clear history”** button in `TrackingScreen` (and/or Settings) to wipe local audit data.
- If you plan to make this a real audit trail: **send events to the backend** (append-only storage), and only keep a small local buffer.

**Why it matters**

- `localStorage` is readable by any script running on your domain; it’s not a secure audit store.
- Accidental PII collection increases compliance and breach risk.

### 3) Hard-coded mock credentials and users

`src/App.tsx` contains:

- hard-coded users with emails and avatars
- a prefilled password field (`defaultValue="password123"`)
- UI text suggesting “backend + auth later”

**Suggestions**

- Keep demo data behind a clear **development flag** (e.g. `import.meta.env.DEV` or a `VITE_DEMO_MODE=true`) and ensure production builds don’t expose it.
- When you implement auth, replace role checks in the UI with **server-issued claims** (JWT/session) and enforce authorization on the backend too.

## Architecture / code quality suggestions

### 4) Introduce a real backend boundary (API layer)

You already depend on `express` and `dotenv`, but there’s no visible server entrypoint. To grow safely:

- Add a `server/` folder (or `api/`) with:
  - `server/index.ts` (Express app)
  - `/api/*` routes for Gemini proxying, auth, data CRUD
- In the React app, add a small client wrapper like `src/lib/api.ts` to call your endpoints.

This will also solve the `GEMINI_API_KEY` issue cleanly.

### 5) Tighten TypeScript settings (prevent bugs early)

`tsconfig.json` does not include common safety options (`strict`, `noUncheckedIndexedAccess`, etc.).

**Suggestions**

- Turn on `compilerOptions.strict: true` (and fix incrementally if needed).
- Consider:
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `noFallthroughCasesInSwitch: true`

If flipping everything is too disruptive, create `tsconfig.strict.json` and run it in CI first.

### 6) Add a formatter/linter beyond “tsc --noEmit”

In `package.json`, `lint` is only `tsc --noEmit`. That catches type issues, but not:

- unused imports/vars
- inconsistent formatting
- React hooks lint rules

**Suggestions**

- Add ESLint + `eslint-plugin-react-hooks` (and optionally Prettier).
- Add scripts: `lint:fix`, `format`, `format:check`.

### 7) Reduce single-file complexity (`src/App.tsx`)

`src/App.tsx` currently contains:

- login UI
- role matrix
- large mock datasets (orders, shipments, products, charges…)
- navigation definitions
- screen routing

**Suggestions**

- Split into:
  - `src/app/auth/*`
  - `src/app/nav/*`
  - `src/app/mock/*` (or fixtures)
  - `src/app/state/*` (or a store layer)
- Move mock data into dedicated files so you can later replace it with API data cleanly.

## Security & deployment suggestions

### 8) Dev server exposure

Your dev script runs: `vite --port=3000 --host=0.0.0.0`.

**Suggestions**

- For local dev on a laptop, default to `--host=127.0.0.1` unless you explicitly need LAN access.
- If you need LAN access, document it and ensure Windows Firewall rules are correct.

### 9) Secrets handling hygiene

`.gitignore` ignores `.env*` except `.env.example` (good).

**Suggestions**

- Add a `SECURITY.md` or a short section in your README (once readable) describing:
  - which env vars are secrets
  - which are safe to expose to the client
  - where to put them (`.env.local`, server env, CI secrets)

## Product/data modeling suggestions (medium priority)

### 10) Move from in-memory state to persistence

All domain entities (orders, shipments, products, charges) are currently in React state and reset on refresh.

**Suggestions**

- Short-term: persist core datasets in `IndexedDB` (better than localStorage for volume) or use a backend.
- Long-term: backend + database, with audit trail storage separate from operational data.

### 11) Audit taxonomy and event naming

You already have a good start with names like `audit.confirmatrice.admin_select_user`.

**Suggestions**

- Define an event naming convention doc (small) and enforce it (helper builder).
- Add a `version` field to events so you can evolve the schema.

## Testing & CI suggestions

### 12) Add basic automated checks

No test/CI config is visible.

**Suggestions**

- Add GitHub Actions workflow to run:
  - install
  - `npm run lint`
  - `npm run build`
- Add at least smoke tests:
  - unit tests for domain utils
  - component tests for critical UI flows

## Concrete next steps (suggested order)

1. **Remove client-side Gemini key exposure** (change `vite.config.ts`, add a server endpoint, call it from the client).
2. **Redact tracking data** (stop capturing input `value` by default, add “clear history”).
3. Add a basic **Express server** (or serverless) and move secrets there.
4. Introduce **ESLint + formatting** and a minimal **CI** workflow.
5. Refactor `src/App.tsx` into smaller modules and move mock data into fixtures.

