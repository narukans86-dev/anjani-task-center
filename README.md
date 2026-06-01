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
# 1. Create .env from .env.example (run once)
cp .env.example .env

# 2. Install all dependencies (run once)
npm run install:all

# 3. Start the full app (frontend + backend together)
npm run dev
```

**Environment Variables:**
The `.env` file configures the application:
- `PORT`: Backend server port (default: 3001).
- `CORS_ORIGIN`: Allowed frontend origins for the backend API (e.g., `http://localhost:5173`).
- `VITE_API_BASE_URL`: Frontend's base URL for the backend API (e.g., `http://localhost:3001/api`).

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001

## Running on Windows (Company Server)

**Requirements:** [Node.js 18+ for Windows](https://nodejs.org/en/download)

```bash
# 1. Create .env from .env.example (run once)
copy .env.example .env

# 2. Install all dependencies (run once)
npm run install:all

# 3. Start the full app (frontend + backend together)
npm run dev
```

Open a browser and go to: `http://localhost:5173`

> If port 3001 is blocked by a firewall, set `PORT` in your `.env` file (e.g., `PORT=3002`).
> The frontend development server runs on port 5173 by default. If this port is in use, Vite will automatically pick another.

## Project Structure

```
anjani-task-center/
├── .env.example            # Example environment variables
├── .env                    # Environment variables (copied from .env.example)
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
    ├── vite.config.js        # Vite + /api proxy to backend API_BASE_URL
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

## Deployment

### Local Production Build & Preview

To build and preview the frontend production version locally:

```bash
# 1. Install all dependencies (if not already done)
npm run install:all

# 2. Build the frontend for production
npm run build
# The build output will be in the 'frontend/dist' folder.

# 3. Preview the production build locally
npm run preview
# This will serve the 'frontend/dist' folder, usually on http://localhost:4173 (or similar).
# Note: The backend must still be running (npm run server or npm run dev in backend) for API calls to work.
```

### Deploying the Frontend (Vercel / Netlify)

This application has a separate frontend (`frontend/`) and backend (`backend/`). For platforms like Vercel or Netlify, you typically deploy *only the frontend*. The backend would need to be deployed separately to a Node.js-compatible server.

**General Steps:**

1.  **Build Command:** `npm run build` (or `npm --prefix frontend run build`)
    *   This command builds the frontend application.
2.  **Output Directory:** `frontend/dist`
    *   This is the folder that contains the static assets to be served.
3.  **Environment Variables:**
    *   Set `VITE_API_BASE_URL` in your Vercel/Netlify project settings to point to your deployed backend API URL (e.g., `https://your-backend-api.com/api`).
    *   Ensure any other necessary environment variables (e.g., `CORS_ORIGIN` for your backend) are configured correctly on your backend hosting platform.

**Warning on Data Storage:**
This application currently uses `localStorage` for user settings and an SQLite database (`anjani.db`) for tasks and staff, stored locally within the `backend/data/` directory. This setup is ideal for single-user, local deployments or pilots. For real multi-staff usage or production deployments requiring persistent, shared data, consider migrating to a hosted database solution (e.g., Supabase, PostgreSQL, MySQL) and a dedicated backend server. The `backup & data` tools in settings can help with manual data migration.

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
- **Phase 3** — Settings · Backup & Data tools · In-app & Browser Notifications ✓

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
