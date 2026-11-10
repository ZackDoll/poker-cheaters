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

- The username/password form on the login page is visual only (non-functioning). Do not add password auth unless asked.
- Google OAuth is the working login. Backend is Vercel serverless functions in `api/` (`api/auth/google.js`, `api/auth/google/callback.js`, `api/auth/me.js`, `api/auth/logout.js`), with shared code in `api/_lib/`. Database is Postgres (Neon) via `@neondatabase/serverless`; schema is in `db/schema.sql`.
- Sessions are httpOnly cookies; only a sha256 hash of the token is stored in `auth_sessions`.
- Secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `APP_URL`) live only in `.env.local` and Vercel env vars. Never commit them or paste them into chat. `.env.example` lists the names.
- Frontend calls to the API still go through the axios instance (`helpers/api.js`, `helpers/auth.js`). The Google button is a plain link to `/api/auth/google`, because it is a browser redirect, not an API query.
- Run locally with `vercel dev` (port 3000) so `/api` works; plain `npm run dev` does not serve `/api`.

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

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint
