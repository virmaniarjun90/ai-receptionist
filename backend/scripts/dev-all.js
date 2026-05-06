require('dotenv/config');

const { spawn } = require('node:child_process');
const net = require('node:net');
const { PrismaClient } = require('@prisma/client');

function checkTcp(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function checkDb() {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[dev:all] DB ok');
  } catch (error) {
    console.warn('[dev:all] DB warning: PostgreSQL connection failed');
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = Number(process.env.REDIS_PORT || 6379);
  const redisOk = await checkTcp(redisHost, redisPort);

  if (redisOk) {
    console.log(`[dev:all] Redis ok at ${redisHost}:${redisPort}`);
  } else {
    console.warn(
      `[dev:all] Redis warning: not reachable at ${redisHost}:${redisPort}`,
    );
  }

  await checkDb();

  const child = spawn('npm', ['run', 'start:dev'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

void main();
