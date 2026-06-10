const { execSync } = require('child_process');
const path = require('path');

execSync('./node_modules/.bin/prisma migrate deploy', {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  env: process.env,
});

require('./backend/dist/main');
