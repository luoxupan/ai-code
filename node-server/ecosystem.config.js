module.exports = {
  apps: [
    {
      name: 'node-server',
      script: 'dist/main.js',
      instances: 'max', // 或者指定具体的实例数，如 2
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_development: {
        NODE_ENV: 'development',
      },
      env_pre: {
        NODE_ENV: 'pre',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
