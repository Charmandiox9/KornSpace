import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = resolve(root, '.env');
const target = process.argv[2];
if (!['local', 'neon'].includes(target) || process.argv.length !== 3) {
  console.error('Uso: pnpm db:use local | pnpm db:use neon'); process.exitCode = 1;
} else {
  try {
    loadEnvFile(envPath);
    let hostUrl: string; let directUrl: string; let dockerUrl: string; let dockerDirect: string;
    if (target === 'local') {
      if (!process.env.POSTGRES_PASSWORD) throw new Error('Falta POSTGRES_PASSWORD.');
      const credentials = `${encodeURIComponent(process.env.POSTGRES_USER ?? 'kornspace')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}`;
      const database = encodeURIComponent(process.env.POSTGRES_DB ?? 'kornspace');
      hostUrl = `postgresql://${credentials}@localhost:${process.env.POSTGRES_PORT ?? '5432'}/${database}?schema=public`;
      directUrl = hostUrl;
      dockerUrl = `postgresql://${credentials}@postgres:5432/${database}?schema=public`; dockerDirect = dockerUrl;
    } else {
      if (!process.env.NEON_DATABASE_URL || !process.env.NEON_DATABASE_URL_UNPOOLED) throw new Error('Faltan NEON_DATABASE_URL o NEON_DATABASE_URL_UNPOOLED.');
      hostUrl = process.env.NEON_DATABASE_URL; directUrl = process.env.NEON_DATABASE_URL_UNPOOLED;
      for (const value of [hostUrl,directUrl]) if (!new URL(value).hostname.endsWith('.neon.tech')) throw new Error('Las conexiones Neon no son válidas.');
      dockerUrl = hostUrl; dockerDirect = directUrl;
    }
    const values = { DATABASE_URL: hostUrl, DATABASE_URL_UNPOOLED: directUrl, DOCKER_DATABASE_URL: dockerUrl, DOCKER_DATABASE_URL_UNPOOLED: dockerDirect };
    let text = readFileSync(envPath, 'utf8');
    for (const [key, value] of Object.entries(values)) {
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      const line = `${key}=${JSON.stringify(value)}`;
      text = pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`;
    }
    writeFileSync(envPath, text);
    console.log(`Configuración preparada para ${target === 'local' ? 'PostgreSQL local' : 'Neon'}. No se copiaron ni eliminaron datos.`);
    if (target === 'local') console.log('Si PostgreSQL está detenido: docker compose up -d --no-deps postgres');
    console.log('Para aplicarla en Docker: docker compose up -d --no-deps --force-recreate backend');
    console.log('Si usas pnpm dev, reinicia el backend de desarrollo.');
  } catch { console.error('No se pudo preparar la conexión. Revisa las variables de .env y los permisos del archivo.'); process.exitCode = 1; }
}
