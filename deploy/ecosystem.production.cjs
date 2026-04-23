// Production PM2 config. Run the server only — nginx serves the static Vite build.
// On the Lightsail box:
//   cd /home/ubuntu/holly
//   cd client && npm run build && cd ..
//   pm2 start deploy/ecosystem.production.cjs
//   pm2 save && pm2 startup   # persist across reboots

module.exports = {
  apps: [
    {
      name: 'holly-server',
      cwd: './server',
      script: 'index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '../logs/server-error.log',
      out_file: '../logs/server-out.log',
      merge_logs: true,
    },
  ],
};
