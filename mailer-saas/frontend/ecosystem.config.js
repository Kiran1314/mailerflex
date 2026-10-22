module.exports = {
  apps: [
    {
      name: 'mailer-backend',
      script: './backend/server.js',
      env: {
        PORT: 5001,
        NODE_ENV: 'production',
        MONGO_URI: 'mongodb://127.0.0.1:27017/mailer_db'
      }
    },
    {
      name: 'mailer-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './frontend',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    }
  ]
};
