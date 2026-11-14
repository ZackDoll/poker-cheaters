# Project Conventions

React app (Vite) using standard JSX and plain CSS (no CSS-in-JS, no preprocessors, no TypeScript).

## Folder structure (all under `src/`)

- `images/` — image and static asset files imported by components/pages.
- `components/` — reusable components (e.g. `Sidebar.jsx`).
- `pages/` — one file per routed page (e.g. `LandingPage.jsx` at `/`, `HomePage.jsx` at `/home`).
- `helpers/` — helper scripts: API wrappers, utilities, shared logic (e.g. `api.js`).

Only `App.jsx`, `App.css`, `main.jsx`, and `index.css` live at the `src/` root.

## CSS rules

- Every page and component has its own CSS file with the same base name, in the same folder.
  Example: `pages/LandingPage.jsx` ↔ `pages/LandingPage.css`; `components/Sidebar.jsx` ↔ `components/Sidebar.css`.
- Each component imports its own CSS file. Prefix class names with the component name (e.g. `sidebar-links`) to avoid collisions.
- `index.css` is for global resets and the shared design tokens (`--tell-*` CSS variables: colors). Use the variables instead of hard-coded hex values.

## Login and backend

The app runs on Vercel alone: static frontend plus serverless functions in `api/` (Node), with Neon Postgres.

- **Login** (`api/auth/*`) is described below.
- **Card tracker** (`api/opponents.js`, `sessions.js`, `hands.js`, `actions.js`) is described under [Card tracker](#card-tracker).
- The FastAPI prediction skeleton in `backend/` is **dormant**: it isn't deployed or called by the frontend. See [Backend](#backend-dormant).

- The username/password form on the login page is visual only (non-functioning). Do not add password auth unless asked.
- Google OAuth is the working login. The login backend is Vercel serverless functions in `api/` (`api/auth/google.js`, `api/auth/google/callback.js`, `api/auth/me.js`, `api/auth/logout.js`), with shared code in `api/_lib/`. Database is Postgres (Neon) via `@neondatabase/serverless`; schema is in `db/schema.sql`.
- Sessions are httpOnly cookies; only a sha256 hash of the token is stored in `auth_sessions`.
- Secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `APP_URL`) live only in `.env.local` and Vercel env vars. Never commit them or paste them into chat. `.env.example` lists the names.
- Frontend calls to the API still go through the axios instance (`helpers/api.js`, `helpers/auth.js`). The Google button is a plain link to `/api/auth/google`, because it is a browser redirect, not an API query.
- Run locally with `vercel dev` (port 3000) so the `api/` functions work. Plain `npm run dev` serves only the frontend, so login and the tracker don't work there. `vercel env pull` can't fetch Sensitive values, so copy the Google and Neon values in by hand (see `.env.example`).

## Uploaded artifacts (zips, HTML, mockups)

Never copy an uploaded artifact in word for word. Always refactor it to follow this file:

- Split markup into React components/pages (`.jsx`), one per logical section or page, in the correct folder.
- Split styles into a matching `.css` file next to each component/page. Convert inline styles and `<style>` blocks to class names prefixed with the component name; move any global resets to `index.css`.
- Move images/assets into `images/` and import them.
- Convert inline scripts and behavior to React state/handlers; put shared logic in `helpers/`.
- Replace `<a href>` page links with `react-router` links, and any `fetch`/XHR with the axios instance in `helpers/api.js`.
- Don't leave the original artifact inside `src/`. Ask the user before deleting the uploaded zip or extracted folder.

## Routing

- Pages are routed with `react-router` (`BrowserRouter` in `main.jsx`, `Routes`/`Route` in `App.jsx`).
- To add a page: create `pages/XPage.jsx` + `pages/XPage.css`, then add a `<Route>` in `App.jsx` (and a link in `Sidebar.jsx` if needed).

## API queries

- All API queries use `axios`, through the shared instance in `helpers/api.js`. Do not use `fetch`.
- Base URL comes from `VITE_API_URL` (defaults to `/api`).
- Tracker calls are wrapped in `helpers/tracker.js` (one function per endpoint, plus `apiErrorText` for readable errors).

## Card tracker

One person logs a game at a real or online table: they pick an opponent, tap what that opponent did, get a bluff read on every bet or raise, and enter the cards an opponent shows. Nothing is real-time or multi-user, so it needs no WebSocket and fits on Vercel alone.

- **Pages:** `SessionsPage` (start or resume), `TrackerPage` at `/track/:sessionId` (the live screen), `SessionDetailPage` (review), `OpponentsPage` / `PlayerProfilePage` (profiles).
- **Data:** tables `tracker_opponents`, `tracker_sessions`, `tracker_hands`, `tracker_actions` in `db/schema.sql`. Everything belongs to one user, and every query filters by the logged-in user's id (see `ownedSession` etc. in `api/_lib/tracker.js`). Opponents are names the user types in, not accounts.
- **Scoring** lives in `api/_lib/`: `scoring.js` (hand-set rules on the bet and board, plus the face score, fused as log-odds), `bluffRule.js` (the label), `handEval.js`, `cards.js`. The estimate is **uncalibrated**: never call it a probability.
- **A bluff label** comes only from cards the user enters at showdown (`PATCH /api/hands` with `shown`). A bet is never given a label otherwise, and the opponent's cards are never an input to the read. `bluffRule.js` is a working definition that needs team sign-off before the labels are used for training.
- **Face reads** run in the user's own browser (`helpers/useFaceRead.js`). `helpers/faceCollector.js` boils the last 6 seconds down to `{ samples, trackedRatio, meanScore, deviations }`, and only that is sent with a logged action. Never send or store video, audio or landmarks. Tell evidence has log-odds 0, so it feeds the opponent profile and never changes the score.
- **Adding a function:** each file in `api/` is one serverless function (Vercel's Hobby plan allows 12), so group methods in one file using `route()` from `api/_lib/http.js` and pass ids as `?id=`.
- **Tests:** there is no JS test runner yet. When changing `api/_lib/`, check it against known hands and bluff cases before relying on it.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint

# Backend (dormant)

**Not deployed and not used by the frontend.** The live-rooms work that once lived here was removed when the app moved to Vercel alone (it is in git history, commit `f0fc29a`). The rest is kept for now so teammates' prediction/ML work isn't lost, and may be deleted later.

The prediction backend: FastAPI (Python 3.12 or 3.13) under `backend/`, with a local Postgres in Docker. This database is separate from the Neon database the login uses. Run commands from `backend/` with the virtual environment active.

## Folder structure (all under `backend/app/`)

- `api/routes/` — HTTP routes only. Business logic goes in `services/`.
- `services/` — runs the prediction flow: uploads, signal models, fusion, saving.
- `schemas/` — Pydantic request, response and model-output types.
- `db/` — SQLAlchemy tables and sessions. Schema changes need an Alembic migration.
- `ml/` — one folder per model. `ml/base.py` is the shared contract, and `ml/registry.py` lists the active models.

## Adding or implementing a model

1. Subclass `SignalModel` in `ml/<name>/model.py`. `predict()` returns `self.output(status, confidence, evidence)`.
2. Positive `log_odds` means toward a bluff. Each `Evidence.description` is shown to users as a reason.
3. Import heavy libraries inside `load()`, and list them as an extra in `pyproject.toml`.
4. A new model must be added to `build_registry()` and given a weight in `fusion_weights` in `config.py`. Bump `version` when behaviour changes.

## Rules

- Never accept the analysed player's cards as prediction input. They're only allowed in the outcome endpoint.
- Never store raw video or audio. Clips are deleted when the request ends.
- Keep `calibrated=False` until a decision model has been validated on held-out data.

## Commands

- `docker compose up -d --wait` — start Postgres (from the repo root)
- `alembic upgrade head` — apply migrations
- `alembic revision --autogenerate -m "message"` — create a migration, then review it
- `uvicorn app.main:app --reload` — start the API on port 8000
- `pytest` — run tests (uses the `poker_test` database)
- `ruff check .` — lint
