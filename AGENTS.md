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
