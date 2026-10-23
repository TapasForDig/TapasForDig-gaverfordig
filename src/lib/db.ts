import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA } from './schema';
import { seedIfEmpty } from './seed';

type Row = Record<string, unknown>;

export interface Driver {
  query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

const g = globalThis as unknown as { __gfdDb?: Promise<Driver> };

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Supabase / almindelig Postgres
    const { Pool } = await import('pg');
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({ connectionString: url, max: 5, ssl: local ? false : { rejectUnauthorized: false } });
    return {
      query: async <T,>(sql: string, params: unknown[] = []) => {
        const r = await pool.query(sql, params as unknown[]);
        return { rows: r.rows as T[] };
      },
      exec: async (sql: string) => {
        await pool.query(sql);
      },
    };
  }
  // Lokal udvikling: Postgres i en mappe (.data/pglite) – ingen installation nødvendig
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = path.join(process.cwd(), '.data');
  fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(path.join(dir, 'pglite'));
  await pg.waitReady;
  return {
    query: async <T,>(sql: string, params: unknown[] = []) => {
      const r = await pg.query<T>(sql, params as unknown[]);
      return { rows: r.rows };
    },
    exec: async (sql: string) => {
      await pg.exec(sql);
    },
  };
}

export function db(): Promise<Driver> {
  if (!g.__gfdDb) {
    g.__gfdDb = (async () => {
      const d = await createDriver();
      // Skemaet køres kun, når det er ændret siden sidst – sparer tid ved hver kold start på Vercel
      const version = crypto.createHash('sha1').update(SCHEMA).digest('hex').slice(0, 12);
      let current: string | undefined;
      try {
        current = (await d.query<{ value: string }>(`select value from settings where key = 'schema_version'`)).rows[0]?.value;
      } catch {
        current = undefined; // tabellen findes ikke endnu
      }
      if (current !== version) {
        await d.exec(SCHEMA);
        await d.query(`insert into settings (key, value) values ('schema_version', $1) on conflict (key) do update set value = excluded.value`, [version]);
        await seedIfEmpty(d);
      }
      return d;
    })().catch((e) => {
      g.__gfdDb = undefined;
      throw e;
    });
  }
  return g.__gfdDb;
}

export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await db();
  return (await d.query<T>(sql, params)).rows;
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

export async function logEvent(actor: string, entity: string, entityId: number | null, action: string, detail = '') {
  await q('insert into events (actor, entity, entity_id, action, detail) values ($1,$2,$3,$4,$5)', [
    actor,
    entity,
    entityId,
    action,
    detail,
  ]);
}
