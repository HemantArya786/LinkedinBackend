// ecosystem.config.js  —  PM2 production config
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: 'linkedin-api',
      script: 'src/server.js',
      instances: 'max',          // one instance per CPU core
      exec_mode: 'cluster',      // Node.js cluster mode
      watch: false,
      max_memory_restart: '1G',  // auto-restart if RSS exceeds 1 GB

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Logging
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful reload
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Auto-restart on crash with exponential backoff
      exp_backoff_restart_delay: 100,
      restart_delay: 4000,
      max_restarts: 10,
    },
  ],
};
