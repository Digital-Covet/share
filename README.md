# Send Digital Covet

[![License](https://img.shields.io/github/license/Digital-Covet/share)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/Digital-Covet/share)](https://github.com/Digital-Covet/share/commits/main)
[![Issues](https://img.shields.io/github/issues/Digital-Covet/share)](https://github.com/Digital-Covet/share/issues)
![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)

A SolidStart web app for encrypting files in the browser and sharing them through expiring, optionally password-protected links.

## Overview

Send Digital Covet lets a signed-in user pick one or more files, encrypt them client-side with AES-256-GCM, and upload them directly to Cloudflare R2 through presigned multipart URLs. The server stores only metadata and generates share links. Recipients open `/s/{shareLinkId}`, fetch the file metadata, download the encrypted bytes via presigned range requests, and decrypt them in the browser.

Authentication is delegated to an external OpenID Connect identity provider (Digital Covet IAM) through Better Auth's `genericOAuth` plugin. There is no local password store.

> **Security note on key storage.** Encryption keys are generated in the browser, but the current implementation persists the key and IV base next to the file record (`File.encryptionKey`, `File.ivBase`) and returns them from the share metadata endpoint so recipients can decrypt. The service and anyone with database access can therefore decrypt stored files. Treat this as encryption in transit and in the bucket with server-held key material — **not** zero-knowledge end-to-end encryption.

## Features

- **Client-side encryption** — files are split into 5 MB chunks, each encrypted with AES-256-GCM and authenticated with an AAD binding of `{ fileId, chunkIndex, totalChunks }`.
- **Direct-to-R2 uploads** — S3 multipart uploads with presigned URLs (60 s TTL), refreshed on demand for long uploads.
- **Multi-file ZIP archives** — selecting several files bundles them into a single `files.zip` via `fflate` before encryption.
- **Share links with controls** — expiry (24 h / 7 d / 30 d / custom), one-time download, max-download count, and PBKDF2 password protection.
- **Dashboard** — list files, view status (pending, active, consumed, expired, revoked), edit expiry, and delete/revoke.
- **Chunked download pipeline** — presigned byte-range requests, client-side decryption, and streaming to disk where the File System Access API is available.
- **In-browser previews** — images, PDFs, extracted ZIP contents, and MSE-streamed video.
- **Expiry cleanup** — a secret-protected cron endpoint purges expired/revoked files and aborts stale upload sessions.
- **Security headers** — a strict Content-Security-Policy and related headers applied by SolidStart middleware.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | SolidStart `2.0.0-alpha.2`, SolidJS `^1.9.5` |
| Build | Vite `^7`, Nitro (Vercel preset) |
| Styling | Tailwind CSS `^4` |
| Database | PostgreSQL via Prisma `^7` (`@prisma/adapter-pg`) |
| Auth | Better Auth `^1.6` (`genericOAuth`) |
| Object storage | Cloudflare R2 via `@aws-sdk/client-s3` |
| Compression | `fflate` |
| Server effects & validation | `effect` (services, layers, typed errors, `Schema`) |
| UI primitives | `@ark-ui/solid`, `lucide-solid` |
| Tooling | Biome `2.4.16`, TypeScript `^6` |

## Requirements

- **Node.js ≥ 22**
- **pnpm** (a lockfile and workspace file are committed)
- A **PostgreSQL** database (two connection targets: auth and project data)
- A **Cloudflare R2** bucket and S3 credentials
- Access to an **OIDC provider** exposing discovery + JWKS (defaults to Digital Covet IAM)

## Installation

```bash
git clone https://github.com/Digital-Covet/share.git
cd share
pnpm install
```

Generate the two Prisma clients (output to `generated/`, which is git-ignored):

```bash
pnpm run generate
```

## Configuration

Create a `.env.local` (or `.env`) file in the project root. There is no `.env.example` in the repository — use the table below.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_APP_URL` | yes | `http://localhost:3000` | Public base URL used by the client and `apiUrl`. |
| `BETTER_AUTH_SECRET` | yes | — | Session signing secret. The auth module throws at startup if unset. |
| `BETTER_AUTH_URL` | yes | falls back to `VITE_APP_URL`, then `http://localhost:5173` / `https://share.digitalcovet.com` | Public URL Better Auth uses for callbacks. |
| `VITE_BETTER_AUTH_URL` | no | `window.location.origin` | Auth base URL used by the browser client. |
| `OAUTH_CLIENT_SECRET` | yes | — | Client secret for the `share` OAuth client. Throws if unset. |
| `IAM_URL` | no | `https://iam.digitalcovet.com` | OIDC issuer base URL. |
| `DATABASE_AUTH_URL` | yes | — | Pooled PostgreSQL URL for the auth client. |
| `DATABASE_PROJECT_URL` | yes | — | Pooled PostgreSQL URL for the project client. |
| `DIRECT_AUTH_URL` | for migrations | falls back to `DIRECT_PROJECT_URL` | Direct (non-pooled) URL used by `prisma/auth.config.ts`. |
| `DIRECT_PROJECT_URL` | for migrations | — | Direct URL used by `prisma.config.ts`. |
| `CLOUDFLARE_ACCESS_KEY` | yes | — | R2 access key ID. |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | yes | — | R2 secret access key. |
| `CLOUDFLARE_ENDPOINT_URL` | yes | — | R2 S3-compatible endpoint. Also added to the CSP `connect-src`/`media-src`. |
| `R2_BUCKET` | yes | — | R2 bucket name. |
| `CRON_SECRET` | for cron | — | Bearer token accepted by the purge endpoint. The endpoint returns `401` when unset. |
| `SESSION_SECRET` | no | `ENCRYPTION_KEY` or a built-in fallback | HMAC key for signed download-session tokens. |
| `ENCRYPTION_KEY` | no | — | Fallback source for `SESSION_SECRET`. |
| `IP_HASH_SALT` | recommended | `"fallback"` (with a warning) | Salt used when hashing client IPs. |

## Database Setup

Two Prisma schemas target PostgreSQL and are migrated through separate config files:

- `prisma/auth.prisma` → `prisma/auth-migrations` (Better Auth `user`, `session`, `account`, `verification`)
- `prisma/project.prisma` → `prisma/migrations` (`files`, `upload_sessions`, `share_links`, `file_reports`, `user_preferences`)

Apply migrations in development:

```bash
pnpm run migrate:auth
pnpm run migrate:project
```

Apply reviewed migrations to a shared or production database (never `db push`):

```bash
pnpm run deploy:auth
pnpm run deploy:project
```

## Usage

Start the development server:

```bash
pnpm run dev
```

The app serves at `http://localhost:5173` by default. Signing in redirects to the configured IAM provider, then back to `/dashboard`. From there you can upload files and share them from `/upload`.

### Available Scripts

| Script | Description |
| --- | --- |
| `pnpm run dev` | Start the Vite dev server (HMR). |
| `pnpm run build` | Generate both Prisma clients, then build for production. |
| `pnpm run start` | Start the production server. |
| `pnpm run preview` | Preview a production build locally. |
| `pnpm run format` | Format with Biome. |
| `pnpm run lint` | Lint and auto-fix with Biome. |
| `pnpm run typecheck` | Type-check with `tsc --noEmit`. |
| `pnpm run test` | Run the Vitest suite. |
| `pnpm run generate` | Generate both Prisma clients. |
| `pnpm run generate:auth` / `generate:project` | Generate one client. |
| `pnpm run migrate:auth` / `migrate:project` | Run dev migrations. |
| `pnpm run deploy:auth` / `deploy:project` | Deploy migrations. |

There is currently no CI workflow in the repository.

## How It Works

### Upload

1. The browser generates an AES-256-GCM master key and a 12-byte IV base.
2. Files are optionally zipped, then split into 5 MB plaintext chunks.
3. `POST /api/files/initiate-upload` creates the file record and an R2 multipart upload, returning presigned part URLs.
4. Encrypted chunks are uploaded directly to R2; `GET /api/files/resume-upload` refreshes expired presigned URLs.
5. `POST /api/files/complete-upload` finalizes the multipart upload and creates a share link (expiry, one-time, max downloads).

### Download

1. A recipient opens `/s/{shareLinkId}`; the client calls `POST /api/files/[fileID]/meta` with an optional password.
2. The server validates expiry, consumption, and password, then returns metadata (including key material).
3. The client requests presigned range URLs from `POST /api/files/[fileID]/download-urls` and decrypts each chunk with the IV derived from the base plus the chunk index.
4. One-time and max-download links are consumed with an atomic conditional `UPDATE`; the file is scheduled for deletion shortly after consumption.

## API Reference

All routes live under `src/routes/api`.

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET`/`POST` | `/api/auth/*` | Better Auth handler (OAuth sign-in, callback, session). |
| `POST` | `/api/sign-out` | Revoke IAM tokens, call the end-session endpoint, and clear the session. |
| `GET`/`POST` | `/api/auth/front-channel-logout` | Process an IAM logout token and delete matching sessions. |

### Files

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/files` | List the current user's files with derived status. |
| `POST` | `/api/files/initiate-upload` | Create the file record + multipart upload, return presigned part URLs. |
| `GET` | `/api/files/resume-upload?fileId=&parts=` | Refresh presigned part URLs for an in-progress upload. |
| `POST` | `/api/files/complete-upload` | Complete a multipart upload and create a share link. |
| `POST` | `/api/files/finalize` | Finalize a non-multipart upload and create a share link. |
| `POST` | `/api/files/[fileID]/meta` | Share metadata + key material (password in the JSON body). |
| `POST` | `/api/files/[fileID]/download-urls` | Presigned byte-range URLs for requested chunk indices. |
| `POST` | `/api/files/[fileID]/update-expiry` | Update file and active share-link expiry. |
| `POST` | `/api/files/[fileID]/delete` | Revoke share links and delete R2 objects. |

### Share Links & Cron

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/share-links` | Create an additional share link for a file. |
| `GET` | `/api/shared` | List the current user's active share links. |
| `GET` | `/api/cron/purge-expired` | Purge expired/revoked files and abort stale uploads. Requires `Authorization: Bearer $CRON_SECRET`. |

## Security Model

- **Encryption:** AES-256-GCM with 128-bit auth tags, 5 MB plaintext chunks, and a 12-byte IV base; the per-chunk IV is the base with a little-endian counter added at bytes 8–11. AAD is the JSON `{ fileId, chunkIndex, totalChunks }`.
- **Share-link passwords:** PBKDF2-SHA256, 600,000 iterations, 16-byte salt, 32-byte derived key, constant-time comparison.
- **Download sessions:** HMAC-SHA256-signed tokens (1 hour TTL) bound to a share link, so a download can span multiple presigned-URL calls.
- **Consumption:** one-time and max-download limits are enforced with conditional SQL `UPDATE`s to avoid races.
- **Rate limiting:** the share metadata endpoint is limited to 10 requests/minute per IP + file using an in-process fixed-window limiter. This is per-instance and not shared across serverless invocations.
- **Headers:** middleware sets CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **Presigned URLs:** all upload/download URLs expire after 60 seconds.

## Project Structure

```
prisma/
  auth.prisma            # Better Auth schema
  project.prisma         # Files, upload sessions, share links, reports
  auth.config.ts         # Migration config for the auth schema
  migrations/            # Project migrations
  auth-migrations/       # Auth migrations
src/
  components/
    auth/                # Auth guard, toaster, sign-out button
    dashboard/           # File table, stats, expiry/delete modals
    recieve/             # Share viewer, previews, MSE video player
    sidebar/             # Navigation
    upload/              # SecureUpload orchestrator, drop zone, settings
    ui/                  # Shared primitives
  db/                    # Prisma clients (auth, project) over @prisma/adapter-pg
  lib/
    api/                 # meta fetch + apiUrl helper
    crypto/              # encrypt, decrypt, keys, IV, password hashing
    download/            # Download pipeline, streaming, MSE, PDF trailer
    auth.ts              # Better Auth server config (genericOAuth)
    auth-client.ts       # Better Auth solid client
    auth.server.ts       # getSession / getCurrentUser helpers
    compression.ts       # ZIP create/extract (fflate)
    constants.ts         # App constants, chunk/expiry/presign settings
    file-map.ts          # File row → dashboard DTO
    rate-limit.ts        # In-memory fixed-window limiter
    share-link.ts        # Derived share-link status
  routes/
    api/                 # API endpoints (auth, files, share-links, shared, cron)
    auth/login.tsx       # OAuth sign-in page
    s/[shareLinkId]/     # Public share page
    dashboard.tsx        # File management
    upload.tsx           # Secure upload
    recieve.tsx          # Shared files list
  server/
    effect/              # Effect layer: config, errors, services (Database,
                         # Storage, Auth, DownloadSessions), runtime, effectRoute
    purge-expired.ts     # Purge job (Effect program run by the cron route)
    r2-keys.ts           # R2 key layout
  middleware.ts          # Auth gate + security headers
  utils/upload.ts        # Chunk size, size formatting
vercel.json              # Cron schedule
vite.config.ts           # SolidStart + Nitro (vercel) + Tailwind
```

## Deployment

The app is configured for Vercel through the Nitro `vercel` preset in `vite.config.ts`. Build with `pnpm run build` (which generates Prisma clients first) and provide every required environment variable in the project settings.

`vercel.json` registers a daily cron job:

```json
{
  "crons": [{ "path": "/api/cron/purge-expired", "schedule": "0 0 * * *" }]
}
```

Set `CRON_SECRET` so the scheduled request can authenticate, and run `pnpm run deploy:auth && pnpm run deploy:project` to apply migrations before the first deploy.

## License

MIT, see [LICENSE](LICENSE).
