import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

interface Column { name: string; type: string; nullable: boolean; generated: string; identity: string; defaultValue: string | null; }
interface Table { name: string; columns: Column[]; keys: string[]; parents: string[]; }
interface Batch { payload: string; count: number; }
export interface SyncOptions { apply: boolean; batchSize: number; }
export interface SyncResult { table: string; read: number; inserted: number; existing: number; }
class SyncError extends Error {}
const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const tableSql = (name: string): string => `public.${quote(name)}`;
const catalog = `SELECT c.relname AS name,
 (SELECT json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid,a.atttypmod),
 'nullable', NOT a.attnotnull, 'generated', a.attgenerated, 'identity', a.attidentity,
 'defaultValue', pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 ARRAY(SELECT a.attname FROM pg_constraint k CROSS JOIN LATERAL unnest(k.conkey) WITH ORDINALITY v(num,pos)
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=v.num WHERE k.conrelid=c.oid AND k.contype='p' ORDER BY v.pos) AS keys,
 ARRAY(SELECT DISTINCT p.relname FROM pg_constraint k JOIN pg_class p ON p.oid=k.confrelid
 WHERE k.conrelid=c.oid AND k.contype='f' ORDER BY p.relname) AS parents
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations' ORDER BY c.relname`;

function ordered(tables: Table[]): Table[] {
  const pending = new Map(tables.map((table) => [table.name, table]));
  const done = new Set<string>(); const result: Table[] = [];
  while (pending.size) {
    const next = [...pending.values()].find((table) => table.parents.every((parent) => parent === table.name || done.has(parent)));
    if (!next) throw new SyncError('Hay dependencias circulares o externas entre tablas. No se realizó la copia.');
    if (!next.keys.length) throw new SyncError(`La tabla ${next.name} no tiene clave primaria.`);
    if (next.parents.includes(next.name) && next.name !== 'Folder') throw new SyncError(`La tabla ${next.name} requiere un orden jerárquico que aún no está soportado.`);
    if (next.columns.some((column) => column.identity || column.defaultValue?.includes('nextval('))) throw new SyncError('Se detectaron secuencias numéricas no soportadas; no se copiarán datos.');
    pending.delete(next.name); done.add(next.name); result.push(next);
  }
  return result;
}

async function migrations(client: Prisma.TransactionClient): Promise<string> {
  const pending = await client.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`);
  if (pending[0].count) throw new SyncError('Hay migraciones pendientes o fallidas. Revisa Prisma antes de sincronizar.');
  return JSON.stringify(await client.$queryRawUnsafe(`SELECT migration_name, checksum FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`));
}

export async function syncDatabases(source: PrismaClient, destination: PrismaClient, options: SyncOptions): Promise<SyncResult[]> {
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1000) throw new SyncError('El lote debe estar entre 1 y 1000.');
  return source.$transaction(async (from) => {
    await from.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return destination.$transaction(async (to) => {
      if (!options.apply) await to.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      else {
        const locks = await to.$queryRawUnsafe<Array<{ acquired: boolean }>>('SELECT pg_try_advisory_xact_lock(163927, 1) AS acquired');
        if (!locks[0].acquired) throw new SyncError('Ya hay otra sincronización en ejecución.');
      }
      if (await migrations(from) !== await migrations(to)) throw new SyncError('Los historiales de migraciones no coinciden. Aplica las mismas migraciones antes de copiar.');
      const sourceTables = await from.$queryRawUnsafe<Table[]>(catalog);
      const targetTables = await to.$queryRawUnsafe<Table[]>(catalog);
      if (JSON.stringify(sourceTables) !== JSON.stringify(targetTables)) throw new SyncError('Los esquemas public no coinciden. No se realizó la copia.');
      const results: SyncResult[] = [];
      for (const table of ordered(sourceTables)) {
        const name = tableSql(table.name);
        const columns = table.columns.filter((column) => !column.generated).map((column) => quote(column.name)).join(', ');
        const keys = table.keys.map(quote).join(', ');
        let read = 0; let inserted = 0;
        const total = await from.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::int AS count FROM ${name}`);
        for (;;) {
          const prefix = table.name === 'Folder' ? `WITH RECURSIVE hierarchy AS (SELECT "id",0 AS depth FROM ${name} WHERE "parentId" IS NULL UNION ALL SELECT child."id",parent.depth+1 FROM ${name} child JOIN hierarchy parent ON child."parentId"=parent."id")` : '';
          const join = table.name === 'Folder' ? 'JOIN hierarchy h ON h."id"=r."id"' : '';
          const order = table.name === 'Folder' ? 'h.depth, r."id"' : table.keys.map((key) => `r.${quote(key)}`).join(', ');
          const batches = await from.$queryRawUnsafe<Batch[]>(`${prefix} SELECT coalesce(jsonb_agg(payload),'[]'::jsonb)::text AS payload,count(*)::int AS count FROM (SELECT to_jsonb(r) AS payload FROM ${name} r ${join} ORDER BY ${order} LIMIT $1 OFFSET $2) batch`, options.batchSize, read);
          const batch = batches[0]; if (!batch.count) break;
          const records = `jsonb_populate_recordset(NULL::${name}, $1::jsonb)`;
          if (options.apply) {
            try { inserted += await to.$executeRawUnsafe(`INSERT INTO ${name} (${columns}) SELECT ${columns} FROM ${records} ON CONFLICT (${keys}) DO NOTHING`, batch.payload); }
            catch { throw new SyncError(`Conflicto o error al insertar en ${table.name}. Se revirtió toda la sincronización; revisa claves únicas y relaciones. No se actualizaron registros existentes.`); }
          } else {
            const equal = table.keys.map((key) => `target.${quote(key)}=incoming.${quote(key)}`).join(' AND ');
            const missing = await to.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::int AS count FROM ${records} incoming WHERE NOT EXISTS (SELECT 1 FROM ${name} target WHERE ${equal})`, batch.payload);
            inserted += missing[0].count;
          }
          read += batch.count;
        }
        if (read !== total[0].count) throw new SyncError(`La jerarquía de ${table.name} no permite copiar todas las filas. Se canceló la operación.`);
        results.push({ table: table.name, read, inserted, existing: read - inserted });
      }
      return results;
    }, { timeout: 900000, maxWait: 10000 });
  }, { isolationLevel: 'RepeatableRead', timeout: 920000, maxWait: 10000 });
}

export function localConnection(): string {
  if (process.env.LOCAL_DATABASE_URL) return process.env.LOCAL_DATABASE_URL;
  const user = encodeURIComponent(process.env.POSTGRES_USER ?? 'kornspace');
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) throw new SyncError('Falta POSTGRES_PASSWORD o LOCAL_DATABASE_URL.');
  return `postgresql://${user}:${encodeURIComponent(password)}@localhost:${process.env.POSTGRES_PORT ?? '5432'}/${encodeURIComponent(process.env.POSTGRES_DB ?? 'kornspace')}?schema=public`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('pnpm db:sync:neon [--apply] [--batch-size=200]\nSin --apply sólo cuenta registros nuevos, sin escribir. Copia public; excluye migraciones y Neon Auth.'); return; }
  if (args.some((arg) => arg !== '--apply' && arg !== '--dry-run' && !/^--batch-size=\d+$/.test(arg))) throw new SyncError('Argumento no reconocido. Usa --help.');
  loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'));
  const sourceUrl = localConnection();
  const destinationUrl = process.env.NEON_DATABASE_URL_UNPOOLED;
  if (!destinationUrl) throw new SyncError('Falta NEON_DATABASE_URL_UNPOOLED en .env.');
  const local = new URL(sourceUrl); const neon = new URL(destinationUrl);
  if (!['localhost','127.0.0.1','postgres','::1','[::1]'].includes(local.hostname)) throw new SyncError('El origen debe ser PostgreSQL local.');
  if (!neon.hostname.endsWith('.neon.tech') || neon.hostname.includes('-pooler')) throw new SyncError('El destino debe ser una conexión directa de Neon, sin pooler.');
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } }, log: [] });
  const destination = new PrismaClient({ datasources: { db: { url: destinationUrl } }, log: [] });
  const apply = args.includes('--apply');
  if (apply && args.includes('--dry-run')) throw new SyncError('Elige --apply o --dry-run.');
  try {
    const result = await syncDatabases(source, destination, { apply, batchSize: Number(args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] ?? 200) });
    console.log(apply ? 'Copia confirmada en Neon.' : 'Simulación sin escrituras. Los conflictos únicos se validan al aplicar.');
    console.table(result.map((row) => ({ tabla: row.table, leidos: row.read, [apply ? 'insertados' : 'inexistentes']: row.inserted, existentes: row.existing })));
  } finally { await Promise.all([source.$disconnect(), destination.$disconnect()]); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => { console.error(error instanceof SyncError ? error.message : 'No se pudo completar la sincronización. Revisa conexiones, permisos y esquema.'); process.exitCode = 1; });
}
