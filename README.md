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

## Deployment (Level 2 — Windows Server + PM2 + Cloudflare Tunnel)

### Architecture overview

```
Office PC / Server (always on)
├── Backend   — Node.js Express  → http://SERVER_IP:3001
└── Frontend  — Vite preview     → http://SERVER_IP:5173

Staff browsers (same LAN) → http://SERVER_IP:5173
Remote access (optional)  → Cloudflare Tunnel → SERVER_IP:5173
```

---

### Step 1 — Install prerequisites on the Windows server

1. **Node.js 18 LTS** — https://nodejs.org/en/download  
   ✓ Tick "Automatically install necessary tools" during setup.

2. **Git** — https://git-scm.com/download/win  
   Use all defaults.

3. **PM2** (process manager — keeps the app alive after reboot)
   ```cmd
   npm install -g pm2
   pm2 --version
   ```

4. **Cloudflare Tunnel CLI** (for remote access — optional)  
   Download `cloudflared-windows-amd64.msi` from:  
   https://github.com/cloudflare/cloudflared/releases/latest  
   Install and confirm: `cloudflared --version`

---

### Step 2 — Clone and install

```cmd
cd C:\Apps
git clone https://github.com/YOUR_ORG/anjani-task-center.git
cd anjani-task-center
npm run install:all
```

---

### Step 3 — Configure environment

```cmd
copy .env.example .env
notepad .env
```

Edit `.env` for your network. Key values to change:

```env
NODE_ENV=production
PORT=3001

# Replace 192.168.1.100 with the actual LAN IP of this server
CORS_ORIGIN=http://192.168.1.100:5173

# Same LAN IP — baked into the frontend at build time
VITE_API_BASE_URL=http://192.168.1.100:3001/api
```

Find the server's LAN IP: run `ipconfig` in cmd, use the IPv4 address.

---

### Step 4 — Build the frontend

Run this once, and again every time you pull new code:

```cmd
npm run build
```

Output goes to `frontend/dist/`.

---

### Step 5 — Start with PM2

```cmd
pm2 start ecosystem.config.cjs --env production
pm2 list
```

You should see both `anjani-backend` and `anjani-frontend` with status `online`.

Test it:
- Backend health: http://localhost:3001/api/health
- Frontend: http://localhost:5173

**Save PM2 process list so it survives reboots:**

```cmd
pm2 save
```

**Enable PM2 auto-start on Windows boot:**

```cmd
pm2-startup install
```

> If `pm2-startup` is not found: `npm install -g pm2-startup`, then run it again.

---

### Step 6 — Allow office staff access (local network)

Staff open a browser and go to:  
**`http://192.168.1.100:5173`** (replace with your server's LAN IP)

Make sure Windows Firewall allows inbound connections on ports **3001** and **5173**.  
To open them in PowerShell (run as Admin):

```powershell
netsh advfirewall firewall add rule name="Anjani Frontend" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="Anjani Backend"  dir=in action=allow protocol=TCP localport=3001
```

---

### Step 7 — Cloudflare Tunnel (permanent remote access)

Use this only if staff need access from outside the office.

#### One-time setup (run on the server)

```cmd
cloudflared login
```

Browser opens → log in to your Cloudflare account → authorise.

```cmd
cloudflared tunnel create anjani-task-center
```

Note the Tunnel ID printed (e.g. `abc-123-...`).

```cmd
cloudflared tunnel route dns anjani-task-center tasks.yourdomain.com
```

Replace `tasks.yourdomain.com` with a subdomain you own in Cloudflare DNS.

Create `C:\Users\YOUR_USER\.cloudflared\config.yml`:

```yaml
tunnel: anjani-task-center
credentials-file: C:\Users\YOUR_USER\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: tasks.yourdomain.com
    service: http://localhost:5173
  - service: http_status:404
```

Start the tunnel:

```cmd
cloudflared tunnel run anjani-task-center
```

#### Run the tunnel as a Windows service (auto-start)

```cmd
cloudflared service install
```

#### After setting up a permanent domain — rebuild the frontend

Update `.env`:

```env
CORS_ORIGIN=https://tasks.yourdomain.com
VITE_API_BASE_URL=http://192.168.1.100:3001/api
```

Then rebuild and restart:

```cmd
npm run build
pm2 restart anjani-frontend
```

> **API calls from remote browsers:** When staff access via Cloudflare Tunnel, the frontend JS calls `VITE_API_BASE_URL` directly from their browser. If that URL is a LAN IP, remote browsers cannot reach it. For fully remote access you need the API on a publicly reachable URL too (second tunnel or port-forward on your router to port 3001).

---

### PM2 day-to-day commands

```cmd
pm2 list                          # status of all processes
pm2 logs anjani-backend           # live backend logs
pm2 logs anjani-frontend          # live frontend logs
pm2 restart anjani-backend        # restart backend only
pm2 restart all                   # restart everything
pm2 stop all                      # stop everything
pm2 delete all                    # remove from PM2
```

Logs are written to `logs/backend-out.log`, `logs/backend-error.log`, etc.

---

### Updating the app

```cmd
git pull
npm run install:all
npm run build
pm2 restart all
```

---

### Backup

The SQLite database lives at `backend/data/anjani.db`.  
Use the **Settings → Backup & Data** tab to download a JSON export.  
Store the file in the `backups/` folder (excluded from git).

For automated daily backup, create a Windows Scheduled Task that runs:

```cmd
copy backend\data\anjani.db backups\anjani-%DATE:~-4,4%%DATE:~-7,2%%DATE:~0,2%.db
```

---

### ⚠️ Security warnings — read before real staff use

1. **Change all default passwords immediately.**  
   Default credentials (`admin / admin123`) are hardcoded in `frontend/src/services/auth.js`.  
   Update them before any real usage.

2. **Do not share the Cloudflare Tunnel URL publicly.**  
   The URL gives unauthenticated access to the login page — keep it internal.

3. **Remove or update test/sample data.**  
   Reset to a clean state via Settings → Backup & Data → Clear All Data.

4. **Confirm Windows Firewall rules.**  
   Only open ports 5173 and 3001 to the office LAN, not to the public internet.

5. **Back up the database before every update.**

---

### Troubleshooting

| Symptom | Fix |
|---|---|
| `pm2 start` shows frontend as errored | Run `npm run build` first, then restart |
| Frontend loads but API calls fail | Check `VITE_API_BASE_URL` in `.env` and rebuild |
| CORS errors in browser console | Add frontend URL to `CORS_ORIGIN` in `.env` and restart backend |
| Port already in use | `pm2 delete all`, then check `netstat -ano \| findstr :3001` |
| PM2 frontend not starting on Windows | Replace `npm` with `npx` in ecosystem.config.cjs args: `npx vite preview` |

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
