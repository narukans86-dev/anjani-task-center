# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anjani Staff Task Command Center — a local operations dashboard for Anjani Medical. The app is currently in Phase 1 (scaffold/health-check only). Phase 2 will add a full dashboard with task management modules.

## Commands

All commands run from the repo root.

```bash
# Install all dependencies (root + frontend + backend)
npm run install:all

# Run both frontend and backend in parallel (recommended for dev)
npm run dev

# Run backend only (port 5000, auto-restarts via --watch)
npm run server

# Run frontend only (port 5173)
npm run client

# Production build (frontend only)
npm run build
```

No test runner is configured yet.

## Architecture

Monorepo with two separate packages and a root orchestrator:

```
anjani-task-center/
├── package.json          # Root — concurrently scripts only, no app code
├── backend/              # Express + better-sqlite3 API
│   └── src/index.js      # Single-file server (all routes here for now)
└── frontend/             # React + Vite + Tailwind
    └── src/
        ├── App.jsx        # Single-component app (all UI here for now)
        ├── index.css      # Tailwind layers + custom utilities
        └── main.jsx       # React root mount
```

**Backend** (`backend/src/index.js`): Express on port 5000. Only live route is `GET /api/health`. Commented stubs show planned routes: `/api/tasks`, `/api/staff`, `/api/reports`. `better-sqlite3` is installed but not yet wired up.

**Frontend** (`frontend/src/App.jsx`): React 18 SPA on port 5173. On mount it fetches `/api/health` (proxied by Vite to `localhost:5000`) and renders a connection status card. All icons are inline SVG — no icon library dependency. Styling uses Tailwind utility classes plus three custom utilities defined in `index.css`: `.bg-grid-slate`, `.glow-teal`, `.card-glass`.

**Proxy**: Vite's dev server proxies `/api/*` to `http://localhost:5000`, so the frontend never hard-codes the backend port.

## Adding New Features

When adding backend routes, mount them in `backend/src/index.js` following the commented pattern (e.g., `app.use('/api/tasks', require('./routes/tasks'))`). When adding frontend pages or components, extend `App.jsx` or introduce a `src/components/` directory — neither routing nor a component library is set up yet, so add those before building multi-page flows.

The planned modules (listed in `App.jsx` as `FeaturePill` items) are: Dashboard, Today's Tasks, Calendar, Staff Progress, Performance, Reports, Recurring Tasks, CSV Export, Settings.
