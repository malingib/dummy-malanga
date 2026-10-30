#!/usr/bin/env node
/**
 * Apply the SQL migrations in db/migrations to the Neon PostgreSQL
 * database named by DATABASE_URL.
 *
 * Usage:
 *   npm run db:migrate
 *   DATABASE_URL=postgresql://... npm run db:migrate
 *
 * Each migration runs in its own transaction and is recorded in
 * public.schema_migrations. Re-running the command is safe.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  console.error('[db:migrate] DATABASE_URL is not set.')
  console.error('[db:migrate] Add it to .env.local or the process environment, then retry.')
  process.exit(1)
}

const migrationsDir = resolve(process.cwd(), 'db/migrations')
const local = /(?:^|[/@])(?:localhost|127\.0\.0\.1|::1)(?:[:/]|$)|(?:[?&]host=(?:\/|%2F))/i.test(connectionString)
const sslDisabled = process.env.DATABASE_SSL === 'disable' || /sslmode=disable/i.test(connectionString)

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: Number(process.env.DATABASE_REQUEST_TIMEOUT_MS || 15_000),
  ...(local || sslDisabled ? {} : { ssl: { rejectUnauthorized: false } }),
})

try {
  await pool.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  if (!files.length) {
    console.log('[db:migrate] No migrations found.')
    process.exit(0)
  }

  let appliedCount = 0
  for (const file of files) {
    const { rowCount } = await pool.query('select 1 from public.schema_migrations where version = $1', [file])
    if (rowCount) {
      console.log(`[db:migrate] skip ${file}`)
      continue
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into public.schema_migrations (version) values ($1)', [file])
      await client.query('commit')
      appliedCount += 1
      console.log(`[db:migrate] applied ${file}`)
    } catch (error) {
      await client.query('rollback').catch(() => {})
      console.error(`[db:migrate] failed ${file}: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
      break
    } finally {
      client.release()
    }
  }

  console.log(`[db:migrate] done (${appliedCount} applied)`)
} finally {
  await pool.end()
}
