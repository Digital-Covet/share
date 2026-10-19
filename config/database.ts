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

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   * Runtime uses the Neon pooler (PgBouncer, transaction mode).
   * Run migrations/DDL via the unpooled connection:
   * `node ace migration:run --connection=postgres_direct`
   */
  connection: 'postgres',

  connections: {
    /**
     * Neon pooled connection (runtime).
     */
    postgres: {
      client: 'pg',
      connection: {
        connectionString: env.get('DATABASE_URL'),
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
        connectionString: env.get('DATABASE_URL_UNPOOLED'),
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
  },
})

export default dbConfig
