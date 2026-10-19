/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Database
  // DATABASE_URL: Neon pooler (PgBouncer, transaction mode) for runtime
  // DATABASE_URL_UNPOOLED: direct connection for migrations/DDL
  // Plain strings: the `url` format rejects the `postgresql://` scheme.
  // DB_CONNECTION: default Lucid connection; `sqlite` is used by tests only.
  DB_CONNECTION: Env.schema.enum.optional(['postgres', 'sqlite'] as const),
  DATABASE_URL: Env.schema.string(),
  DATABASE_URL_UNPOOLED: Env.schema.string(),

  // IAM (OAuth 2.0 / OIDC provider)
  // IAM_ISSUER must equal IAM's APP_URL (the `iss` of its tokens).
  // IAM_CLIENT_SECRET is empty for a public (PKCE-only) client.
  IAM_ISSUER: Env.schema.string({ format: 'url', tld: false }),
  IAM_CLIENT_ID: Env.schema.string(),
  IAM_CLIENT_SECRET: Env.schema.string.optional(),
  IAM_REDIRECT_URI: Env.schema.string({ format: 'url', tld: false }),
  IAM_POST_LOGOUT_REDIRECT_URI: Env.schema.string.optional({ format: 'url', tld: false }),

  // Object storage (Adonis Drive). `r2` in every real environment; `fs` is
  // a local disk for tests. R2_* are optional so the app boots without a
  // bucket; the first storage call fails instead.
  DRIVE_DISK: Env.schema.enum(['r2', 'fs'] as const),
  R2_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  R2_BUCKET: Env.schema.string.optional(),
  R2_ACCESS_KEY_ID: Env.schema.string.optional(),
  R2_SECRET_ACCESS_KEY: Env.schema.secret.optional(),
  // Presigned URL lifetimes, e.g. `1h`, `5m` (defaults 1h / 5m).
  STORAGE_UPLOAD_URL_TTL: Env.schema.string.optional(),
  STORAGE_DOWNLOAD_URL_TTL: Env.schema.string.optional(),
  // Largest file accepted for a single presigned PUT.
  STORAGE_MAX_SINGLE_PUT_BYTES: Env.schema.number.optional(),
})
