# Project Conventions

React app (Vite) using standard JSX and plain CSS (no CSS-in-JS, no preprocessors, no TypeScript).

## Folder structure (all under `src/`)

- `images/` — image and static asset files imported by components/pages.
- `components/` — reusable components (e.g. `Sidebar.jsx`).
- `pages/` — one file per routed page (e.g. `LandingPage.jsx`).
- `helpers/` — helper scripts: API wrappers, utilities, shared logic (e.g. `api.js`).

Only `App.jsx`, `App.css`, `main.jsx`, and `index.css` live at the `src/` root.

## CSS rules

- Every page and component has its own CSS file with the same base name, in the same folder.
  Example: `pages/LandingPage.jsx` ↔ `pages/LandingPage.css`; `components/Sidebar.jsx` ↔ `components/Sidebar.css`.
- Each component imports its own CSS file. Prefix class names with the component name (e.g. `sidebar-links`) to avoid collisions.
- `index.css` is for global resets only.

## Routing

- Pages are routed with `react-router` (`BrowserRouter` in `main.jsx`, `Routes`/`Route` in `App.jsx`).
- To add a page: create `pages/XPage.jsx` + `pages/XPage.css`, then add a `<Route>` in `App.jsx` (and a link in `Sidebar.jsx` if needed).

## API queries

- All API queries use `axios`, through the shared instance in `helpers/api.js`. Do not use `fetch`.
- Base URL comes from `VITE_API_URL` (defaults to `/api`).

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint

# Backend

FastAPI (Python 3.12 or 3.13) under `backend/`, with Postgres in Docker. Run commands from `backend/` with the virtual environment active.

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
