const { spawnSync } = require('node:child_process');
const { loadEnvFile } = require('node:process');
const path = require('node:path');

const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');

try {
  loadEnvFile(rootEnvPath);
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}

const prismaCliPath = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
