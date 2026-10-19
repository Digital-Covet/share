import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import pg from 'pg'

/**
 * Return Postgres BIGINT (OID 20) as a JavaScript number instead of a
 * string. Values stored here (file sizes capped at 5 GiB, row counts)
 * stay well within Number.MAX_SAFE_INTEGER.
 */
pg.types.setTypeParser(20, (value) => Number(value))

/**
 * Pin every pooled connection to UTC.
 */
const afterCreate = (conn: any, done: (err: Error | null, conn: any) => void) => {
  conn.query(`SET timezone='UTC';`, (err: Error) => done(err, conn))
}

/**
 * pg currently treats `sslmode=prefer|require|verify-ca` (Neon URLs ship
 * with `require`) as `verify-full`, logs a deprecation warning on every
 * connect, and will weaken them to libpq semantics in pg v9. Spell out
 * `verify-full` to keep full certificate verification and silence it.
 */
const withVerifiedSsl = (connectionString: string) => {
  try {
    const url = new URL(connectionString)
    const mode = url.searchParams.get('sslmode')
    if (mode && ['prefer', 'require', 'verify-ca'].includes(mode)) {
      url.searchParams.set('sslmode', 'verify-full')
    }
    return url.toString()
  } catch {
    return connectionString
  }
}

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   * Runtime uses the Neon pooler (PgBouncer, transaction mode).
   * Run migrations/DDL via the unpooled connection:
   * `node ace migration:run --connection=postgres_direct`
   */
  connection: env.get('DB_CONNECTION', 'postgres'),

  connections: {
    /**
     * Neon pooled connection (runtime).
     */
    postgres: {
      client: 'pg',
      connection: {
        connectionString: withVerifiedSsl(env.get('DATABASE_URL')),
      },
      pool: {
        min: 0,
        max: 10,
        acquireTimeoutMillis: 60_000,
        afterCreate,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
      },
      debug: app.inDev,
    },

    /**
     * Neon direct (unpooled) connection. Migrations/DDL.
     * Usage: `node ace migration:run --connection=postgres_direct`
     */
    postgres_direct: {
      client: 'pg',
      connection: {
        connectionString: withVerifiedSsl(env.get('DATABASE_URL_UNPOOLED')),
      },
      pool: {
        min: 0,
        max: 5,
        acquireTimeoutMillis: 60_000,
        afterCreate,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
      },
      debug: app.inDev,
    },

    /**
     * Test-only SQLite file (`DB_CONNECTION=sqlite` in `.env.test`), so
     * tests need no Postgres server. Schema generation stays off: the
     * generated model classes come from the Postgres schema.
     */
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: app.tmpPath('db.test.sqlite3'),
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
