# Anjani Staff Task Command Center

## About

Local staff task management system for Anjani Medical. Runs entirely on your company network — no cloud, no internet required.

## Login Credentials

| Role    | Username  | Password    | Access                                      |
|---------|-----------|-------------|---------------------------------------------|
| Admin   | `admin`   | `admin123`  | Full access — all pages, manage staff/tasks |
| Manager | `manager` | `manager123`| Tasks, Staff (view), Reports — no Settings  |
| Staff   | `staff`   | `staff123`  | Own tasks only, update status               |

## Running on Mac (Development)

**Requirements:** Node.js 18+, npm

```bash
# 1. Install all dependencies (run once)
npm run install:all

# 2. Start the full app (frontend + backend together)
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

## Running on Windows (Company Server)

**Requirements:** [Node.js 18+ for Windows](https://nodejs.org/en/download)

```bash
npm run install:all
npm run dev
```

Open a browser and go to: `http://localhost:5173`

> If port 3001 is blocked by a firewall, set the environment variable `PORT=3002` before starting.
> For production: run `npm run build` then serve the `frontend/dist/` folder with any static file server or IIS.

## Project Structure

```
anjani-task-center/
├── package.json              # Root — dev/build scripts (concurrently)
├── README.md
├── backend/
│   ├── package.json
│   ├── data/
│   │   └── anjani.db         # SQLite database (auto-created on first run)
│   └── src/
│       ├── index.js          # Express server, CORS, routes wiring
│       ├── database.js       # better-sqlite3 init, schema, seed data
│       └── routes/
│           ├── tasks.js      # GET/POST/PUT/PATCH/DELETE /api/tasks
│           └── staff.js      # GET/POST/PUT/DELETE /api/staff
└── frontend/
    ├── package.json
    ├── vite.config.js        # Vite + /api proxy → localhost:3001
    ├── tailwind.config.js
    └── src/
        ├── App.jsx           # Routes: login, dashboard, tasks, staff…
        ├── main.jsx
        ├── index.css         # Tailwind + custom utilities
        ├── context/
        │   └── AuthContext.jsx
        ├── services/
        │   ├── api.js        # All fetch calls to the backend
        │   ├── auth.js       # localStorage-based login (hardcoded users)
        │   ├── permissions.js# Role → permission matrix
        │   └── storage.js    # Settings (localStorage) + backup/import helpers
        ├── components/
        │   ├── Toast.jsx
        │   ├── ui/Toast.jsx
        │   └── layout/
        │       ├── Layout.jsx
        │       ├── Sidebar.jsx
        │       ├── TopBar.jsx
        │       └── ProtectedRoute.jsx
        ├── hooks/
        │   ├── useApi.js
        │   └── useToast.js
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx   # Stats, today's tasks, staff progress, calendar
            ├── Tasks.jsx       # Full task CRUD + filters
            ├── Staff.jsx       # Staff CRUD + per-staff task stats
            ├── Calendar.jsx    # Monthly calendar with task dots
            ├── Reports.jsx     # Charts and summaries
            ├── Settings.jsx    # General, categories, backup/export, about
            └── AccessDenied.jsx
```

## Tech Stack

| Layer    | Technology                                       |
|----------|--------------------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS                     |
| Backend  | Node.js, Express                                 |
| Database | SQLite via better-sqlite3                        |
| Auth     | localStorage (hardcoded users), role-based perms |

## Phase Completion

- **Phase 1** — Scaffold + health check ✓
- **Phase 2** — Dashboard · Tasks · Staff · Calendar · Reports ✓
- **Phase 3** — Auth · Roles · Settings · Backup & Data tools ✓

## Files Created / Modified in Phase 3

### Created
- `frontend/src/context/AuthContext.jsx` — React auth context (login/logout/user state)
- `frontend/src/services/auth.js` — Hardcoded user store + localStorage session
- `frontend/src/services/permissions.js` — Role → permission map
- `frontend/src/services/storage.js` — Settings persistence + export/import/reset helpers
- `frontend/src/pages/Login.jsx` — Login form with credential validation
- `frontend/src/pages/Settings.jsx` — 4-tab settings page (General, Categories, Backup, About)
- `frontend/src/pages/AccessDenied.jsx` — Shown when role lacks permission
- `frontend/src/components/layout/ProtectedRoute.jsx` — Redirects unauthenticated users
- `frontend/src/components/ui/Toast.jsx` — Toast context + provider (used by Settings)
- `frontend/src/hooks/useToast.js` — useToast hook

### Modified
- `frontend/src/App.jsx` — Added AuthProvider, ToastProvider, login route, protected routes
- `frontend/src/components/layout/Sidebar.jsx` — Role-based nav filtering, logout button
- `frontend/src/pages/Tasks.jsx` — Staff role scoping (own tasks only), permission guards
- `frontend/src/pages/Dashboard.jsx` — Role-aware stat cards and task visibility
- `frontend/src/pages/Staff.jsx` — Permission guards on edit/delete
- `backend/src/index.js` — Port changed to 3001 (was 5000)
- `vite.config.js` — Proxy target updated to port 3001

## Future Migration (Phase 4+)

- Replace localStorage auth with JWT + backend `/api/auth/login`
- PostgreSQL migration path: swap `better-sqlite3` for `pg`, schema is portable
- Windows deployment: PM2 (`pm2 start backend/src/index.js`) or IIS with `iisnode`
- Mobile app: REST API is already in place, connect a React Native client
