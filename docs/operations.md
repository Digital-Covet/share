# CovetDrop — Operations

How to run Share (CovetDrop) outside a developer laptop: configuration, the
bucket, processes, migrations, logs and rate limits. Infrastructure itself
(buckets, Postgres, secrets) is provisioned elsewhere; the app only reads env
vars.

## Processes

| Process | Command (from `build/`) | Notes |
|---|---|---|
| Web | `node bin/server.js` (image default) | Stateless; run as many replicas as needed. Registers the job schedules (`start/scheduler.ts`) at boot. |
| Worker | `node ace queue:work` (`pnpm worker` in a checkout) | Runs queued and scheduled jobs: transfer cleanup every 15 min, recipient emails. Run at least one. |

Both processes need the same environment.

## Container image

`Dockerfile` builds one image (Node 24, compiled app + production
dependencies, runs as the non-root `node` user, working directory `/app` =
`build/`). The default command is the web server; override it for the worker
and for migrations:

```bash
docker build -t covetdrop .
docker run --env-file .env -p 3334:3334 covetdrop                   # web
docker run --env-file .env covetdrop node ace queue:work            # worker
docker run --env-file .env covetdrop node ace migration:run --connection=postgres_direct --force
```

- The image sets `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3334`, `TZ=UTC`;
  values in `--env-file` win. A laptop `.env` with `HOST=localhost` makes the
  server listen on the container's loopback only, so set `HOST=0.0.0.0` (and
  keep `NODE_ENV=production`) in the env passed to the container.
- No `.env` is baked in (`.dockerignore`); every setting comes from the
  environment, so the same image runs in dev, staging and prod.
- The container is stateless: nothing is written to disk besides `tmp/`
  (unused with `DRIVE_DISK=r2`).

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **check** — `pnpm lint`, `pnpm typecheck`, `node ace test unit functional`
  (SQLite, `.env.test`; the browser suite is excluded) and `pnpm build`.
  `.env` is copied from `.env.example`.
- **image** — `docker build`, then from the image runs the migrations against a
  Postgres 17 service container and checks that the web container answers
  `GET /` with 200. Tests run on SQLite, so this is where the Postgres
  migrations are exercised.

Deploy pipelines are not part of CI; a deploy runs the migration command above
before rolling out the new web and worker containers.

## Migrations

Run as a deploy step, before starting the new version, against the **direct**
(unpooled) connection:

```bash
node ace migration:run --connection=postgres_direct --force
```

Tables besides the transfer domain: `iam_grant` (refresh tokens, Phase 9),
`queue_jobs` / `queue_schedules` (queue), `rate_limits` (limiter counters).

## Environment variables

See `.env.example` for defaults and comments.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `TZ=UTC` | yes | Runtime. `LOG_LEVEL=info` emits every event below. |
| `APP_KEY` | yes (secret) | Cookie/session signing and encryption of upload tokens and refresh tokens. Rotating it signs everyone out and invalidates in-flight upload tokens. |
| `APP_URL` | yes | Public origin; used in email links and must match the bucket CORS origin. |
| `SESSION_DRIVER` | yes | `cookie` in every real environment. |
| `DATABASE_URL` | yes (secret) | Pooled Postgres (Neon pooler) for runtime queries. |
| `DATABASE_URL_UNPOOLED` | yes (secret) | Direct Postgres for migrations. |
| `IAM_ISSUER`, `IAM_CLIENT_ID`, `IAM_REDIRECT_URI` | yes | OIDC client registered in IAM. |
| `IAM_CLIENT_SECRET` | confidential clients (secret) | Empty for a public PKCE client. |
| `IAM_POST_LOGOUT_REDIRECT_URI` | no | Where IAM sends users after logout. |
| `IAM_RECHECK_SECONDS` | no (300) | How often a signed-in user's access is re-validated with IAM. |
| `DRIVE_DISK` | yes | `r2`. |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes (secret key) | Bucket access. The key needs object read/write/delete/list on the bucket only. |
| `STORAGE_UPLOAD_URL_TTL` / `STORAGE_DOWNLOAD_URL_TTL` | no (`1h` / `5m`) | Presigned URL lifetimes. Keep downloads short. |
| `STORAGE_MAX_SINGLE_PUT_BYTES` | no (5363466240) | Per-file cap (R2 single-PUT limit). |
| `QUEUE_DRIVER` | yes | `database`. |
| `LIMITER_STORE` | yes | `database` (shared by all replicas). `memory` only in tests: per-process counters would multiply the limits by the replica count. |
| `MAIL_ENABLED`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `SMTP_*` | when mail is on | Recipient notifications. |

Check storage settings with `node ace storage:probe` (presigned PUT → GET →
delete round trip; prints `OK`).

## Bucket

### CORS

Browsers upload (`PUT`) and download (`GET`) straight to the bucket, so its
CORS policy must allow `APP_URL`'s origin. On R2:

```json
[
  {
    "AllowedOrigins": ["https://share.example.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Use one entry per environment origin; never `*`.

### Lifecycle rule (safety net)

The cleanup job deletes objects of expired, abandoned and deleted transfers.
As a backstop in case the worker is down, add a lifecycle rule that deletes
objects under the `transfers/` prefix **31 days** after creation. Transfers
expire at most 30 days after creation, so the rule never removes bytes a
transfer can still serve.

R2: *Bucket → Settings → Object lifecycle rules → Add rule*, prefix
`transfers/`, action "Delete objects", after 31 days. Also abort incomplete
multipart uploads after 1 day (Share doesn't use multipart, but it costs
nothing).

Keep the bucket private: no public access, no `r2.dev` URL, no custom public
domain.

## Logs and metrics

Logs are JSON lines (pino) on stdout. Key events carry a stable `event` field
(the same string is the log message), so a log pipeline can turn them into
counters. They contain ids only — never passwords, upload tokens or presigned
URLs.

| `event` | Level | Fields | Metric idea |
|---|---|---|---|
| `transfer.created` | info | `transferId`, `userId`, `recipientCount`, `fileCount`, `declaredBytes` | transfers created |
| `transfer.upload_confirmed` | info | `transferId`, `userId`, `fileCount`, `storedBytes` | confirmed uploads; sum of `storedBytes` = storage added |
| `download.granted` | info | `transferId`, `fileId`, `userId` | download successes |
| `download.denied` | info | `transferId`, `fileId`, `userId`, `reason` (`not_found`, `forbidden`, `expired`, `invalid_password`, `rate_limited`, `download_limit_reached`) | download failures by reason |
| `cleanup.run` | info | `expired`, `abandoned`, `filesDeleted`, `prefixesPurged` | cleanup throughput; alert if absent for > 1 h (worker down) |
| `iam.recheck` | info / warn | `userId`, `outcome` (`ok`, `revoked`, `not_entitled`, `iam_unreachable`), `reason` (detail for failures) | sign-outs by IAM; `iam_unreachable` is logged at `warn` — a spike means IAM is down and users are being signed out (fail closed) |
| `rate_limited` | info | `userId`, `route` | throttled requests |

Every download attempt is also stored in `transfer_download` (audit trail),
including failures.

Storage usage over time: sum of `transfer.upload_confirmed.storedBytes`, or
directly `SELECT sum(size_bytes) FROM transfer_file WHERE deleted_at IS NULL`.

## Rate limits

`@adonisjs/limiter`, counters in `rate_limits` (`start/limiter.ts`):

| What | Limit | Key | Response |
|---|---|---|---|
| `POST /transfers/:id/download/:fileId` | 30 / minute | user | 429 `{ "error": "rate_limited" }` + `Retry-After` |
| `POST /transfers` | 10 / minute | user | same |
| Wrong transfer password | 5 / 15 minutes | user + transfer | 429 `{ "error": "rate_limited" }` on the next attempt, even with the right password, until the window ends |

## Security headers and transport (review, Phase 12)

- `@adonisjs/shield` (`config/shield.ts`): CSRF on for all state-changing
  methods (REST clients send `X-XSRF-TOKEN`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, HSTS 180 days. Serve only over HTTPS.
- Session and app cookies are `secure` in production, `httpOnly`,
  `sameSite=lax`.
- **CSP is disabled.** Enabling it needs nonces for Vite/Inertia scripts and
  `connect-src` for the bucket host (uploads use XHR to the presigned URL).
  Recommended follow-up; not done here because it needs browser verification
  against a real bucket.
- **Behind a load balancer**, set `http.trustProxy` in `config/app.ts` to the
  proxy's addresses; otherwise `request.ip()` (recorded on every
  `transfer_download` row) is the proxy's IP.
- Presigned URLs are short-lived (download 5 min) and issued only after the
  server-side checks; the bucket stays private.
- Fail closed: IAM unreachable during the periodic re-check signs the user out.
