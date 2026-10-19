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
  // Seconds between re-checks of a signed-in user's access with IAM (default 300).
  IAM_RECHECK_SECONDS: Env.schema.number.optional(),

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

  // Queue (@adonisjs/queue). `database` stores jobs in Postgres; `sync`
  // runs them inline (tests).
  QUEUE_DRIVER: Env.schema.enum(['database', 'sync'] as const),

  // Rate limiting (@adonisjs/limiter). `database` keeps counters in the
  // `rate_limits` table, shared by all replicas; `memory` is for tests.
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),

  // Mail (@adonisjs/mail). Optional: nothing is sent unless MAIL_ENABLED=true,
  // so the mailer settings may be left unset. MAIL_MAILER picks ZeptoMail
  // (HTTP API) or SMTP; the from address must be on a domain verified in the
  // ZeptoMail Mail Agent.
  MAIL_ENABLED: Env.schema.boolean.optional(),
  MAIL_MAILER: Env.schema.enum.optional(['smtp', 'zeptomail'] as const),
  MAIL_FROM_ADDRESS: Env.schema.string.optional({ format: 'email' }),
  MAIL_FROM_NAME: Env.schema.string.optional(),
  ZEPTOMAIL_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  ZEPTOMAIL_TOKEN: Env.schema.secret.optional(),
  SMTP_HOST: Env.schema.string.optional({ format: 'host' }),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_SECURE: Env.schema.boolean.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.secret.optional(),
})
