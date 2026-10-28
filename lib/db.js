// Centralised cloud database (Postgres: Neon, Supabase, RDS, local...). Configure with DATABASE_URL.
// The same module is used by `node server.js` (self-hosted) and by the Vercel function in /api.
import pg from 'pg'

export const SCHEMA = `
create table if not exists docs (
  id    text primary key,
  seq   bigint  not null,
  type  text    not null,
  ts    bigint  not null,
  dev   text    not null default '',
  phone text,
  del   boolean not null default false,
  data  jsonb   not null
);
create sequence if not exists docs_seq;
create index if not exists docs_seq_idx   on docs (seq);
create index if not exists docs_type_idx  on docs (type);
create index if not exists docs_phone_idx on docs (phone) where phone is not null;
create index if not exists docs_code_idx  on docs ((upper(data->>'code'))) where data->>'code' is not null;
create table if not exists users (
  phone   text primary key,
  name    text,
  salt    text,
  hash    text,
  created bigint not null default 0
);
create table if not exists tg (code text primary key, chat bigint not null);
create table if not exists counters (prefix text primary key, n integer not null);
`

let pool
let schemaReady

export function getPool() {
  const url = process.env.DATABASE_URL
  if (!url) {
    const e = new Error('DATABASE_URL is not set. Copy .env.example to .env (or set it in Vercel > Settings > Environment Variables).')
    e.code = 'NO_DATABASE_URL'
    throw e
  }
  if (!pool) {
    // pg lets sslmode in the URL override the `ssl` option, so strip it and decide here.
    const cs = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '')
    const local = /@(localhost|127\.0\.0\.1|\[::1\]|db|postgres)(:|\/)/.test(url)
    const ssl = process.env.DATABASE_SSL === 'false' || local
      ? false
      : { rejectUnauthorized: process.env.DATABASE_SSL_VERIFY === 'true' }
    pool = new pg.Pool({
      connectionString: cs,
      ssl,
      max: process.env.VERCEL ? 1 : 5, // serverless: one connection per warm instance
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    })
    pool.on('error', e => console.error('pg pool error', e.message))
  }
  return pool
}

export async function tx(fn) {
  const c = await getPool().connect()
  try {
    await c.query('BEGIN')
    const out = await fn(c)
    await c.query('COMMIT')
    return out
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

/** Creates the tables on first use (idempotent, safe with several cold starts at once). */
export function ready() {
  return schemaReady || (schemaReady = tx(async c => {
    await c.query('select pg_advisory_xact_lock(7)')
    await c.query(SCHEMA)
  }).catch(e => { schemaReady = null; throw e }))
}

export async function q(text, params) {
  await ready()
  return getPool().query(text, params)
}
