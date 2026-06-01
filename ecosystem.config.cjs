// PM2 process config — run from repo root
// Usage:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup   (follow the printed command to enable auto-start on boot)
//
// IMPORTANT: Run `npm run build` once before starting the frontend process.

module.exports = {
  apps: [
    // ── Backend ────────────────────────────────────────────────────────────
    {
      name: 'anjani-backend',
      script: './backend/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        // Set CORS_ORIGIN to wherever staff browsers will connect from.
        // Example local network: CORS_ORIGIN=http://192.168.1.100:5173
        // Example Cloudflare Tunnel: CORS_ORIGIN=https://your-tunnel.trycloudflare.com
        CORS_ORIGIN: 'http://localhost:5173,http://127.0.0.1:5173',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Frontend (production preview of built dist/) ────────────────────────
    // Serves frontend/dist on port 5173 (configured via vite.config.js preview).
    // Windows note: if `npm` is not found, replace script/args with:
    //   script: 'npx', args: 'vite preview'
    {
      name: 'anjani-frontend',
      script: 'npm',
      args: 'run preview',
      cwd: './frontend',
      shell: true,          // required for Windows (resolves npm.cmd correctly)
      instances: 1,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
