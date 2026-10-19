# CovetDrop (Share) — Implementation Phases

## How to use this file (for the coding agent)

- Work on **one phase at a time**, in order, unless told otherwise.
- Before starting, read the Overview and the whole phase you're on.
- Stay within that phase's Scope and Files. If you find you need to change something outside it, stop and ask instead of expanding the phase.
- When every "Done when" item passes, tick the boxes, set Status to ✅ Done, update the Progress table, and stop. Don't start the next phase until asked.
- If a step turns out to be wrong or impossible, stop and explain; don't improvise a different design.
- Files under `.adonisjs/` and `database/schema.ts` are **generated** (controller index, Tuyau route registry, Inertia page types, Lucid schema classes). They regenerate when you run `pnpm dev`, `node ace …` or migrations. Commit the regenerated versions with your phase; never hand-edit them.

## Overview

- **Goal:** An internal large-file transfer service for Digital Covet employees. A signed-in IAM user creates a transfer (title, message, files ≤ 5 GiB each, optional password, expiry, optional max downloads) for specific colleagues; files go straight to object storage via presigned URLs; recipients (and the creator) download after authorization checks, and every download attempt is recorded.
- **Source:** `share-architecutre-system.md` ("CovetDrop — Architecture", repo root) plus the existing codebase at commit `9d14102`.
- **Stack & key decisions (do not change):**
  - AdonisJS 7 (`@adonisjs/core` ^7.5) + Lucid + Inertia 3 + React 19 + TypeScript, Vite, Tailwind 4, Base UI (`@base-ui/react`), `lucide-react`, `sonner` toasts, Tuyau route registry.
  - PostgreSQL (Neon). Runtime uses the pooled `postgres` connection; migrations/DDL use `postgres_direct`.
  - **Identity is IAM only.** Sign-in is OIDC auth-code + PKCE (`app/services/iam_client.ts`, `app/controllers/iam_controller.ts`). The local `user` table is a mirror keyed by IAM `sub`, upserted on sign-in. Users without `share` in the `app_access` claim are refused at sign-in, and (from Phase 9) re-checked every few minutes via IAM's refresh-token grant; failures sign the user out (fail closed). Sessions use the `web` guard (`@adonisjs/auth`).
  - Share tables already exist: `transfer`, `transfer_file`, `transfer_recipient`, `transfer_download` (see `database/migrations/`). Models exist in `app/models/`. `Transfer` uses the `withSoftDeletes` mixin — rows are **not** filtered automatically; always use `.withScopes((s) => s.active())`.
  - File bytes never pass through the app: **presigned PUT for upload, presigned GET for download**, via Adonis Drive with an S3-compatible driver (Cloudflare R2 preferred; GCS acceptable).
  - Recipient scoping = explicit rows in `transfer_recipient`. **All download paths require an authenticated user who is either the creator or listed in `transfer_recipient`** (admins may view/delete — Phase 8 — but downloads follow this rule).
  - **No transfer status / activation flag.** A transfer is available as soon as its files are confirmed uploaded. Confirmation is expressed by data that already exists: **`transfer_file` rows are inserted by `POST /transfers/:id/complete`, not by `POST /transfers`.** A transfer with ≥ 1 `transfer_file` row is confirmed; one with none is unconfirmed. See *Transfer availability* below.
  - Download checks run server-side before issuing a URL: transfer not deleted, not expired, password (if set) verified against `password_hash`, `max_downloads` (enforced inside a DB transaction that also inserts the `transfer_download` row).
  - `POST /transfers`, `POST /transfers/:id/complete` and `POST /transfers/:id/download/:fileId` are **REST/JSON** endpoints called with `fetch` (CSRF token included). Pages (`GET`) are Inertia.
  - Roles come from IAM: Share requests the `roles` scope and IAM puts the user's role name in the `role` ID-token claim (system roles `superadmin`, `admin`, `employee`; custom role names are possible).
  - Passwords are hashed with the app's `hash` service (`config/hash.ts`, scrypt). Never stored or logged in plaintext.
  - Async work (expiry cleanup, notification email) runs through an Adonis queue (Phase 10+).
- **Commands** (package manager is **pnpm**, Node ≥ 24):
  - Install: `pnpm install`
  - Dev server: `pnpm dev` (IAM runs on 3333 locally — set Share's `PORT` to something else, e.g. 3334)
  - Migrations: `node ace migration:run --connection=postgres_direct`
  - Tests: `pnpm test` (all suites) · `node ace test unit` · `node ace test functional` · filter: `node ace test functional --files=tests/functional/transfers/create.spec.ts`
  - Lint: `pnpm lint` · Typecheck: `pnpm typecheck` · Build: `pnpm build`
- **Conventions:**
  - Imports use subpath aliases from `package.json` (`#models/*`, `#services/*`, `#controllers/*`, `#validators/*`, `#policies/*`, `#middleware/*`, `#start/*`, `#config/*`). Frontend uses `~/…` for `inertia/…`.
  - Controllers: one class per resource in `app/controllers/<name>_controller.ts`, referenced in `start/routes.ts` as `[controllers.<Name>, 'method']` from `#generated/controllers` (see `iam_controller.ts`, `session_controller.ts`). Name every route (`.as('transfers.show')`) — the frontend links by route name (`<Form route="…">`, `NavLink route="…"`).
  - Business logic lives in services (`app/services/*.ts`, see `iam_client.ts` style: short doc comment per method), not controllers.
  - Validators: VineJS in `app/validators/<name>.ts`.
  - Serialization to the frontend: transformers in `app/transformers/` (see `user_transformer.ts`).
  - Pages: `inertia/pages/<area>/<page>.tsx`, wrapped in `<Page title=…>` with `Page.layout = [AppLayout]` (see `inertia/pages/dashboard.tsx`). Add nav entries in the `nav` array of `inertia/layouts/app.tsx`. Use existing CSS classes from `inertia/css/app.css` (`btn`, `empty`, etc.) before adding new ones.
  - Comments: short doc comments on classes/exported functions explaining *why*, matching existing files.
  - Tests: Japa. Unit tests in `tests/unit/**`, HTTP tests in `tests/functional/**` (suites already declared in `adonisrc.ts`).

### Shared contracts (referenced by several phases)

**Object keys:** `transfers/<transfer_id>/<transfer_file_id>` (no user-supplied filename in the key).

**`StorageService`** (`app/services/storage_service.ts`, Phase 2):
```ts
presignUpload(key: string, opts: { contentType: string; sizeBytes: number }): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }>
presignDownload(key: string, opts: { filename: string }): Promise<string> // sets Content-Disposition: attachment
delete(key: string): Promise<void>               // idempotent
deletePrefix(prefix: string): Promise<void>      // idempotent; removes every object under `prefix`
stat(key: string): Promise<{ sizeBytes: number } | null>  // null when the object doesn't exist
```
Presigned URL lifetime: `STORAGE_UPLOAD_URL_TTL` (default `1h`) and `STORAGE_DOWNLOAD_URL_TTL` (default `5m`).

**Upload token** (Phase 3): `POST /transfers` returns an `uploadToken` — the file manifest encrypted with Adonis's `encryption` service (`encryption.encrypt(manifest, '24h', 'transfer-upload:<transferId>')`), so the client can neither read nor alter it. Manifest shape:
```ts
type UploadManifest = { transferId: string; files: Array<{ id: string; filename: string; sizeBytes: number; mimeType: string | null; objectKey: string }> }
```
The token lives only in the creator's browser. If it's lost mid-upload, the creator deletes the transfer and creates a new one (resumable uploads are out of scope).

**Transfer availability:** there is no status column.
- *Unconfirmed* = non-deleted transfer with **no** `transfer_file` rows (upload in progress or abandoned). Visible only to its creator (badge "Upload not confirmed", delete allowed); hidden from recipients and admins' lists; never downloadable.
- *Confirmed* = has ≥ 1 `transfer_file` row. Rows are inserted by `complete` only after each object is verified in storage with the declared size, so a file row always means the bytes are there.
- `complete` is idempotent: rows use the manifest's fixed ids with `ON CONFLICT (id) DO NOTHING`. **The call that actually inserts the rows is the first confirmation** — only that call dispatches the recipient notification (Phase 11).
- Unconfirmed transfers older than 24 h are soft-deleted and their `transfers/<id>/` prefix purged by the cleanup job (Phase 10).
- Expired (`expires_at <= now()`) transfers stay visible but are not downloadable.

**Access rule** (`TransferPolicy`, Phase 5): `canView(user, transfer)` ⇔ (`transfer.createdBy === user.id`) OR (transfer is confirmed AND (user is in `transfer_recipient` OR (Phase 8) user is admin/superadmin)). `canDownload(user, transfer)` ⇔ transfer is confirmed AND (creator OR in `transfer_recipient`) — admins are **not** added. Non-viewers get **404** (never reveal existence).

## Out of scope

- Anonymous/external recipients and public links without IAM login.
- Multi-tenancy, teams/groups as entities, in-file search, previews, collaboration.
- Multipart/resumable uploads (see Open question 6) and raising the 5 GiB limit.
- Zip/"download all" of a whole transfer (`transfer_download.transfer_file_id` allows NULL for it, but nothing builds it now).
- Writing to IAM's `audit_log` (Share's own `transfer_download` is the audit trail here).
- Any transfer status/activation column.
- Editing a transfer after creation (adding files/recipients, changing expiry).
- Infrastructure provisioning (buckets, managed Postgres, secret manager) — the app only reads env vars.
- Full OpenTelemetry tracing export (Phase 12 does structured logs + basic metrics hooks only).

## Open questions / assumptions

**Resolved (2026-10-19):**
- ~~Activation column~~ → no status flag; `complete` only confirms uploads and the transfer is immediately usable (see *Transfer availability*).
- ~~Role claim~~ → IAM (`../iam/app/services/oauth_service.ts`, `userClaims`) emits `role` = role name when the `roles` scope is granted. Implemented in Phase 8.
- ~~Create endpoint type~~ → `POST /transfers` is REST returning JSON.
- ~~Duplicate notifications / abandoned uploads~~ → `transfer_file` rows are inserted by `complete` from an encrypted upload token; "has file rows" = confirmed; first inserting call notifies; cleanup purges unconfirmed transfers after 24 h (see *Upload token* and *Transfer availability*).
- ~~Entitlement checked only at sign-in~~ → Phase 9 re-checks every `IAM_RECHECK_SECONDS` (default 300) with IAM's refresh-token grant, which returns a fresh ID token whose `app_access` and `role` are re-read from IAM's DB (`../iam/app/services/oauth_service.ts`: `refresh` → `mintTokens` → `userClaims`). Introspection isn't used because it doesn't return `app_access`.

**Still open:**

1. *(resolved — see above)*
2. *(resolved — see above)*
3. **Refresh-token storage.** IAM rotates refresh tokens and revokes the whole grant when a rotated token is reused, so the token can't live in the cookie session (parallel requests would replay it). *Decision:* store it encrypted in a new `iam_grant` table and serialise refreshes with `SELECT … FOR UPDATE SKIP LOCKED` (Phase 9). *Assumption:* adding this auth-support table is fine (it's not a transfer status). ~~Is `offline_access` allowed?~~ Verified in `../iam/app/controllers/consent_controller.ts`: `offline_access` and `roles` are in IAM's global `SCOPE_REGISTRY` with no per-client allowlist, so the Share client can request them. Because they are new scopes, every user sees IAM's consent card once more ("Sign you in automatically", "Read your role"); after that IAM reuses the grant. — affects 8, 9
4. **Recipient picker source.** Recipients must exist in the local `user` mirror (FK). Users who have never signed in to Share aren't there. *Assumption:* picker searches the local mirror only; a later phase could sync from an IAM directory API if IAM exposes one. — affects 4
5. **Admin visibility, max_downloads semantics.** Spec open questions. *Assumptions:* creator may always view/download without being a recipient (per the download rule); admin/superadmin may view and soft-delete any transfer but cannot download unless creator/recipient; any other role name (including custom roles) is treated as a regular employee; `max_downloads` counts **successful** `transfer_download` rows across all users and files of the transfer. — affects 5, 6, 8
6. **5 GiB single PUT.** R2 caps single-request uploads slightly below 5 GiB (≈ 5 GiB − 5 MiB); S3 caps at exactly 5 GiB. A file at the DB limit may fail on R2 without multipart. *Assumption:* single presigned PUT; Phase 2 verifies the real cap and the validator in Phase 3 uses `min(5 GiB, provider cap)`. Multipart is out of scope. — affects 2, 3
7. **Password hashing algorithm.** Spec says bcrypt/argon2; the app's configured hasher is scrypt. *Assumption:* use the configured `hash` service (scrypt) — equally acceptable; switch only if required by policy. — affects 3
8. **Queue and mail packages.** Neither is installed. Phase 10 picks the queue package compatible with `@adonisjs/core` 7 (official `@adonisjs/queue` if released for v7; otherwise stop and ask). Phase 11 uses `@adonisjs/mail`. Email is assumed **optional** (`MAIL_ENABLED=false` disables it). — affects 10, 11
9. **Test database.** Tests need a real Postgres. *Assumption:* a dedicated database (local Postgres or a Neon branch) set in `.env.test`; tests migrate it and wrap each test in a global transaction. — affects 1 onward

## Progress

| # | Phase | Depends on | Status |
|---|-------|-----------|--------|
| 1 | Set up HTTP test harness and test database | — | ✅ |
| 2 | Add object storage (Drive + presigned URLs) | 1 | ✅ |
| 3 | Create & complete transfer API | 1, 2 | ☐ |
| 4 | Create-transfer page with recipient picker and uploads | 3 | ☐ |
| 5 | Transfer access policy and detail page | 3 | ☐ |
| 6 | Download endpoint with checks and tracking | 2, 5 | ☐ |
| 7 | Transfer list and dashboard | 5 | ☐ |
| 8 | Roles mirror and soft delete | 5, 7 | ☐ |
| 9 | Periodic IAM access re-check | 8 | ☐ |
| 10 | Queue and transfer cleanup | 2, 3 | ☐ |
| 11 | Email notification on upload confirmation | 10 | ☐ |
| 12 | Observability and hardening | 6, 10 | ☐ |
| 13 | Container image and CI | 12 | ☐ |

---

## Milestone A — Foundations

## Phase 1 — Set up HTTP test harness and test database

**Status:** ✅ Done
**Depends on:** None

> **Deviation (decided 2026-10-19):** tests run on **SQLite** (`better-sqlite3`, file `tmp/db.test.sqlite3`, `DB_CONNECTION=sqlite` in `.env.test`) instead of a Postgres test database. Consequences for later phases:
> - Migrations use `uuidDefault(this)` from `database/uuid_default.ts` (Postgres: `gen_random_uuid()`; SQLite: equivalent expression). New migrations with generated uuid PKs must do the same.
> - Lucid doesn't read generated ids back on SQLite (no `RETURNING`), so code creating rows whose id it needs (e.g. `Transfer` in Phase 3) must assign `randomUUID()` itself.
> - SQLite ignores `FOR UPDATE [SKIP LOCKED]`; the concurrency tests in Phases 6, 9 and 10 can't prove locking on this harness.
> - Extra files touched: `config/database.ts` (`sqlite` connection, default from `DB_CONNECTION`), `start/env.ts` (`DB_CONNECTION`), the four migrations above, `eslint.config.js` (ignore generated `database/schema.ts`, which already failed `pnpm lint`). `@adonisjs/inertia`'s `inertiaApiClient` is also registered.

### Goal
`pnpm test` runs real unit and functional (HTTP) tests against a migrated test database, with a helper to act as a signed-in user. Every later phase relies on this.

### Context
Japa is configured (`tests/bootstrap.ts`) with only the browser client; there are no tests and no `@japa/api-client`. `.env.test` only sets `SESSION_DRIVER=memory`. The `web` guard logs users in via session; `@adonisjs/auth` and `@adonisjs/session` both ship api-client plugins (`authApiClient`, `sessionApiClient`) enabling `client.get(url).loginAs(user)`.

### Scope
- **In:** api-client plugin, test DB config, migrate-on-setup + per-test transaction, a user factory, smoke tests for existing routes.
- **Out:** tests for features not built yet; browser (Playwright) tests; CI config (Phase 13).

### Files
- `package.json` — add `@japa/api-client` (dev)
- `tests/bootstrap.ts` — register `apiClient()`, `sessionApiClient(app)`, `authApiClient(app)`; add `testUtils.db().migrate()` to runner setup
- `.env.test` — `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (test DB), `IAM_*` dummy values, `APP_KEY`
- `.env.example` — document the test DB variables (comment only)
- `database/factories/user_factory.ts` (new) — Lucid factory for `User` (random uuid `id`, unique email, name)
- `tests/functional/smoke.spec.ts` (new)
- `tests/unit/user.spec.ts` (new) — `User#initials` cases

### Steps
1. Install `@japa/api-client` and register the three plugins in `tests/bootstrap.ts` (keep the browser client for the `browser` suite).
2. Point `.env.test` at a dedicated test database (both URLs may be the same direct connection). Add placeholder `IAM_ISSUER=http://localhost:3999`, `IAM_CLIENT_ID=test`, `IAM_REDIRECT_URI=http://localhost:3334/auth/iam/callback`, and an `APP_KEY`.
3. In runner `setup`, run migrations on the test DB (`testUtils.db('postgres_direct').migrate()` or equivalent). In functional specs, use `group.each.setup(() => testUtils.db().withGlobalTransaction())`.
4. Create `UserFactory` (`@adonisjs/lucid/factories`).
5. Write smoke tests: `GET /` → 200; `GET /dashboard` unauthenticated → redirect to `/login`; `GET /dashboard` with `.loginAs(user)` → 200 (Inertia component `dashboard`).
6. Write unit tests for `User#initials` (two-word name, single name, email fallback).

### Done when
- [x] `node ace test unit` passes (≥ 3 tests)
- [x] `node ace test functional` passes (3 smoke tests above)
- [x] `pnpm lint` and `pnpm typecheck` pass
- [x] Running `pnpm test` twice in a row passes (global transaction leaves no data behind)
- [x] No changes outside the files listed above (plus `pnpm-lock.yaml`) — except the SQLite deviation files noted at the top of this phase

---

## Phase 2 — Add object storage (Drive + presigned URLs)

**Status:** ✅ Done
**Depends on:** Phase 1

> **Implementation notes (2026-10-19):**
> - `@adonisjs/drive` 4.0.0 + `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner`. `node ace configure` only prompts (it can't run non-interactively), so the provider, config and env were added by hand following the package's stub.
> - flydrive's `fs` driver and `drive.fake()` can't sign uploads. `config/drive.ts` therefore defines the `fs` disk as an `FSDriver` factory (`tmp/drive`), and the fakes get a URL builder that returns stand-in `/drive/local/<get|put>/<key>?<signed options>` URLs, so tests can inspect what was signed (e.g. `contentDisposition`). Those URLs aren't served; `storage:probe` only works against `r2`.
> - `presignUpload` also signs `ContentLength` (the declared size). Verified on R2: a PUT with a different body length is rejected with 403. `complete` (Phase 3) still checks the size.
> - `R2_*` are optional in `start/env.ts`, so the app boots without a bucket and the first storage call fails instead.
> - StorageService methods are static (matching `IamClient`): `StorageService.presignUpload(...)`.
> - Single-PUT cap: R2's documented 5 GiB − 5 MiB (`5363466240`). The probe confirmed the round trip on bucket `covetdrop-transfers`; the cap itself was not measured with a ~5 GiB upload.

### Goal
A `StorageService` that issues presigned PUT/GET URLs against R2 (or GCS) via Adonis Drive, proven with a real round trip. Done early because it's the riskiest external dependency.

### Context
See *Shared contracts → StorageService* and *Object keys* in the Overview. Spec: direct-to-cloud upload/download; storage credentials server-side only; short-lived URLs. Open question 6 (single-PUT size cap) is answered here.

### Scope
- **In:** install/configure `@adonisjs/drive` with an S3 (R2) disk and a local `fs` disk for tests, env vars, `StorageService`, an ace probe command, unit tests.
- **Out:** any transfer logic, routes, UI, multipart upload, bucket lifecycle rules (Phase 12 documents them).

### Files
- `package.json` — `@adonisjs/drive` (+ AWS SDK peer deps it requires)
- `adonisrc.ts` — drive provider (via `node ace configure @adonisjs/drive`)
- `config/drive.ts` (new) — disks `r2` (S3 driver: endpoint, region `auto`, bucket, keys) and `fs` (test)
- `start/env.ts` — `DRIVE_DISK`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `STORAGE_UPLOAD_URL_TTL`, `STORAGE_DOWNLOAD_URL_TTL`, `STORAGE_MAX_SINGLE_PUT_BYTES`
- `.env.example`, `.env.test` — the variables above (`DRIVE_DISK=fs` in test)
- `app/services/storage_service.ts` (new) — methods exactly as in the shared contract
- `commands/storage_probe.ts` (new) — `node ace storage:probe`
- `tests/unit/storage_service.spec.ts` (new)

### Steps
1. Run `node ace add @adonisjs/drive` (or install + configure) choosing the S3 service; add an `fs` disk for tests.
2. Add and validate env vars in `start/env.ts`; secrets via `Env.schema.secret()` where appropriate.
3. Implement `StorageService` using `drive.use()` — `getSignedUploadUrl` / `getSignedUrl` with `contentDisposition: attachment; filename="<sanitized>"` (RFC 5987 encoding for non-ASCII). Return the headers the client must send on PUT (`Content-Type`).
4. Implement `storage:probe`: writes a small object via a presigned PUT using `fetch`, reads it back via presigned GET, deletes it, prints OK/FAIL. Run it once against a real R2 bucket and record the observed single-PUT size cap in `STORAGE_MAX_SINGLE_PUT_BYTES`'s comment in `.env.example`.
5. `stat` returns the object's size or `null` when missing (Drive `getMetaData` / `exists`); `deletePrefix` uses Drive's `deleteAll(prefix)`.
6. Unit tests (fs disk / `drive.fake()`): key → URL is a string; `delete` on a missing key doesn't throw; `stat` returns the size for a written object and `null` for a missing one; `deletePrefix('transfers/x/')` removes both objects under it and leaves `transfers/y/…`; `presignDownload` encodes a filename with spaces and `ü`.

### Done when
- [x] `node ace test unit --files=tests/unit/storage_service.spec.ts` passes
- [x] `node ace storage:probe` prints `OK` against a real bucket (manual; paste output in the commit message)
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [x] App still boots with `pnpm dev` using `.env.example` values (IAM placeholders filled; R2 left empty)
- [x] No changes outside the files listed above (plus generated `.adonisjs/client/manifest.d.ts`)

---

## Milestone B — Walking skeleton: create → view → download

## Phase 3 — Create & complete transfer API

**Status:** ☐ Not started
**Depends on:** Phase 1, Phase 2

### Goal
A signed-in user can create a transfer (metadata, recipients, declared file list) and receive presigned upload URLs plus an upload token, then confirm the upload — which writes the `transfer_file` rows and makes the transfer immediately usable.

### Context
Tables/models exist (`app/models/transfer*.ts`); **no migration in this phase** — there is no status column. Read *Upload token* and *Transfer availability* in the Overview first: `POST /transfers` writes `transfer` + `transfer_recipient` only; `transfer_file` rows are written by `complete`. Both endpoints are REST/JSON. Hash passwords with the configured `hash` service (Open question 7). Size cap per Open question 6. Use `StorageService.presignUpload` / `stat`, the object key format, and Adonis `encryption` (`@adonisjs/core/services/encryption`, `encrypt(value, expiresIn, purpose)` / `decrypt(value, purpose)`).

**Contract — `POST /transfers`** (route name `transfers.store`, REST, auth required), JSON body:
```json
{ "title": "string 1..200", "message": "string ≤ 5000 | null",
  "expiresAt": "ISO datetime, > now, ≤ now + 30 days",
  "maxDownloads": "integer ≥ 1 | null", "password": "string 8..128 | null",
  "recipientIds": ["uuid", "... 1..50, existing user ids, not the creator"],
  "files": [{ "filename": "1..255", "sizeBytes": "1..STORAGE_MAX_SINGLE_PUT_BYTES", "mimeType": "string | null" }] }
```
`files` has 1..20 items. Response **201**:
```json
{ "transferId": "uuid",
  "uploadToken": "opaque string (encrypted UploadManifest, 24 h)",
  "uploads": [{ "fileId": "uuid", "url": "…", "method": "PUT", "headers": { "Content-Type": "…" } }] }
```
Validation failure → **422** with VineJS errors.

**Contract — `POST /transfers/:id/complete`** (route name `transfers.complete`, REST), JSON body `{ "uploadToken": "string" }`. Creator only, non-deleted (others → 404). Token that fails to decrypt, is expired, or whose `transferId` ≠ `:id` → **422** `{ "error": "invalid_upload_token" }`.
1. For every manifest file, `StorageService.stat(objectKey)`; missing → **409** `{ "error": "files_missing", "fileIds": [...] }`; size ≠ declared `sizeBytes` → **409** `{ "error": "size_mismatch", "fileIds": [...] }`. Nothing is written on 409.
2. Otherwise insert all `transfer_file` rows (manifest ids/keys) in one statement with `ON CONFLICT (id) DO NOTHING RETURNING id`.
3. **200** `{ "transferId": "uuid", "firstConfirmation": boolean }` — `true` only when this call inserted the rows. Safe to call repeatedly.

### Scope
- **In:** validators, `TransferService.create` / `complete`, upload-token helpers, controller methods, routes, tests.
- **Out:** any schema change; UI (Phase 4); recipient search endpoint (Phase 4); read endpoints (Phase 5+); notifications (Phase 11 hooks into `complete` when `firstConfirmation` is true).

### Files
- `app/validators/transfer.ts` (new) — `createTransferValidator`, `completeTransferValidator`
- `app/services/upload_token.ts` (new) — `sealManifest(manifest): string`, `openManifest(token, transferId): UploadManifest | null`
- `app/services/transfer_service.ts` (new) — `create(user, payload)`, `complete(user, transferId, uploadToken)`
- `app/controllers/transfers_controller.ts` (new) — `store`, `complete`
- `start/routes.ts` — two routes in the `auth` group
- `database/factories/transfer_factory.ts` (new)
- `tests/functional/transfers/create.spec.ts` (new)

### Steps
1. Validator: rules above; `recipientIds` checked against `user` table (`exists` rule), deduplicated, creator excluded.
2. `TransferService.create`: in one DB transaction insert `transfer` (hash password if present) and `transfer_recipient` rows. Generate a uuid per declared file (`randomUUID()`), set `objectKey = transfers/<transferId>/<fileId>`, seal the manifest, presign one upload per file. **Do not insert `transfer_file` rows.**
3. `TransferService.complete`: load transfer by id where `created_by = user.id` with the `active()` scope; open the token; `stat` every object; on success insert rows with `db.table('transfer_file').insert(rows).onConflict('id').ignore().returning('id')` and set `firstConfirmation = returned.length > 0`.
4. Controller returns JSON with the status codes in the contract. Make sure CSRF works for `fetch` (Shield's `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header).
5. Tests (with `drive.fake()`):
   - create: 201 shape incl. `uploadToken`; no `transfer_file` rows after create; 422 for size > cap, empty files, past expiry, unknown recipient; password stored hashed (≠ plaintext, `hash.verify` passes).
   - complete: 409 `files_missing` when an object is absent (no rows written); 409 `size_mismatch` when an object's size differs; 200 `firstConfirmation: true` after faking objects and rows exist with the manifest ids; second call 200 `firstConfirmation: false` and still exactly N rows; tampered token → 422; token for another transfer → 422; other user → 404; unauthenticated → redirect/401.

### Done when
- [ ] `node ace test functional --files=tests/functional/transfers/create.spec.ts` passes (all cases in step 5)
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] `git status database/migrations` shows no new migrations (no schema change)
- [ ] No changes outside the files listed above (plus generated `.adonisjs/**`)

---

## Phase 4 — Create-transfer page with recipient picker and uploads

**Status:** ☐ Not started
**Depends on:** Phase 3

### Goal
A user can open "New transfer", pick colleagues, attach files, upload them with progress directly to storage, and land on a confirmation once the upload is confirmed.

### Context
Uses the Phase 3 REST contracts (full shapes in Phase 3 → Context):
- `POST /transfers` with `{ title, message, expiresAt, maxDownloads, password, recipientIds[], files[{ filename, sizeBytes, mimeType }] }` → 201 `{ transferId, uploadToken, uploads[{ fileId, url, method: 'PUT', headers }] }`, or 422 with field errors.
- `POST /transfers/:id/complete` with `{ uploadToken }` → 200 `{ transferId, firstConfirmation }`, 409 `{ error: 'files_missing' | 'size_mismatch', fileIds }`, or 422 `{ error: 'invalid_upload_token' }`. Call it after all uploads succeed; it's idempotent, so retrying after a network error is safe.

Keep `uploadToken` in component state only (not `localStorage`). If the user leaves mid-upload the transfer stays unconfirmed (visible only to them) and is purged after 24 h (Phase 10).

Recipients come from the local `user` mirror (Open question 4). Upload each file with `XMLHttpRequest` PUT to `uploads[i].url` with `uploads[i].headers` (XHR gives progress events). The browser must never send files to the Adonis server. Copy page structure from `inertia/pages/dashboard.tsx`; use Base UI primitives (Combobox for recipients) and `sonner` toasts for errors. R2/GCS bucket CORS must allow `PUT` from `APP_URL` — note it in `.env.example`.

**Contract — `GET /users/search?q=`** (route name `users.search`, auth): JSON `[{ id, name, email, initials }]`, max 10, case-insensitive match on name/email, excludes the current user; `q` < 2 chars → `[]`.

### Scope
- **In:** `GET /transfers/new` page, user search endpoint, client upload flow, nav entry.
- **Out:** detail page (Phase 5) — after success redirect to `/dashboard` with a toast for now, and switch to the detail page in Phase 5; retries/resume; drag-and-drop polish beyond a basic drop zone.

### Files
- `app/controllers/users_controller.ts` (new) — `search`
- `app/controllers/transfers_controller.ts` — `create` (renders page)
- `start/routes.ts` — `GET /transfers/new` (`transfers.create`), `GET /users/search`
- `inertia/pages/transfers/new.tsx` (new)
- `inertia/components/recipient_picker.tsx` (new)
- `inertia/components/file_upload_list.tsx` (new) — per-file progress + status
- `inertia/lib/upload.ts` (new) — `putWithProgress(url, file, headers, onProgress): Promise<void>`
- `inertia/layouts/app.tsx` — nav entry "New transfer"
- `.env.example` — bucket CORS note
- `tests/functional/users/search.spec.ts` (new)

### Steps
1. Users search endpoint + tests (match by name, by email, excludes self, short query → `[]`, limit 10).
2. Page form: title, message, expiry (date-time, default +7 days), max downloads (optional), password (optional), recipients (picker), files (input + drop zone). Client-side checks mirror the validator (size cap passed as a page prop from `STORAGE_MAX_SINGLE_PUT_BYTES`).
3. Submit flow: `POST /transfers` → upload all files (max 3 concurrent) → `POST /transfers/:id/complete` with the `uploadToken` → `router.visit('/dashboard')` with success toast. On any upload failure show the error and offer "Retry failed" which re-PUTs to the same URL (valid for 1 h); on a 409 from `complete`, mark the listed files failed and offer the same retry. Warn on `beforeunload` while uploads are in progress.
4. Show 422 field errors inline.

### Done when
- [ ] `node ace test functional --files=tests/functional/users/search.spec.ts` passes
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` pass
- [ ] Manual (dev server + real bucket): creating a transfer with two files and one recipient ends with a success toast; DB shows 1 `transfer`, 1 `transfer_recipient` and 2 `transfer_file` rows (the file rows appear only after the `complete` request in the Network tab); both objects exist in the bucket; the Network tab shows file bytes going to the bucket host, not to Share
- [ ] Submitting with no recipients shows an inline error and makes no `POST /transfers` request
- [ ] No changes outside the files listed above

---

## Phase 5 — Transfer access policy and detail page

**Status:** ☐ Not started
**Depends on:** Phase 3

### Goal
`GET /transfers/:id` shows a transfer's details and file list to the creator and recipients only, enforced by a single reusable policy.

### Context
Access rule from the Overview (no status column; "confirmed" = has ≥ 1 `transfer_file` row, written by `complete` in Phase 3):
- `canView` ⇔ creator OR (confirmed AND in `transfer_recipient`). Phase 8 later adds "OR (confirmed AND admin)".
- `canDownload` ⇔ confirmed AND (creator OR in `transfer_recipient`). Never widened to admins.

Non-viewers and soft-deleted transfers → **404**. An unconfirmed transfer is visible only to its creator, with an "Upload not confirmed" notice and no files. Expired transfers remain viewable but marked expired (downloads disabled). Bouncer is not installed; implement as a plain service class.

### Scope
- **In:** `TransferPolicy`, detail page, transformer, redirect from Phase 4 success to this page.
- **Out:** download action (Phase 6 — render the buttons disabled with a `TODO(Phase 6)` comment), delete (Phase 8), list (Phase 7).

### Files
- `app/policies/transfer_policy.ts` (new) — `canView(user, transfer): Promise<boolean>`, `canDownload(user, transfer): Promise<boolean>`, `findViewableOrFail(user, id): Promise<Transfer>` (throws 404)
- `app/models/transfer.ts` — `isConfirmed(): Promise<boolean>` helper or a `confirmed` query scope (`whereExists` on `transfer_file`), used by the policy and lists
- `app/transformers/transfer_transformer.ts` (new) — id, title, message, expiresAt, createdAt, maxDownloads, hasPassword, isExpired, isConfirmed, creator (via `UserTransformer`), files (id, filename, sizeBytes, mimeType), recipients (creator only), successfulDownloads count
- `app/controllers/transfers_controller.ts` — `show`
- `start/routes.ts` — `GET /transfers/:id` (`transfers.show`) with uuid param matcher
- `inertia/pages/transfers/show.tsx` (new)
- `inertia/pages/transfers/new.tsx` — on success visit `transfers.show`
- `tests/unit/transfer_policy.spec.ts` (new)
- `tests/functional/transfers/show.spec.ts` (new)

### Steps
1. Implement the policy with one query (no N+1).
2. `show` uses `findViewableOrFail`, preloads files (active scope on `transfer_file` via `deleted_at IS NULL`), creator; recipients list only when viewer is creator.
3. Page: header (title, creator, expiry, badges for password/expired/download limit), message, file list with sizes (human-readable), recipients section for creator; "Upload not confirmed" notice when `isConfirmed` is false.
4. Tests: confirmed transfer — creator 200, recipient 200 (no recipients list in props), stranger 404; unconfirmed transfer — creator 200 with `isConfirmed: false`, recipient 404; soft-deleted 404; non-uuid id → 404; unit: `canDownload` true for creator/recipient on confirmed, false on unconfirmed, false for stranger.

### Done when
- [ ] `node ace test unit --files=tests/unit/transfer_policy.spec.ts` passes
- [ ] `node ace test functional --files=tests/functional/transfers/show.spec.ts` passes (all HTTP cases above)
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] Manual: after creating a transfer (Phase 4 flow), the browser lands on its detail page
- [ ] No changes outside the files listed above

---

## Phase 6 — Download endpoint with checks and tracking

**Status:** ☐ Not started
**Depends on:** Phase 2, Phase 5

### Goal
Recipients (and the creator) can download a file: the server checks access, expiry, password and download limit, records the attempt in `transfer_download`, and returns a short-lived presigned GET URL.

### Context
Rule: **all download paths require an authenticated user who is the creator or listed in `transfer_recipient`**; the optional password is verified server-side against `password_hash` before any presigned URL is issued. Use `TransferPolicy.findViewableOrFail` + `canDownload` (Phase 5) and `StorageService.presignDownload(key, { filename })` (Phase 2). `canDownload` already requires the transfer to be confirmed, and `transfer_file` rows only exist for objects verified by `complete` (Phase 3), so no storage existence check is needed here. `max_downloads` counts successful rows per transfer (Open question 5). Enforce the limit inside a transaction that locks the transfer row (`SELECT … FOR UPDATE`) so concurrent requests can't exceed it. Record `ip_address` (`request.ip()`), `user_agent`, `success`.

**Contract — `POST /transfers/:id/download/:fileId`** (route name `transfers.download`, auth), JSON body `{ "password": "string | null" }`:
| Case | Status | Body | `transfer_download` row |
|---|---|---|---|
| Not viewable / deleted / file not in transfer | 404 | `{ "error": "not_found" }` | none |
| Viewable but `canDownload` false (admin non-recipient from Phase 8; creator of an unconfirmed transfer) | 403 | `{ "error": "forbidden" }` | none |
| Expired | 410 | `{ "error": "expired" }` | `success=false` |
| Password required and missing/wrong | 403 | `{ "error": "invalid_password" }` | `success=false` |
| Limit reached | 410 | `{ "error": "download_limit_reached" }` | `success=false` |
| OK | 200 | `{ "url": "…", "expiresAt": "ISO" }` | `success=true` |

### Scope
- **In:** `DownloadService.authorize(user, transferId, fileId, password, ctx)`, controller action, route, UI download buttons with password prompt, tests.
- **Out:** rate limiting (Phase 12), zip download, download history UI for creators (Phase 7 shows counts only).

### Files
- `app/services/download_service.ts` (new)
- `app/validators/download.ts` (new)
- `app/controllers/transfers_controller.ts` — `download`
- `start/routes.ts` — download route
- `inertia/pages/transfers/show.tsx` — enable download buttons; password dialog (Base UI Dialog) when `hasPassword`; on 200 navigate `window.location.href = url`; toast for 403/410
- `tests/functional/transfers/download.spec.ts` (new)

### Steps
1. Implement `DownloadService` following the table above; failure rows are written outside the rolled-back path (commit the failure row even when the check fails).
2. Verify passwords with `hash.verify`; never log the password.
3. Controller maps service results to the contract.
4. Tests (with `drive.fake()`): each row of the table; creator can download without being a recipient; `max_downloads=1` → second call 410; concurrency test firing two requests with `max_downloads=1` yields exactly one 200; `ip_address` and `user_agent` recorded.

### Done when
- [ ] `node ace test functional --files=tests/functional/transfers/download.spec.ts` passes (all cases)
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] Manual: as a recipient, clicking a file downloads it with the original filename; a password-protected transfer prompts and rejects a wrong password with a toast
- [ ] No changes outside the files listed above

---

## Milestone C — Widen

## Phase 7 — Transfer list and dashboard

**Status:** ☐ Not started
**Depends on:** Phase 5

### Goal
`GET /transfers` shows two tabs — "Sent" (created by me) and "Received" (I'm a recipient) — and the dashboard shows recent items from both instead of the placeholder.

### Context
There is no status flag; "confirmed" = has ≥ 1 `transfer_file` row (Phase 5's `confirmed` scope). Received = non-deleted, **confirmed** transfers where I'm in `transfer_recipient`. Sent = all my non-deleted transfers, with an "Upload not confirmed" badge on unconfirmed ones. Show expired ones in both tabs with an "Expired" badge. Use `TransferTransformer` (Phase 5) — add a lighter `toListItem` variant if needed. Paginate 20 per page (Lucid `paginate`).

### Scope
- **In:** list endpoint/page with tabs + pagination, dashboard summary (5 latest of each), nav entry "Transfers".
- **Out:** search/filtering, admin "all transfers" view (Phase 8), delete buttons (Phase 8).

### Files
- `app/controllers/transfers_controller.ts` — `index`
- `app/controllers/dashboard_controller.ts` (new) — replaces the `router.on('/dashboard').renderInertia` route
- `app/transformers/transfer_transformer.ts` — list item shape (id, title, creator, expiresAt, isExpired, isConfirmed, fileCount, totalBytes, successfulDownloads)
- `start/routes.ts` — `GET /transfers` (`transfers.index`, `?tab=sent|received&page=`), dashboard route via controller (keep name `dashboard`)
- `inertia/pages/transfers/index.tsx` (new)
- `inertia/pages/dashboard.tsx` — recent sent/received + "New transfer" CTA; keep the empty state when both are empty
- `inertia/layouts/app.tsx` — nav entry "Transfers"
- `tests/functional/transfers/index.spec.ts` (new)
- `tests/functional/smoke.spec.ts` — update dashboard assertion if props change

### Steps
1. Two queries with the right scopes; aggregate file count/bytes and successful downloads with subqueries (no N+1).
2. Page with tabs (Base UI Tabs) and pager links.
3. Dashboard controller passing 5 latest of each.
4. Tests: sent tab shows mine incl. unconfirmed (flagged `isConfirmed: false`), excludes deleted; received shows confirmed non-deleted ones where I'm recipient (expired included, flagged `isExpired`) and never unconfirmed ones; stranger's transfers never appear; pagination returns 20 + meta.

### Done when
- [ ] `node ace test functional --files=tests/functional/transfers/index.spec.ts` passes
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] Manual: dashboard shows the transfer created in Phase 4 under "Sent"; signing in as the recipient shows it under "Received"
- [ ] No changes outside the files listed above

---

## Phase 8 — Roles mirror and soft delete

**Status:** ☐ Not started
**Depends on:** Phase 5, Phase 7

### Goal
Users' IAM role is mirrored locally; creators and admin/superadmin can soft-delete a transfer, and admins can view any confirmed transfer (but still cannot download it unless they are creator/recipient).

### Context
IAM (`../iam/app/services/oauth_service.ts` → `userClaims`) adds a `role` claim to the ID token — the user's IAM role **name** as a string — only when the **`roles` scope** is requested (IAM's supported scopes: `openid profile offline_access entitlements roles`). System roles are `superadmin`, `admin`, `employee`; admins can create custom roles in IAM, so other names are possible. Share treats `admin` and `superadmin` as administrators and every other value (or a missing claim) as a regular employee. Existing sessions get the role on their next sign-in (Phase 9 later refreshes it every few minutes).

Soft delete uses `Transfer#softDelete()` from the `withSoftDeletes` mixin; files' objects are **not** deleted here — the cleanup job (Phase 10) handles bytes. Access rule changes ("confirmed" = has ≥ 1 `transfer_file` row): `canView` also true for admin/superadmin **on confirmed transfers**; new `canDelete` = creator (confirmed or not) OR (admin/superadmin AND confirmed); `canDownload` is **unchanged** (confirmed AND creator or recipient).

**Contract — `DELETE /transfers/:id`** (route name `transfers.destroy`): **204** on success; **404** if not viewable or already deleted; **403** `{ "error": "forbidden" }` if viewable but not allowed to delete (i.e. a plain recipient). The creator can delete an unconfirmed transfer (e.g. after abandoning an upload). From Inertia, use `<Form route="transfers.destroy" method="delete">` and redirect to `transfers.index` with a flash.

### Scope
- **In:** `user.role` column, mirroring in IAM callback, policy changes, delete endpoint, delete button on detail page, admin "All" tab on list.
- **Out:** role management UI, permission-level (`role_permission`) checks, restoring deleted transfers.

### Files
- `database/migrations/1762100006000_add_role_to_user.ts` (new) — `role text NOT NULL DEFAULT 'employee'` (no CHECK: custom IAM role names are allowed)
- `database/schema.ts` — regenerated
- `app/services/iam_client.ts` — add `'roles'` to `SCOPES`; `IamIdentity.role: string` parsed from the `role` claim (non-string/missing → `'employee'`)
- `app/controllers/iam_controller.ts` — include `role` in `User.updateOrCreate`
- `app/models/user.ts` — `get isAdmin()` (`role === 'admin' || role === 'superadmin'`)
- `app/policies/transfer_policy.ts` — admin rule, `canDelete`
- `app/controllers/transfers_controller.ts` — `destroy`; `index` gains `tab=all` for admins (all non-deleted **confirmed** transfers)
- `start/routes.ts` — delete route
- `inertia/pages/transfers/show.tsx` — delete button + confirm dialog when allowed
- `inertia/pages/transfers/index.tsx` — "All" tab for admins
- `tests/unit/iam_client.spec.ts` (new) — role claim parsing
- `tests/functional/transfers/destroy.spec.ts` (new)
- `tests/unit/transfer_policy.spec.ts` — admin cases

### Steps
1. Migration + regenerate schema.
2. Request the `roles` scope; parse `role` in `verifyIdToken` (missing/non-string → `employee`, any other string kept as-is); persist on sign-in.
3. Policy + endpoint + UI.
4. Tests: creator deletes → 204 and `deleted_at` set; creator deletes an unconfirmed transfer → 204; admin deletes someone else's confirmed transfer → 204; admin gets 404 on someone else's unconfirmed transfer; recipient → 403; stranger → 404; deleted transfer disappears from lists and returns 404 on show/download; admin can view any transfer; admin who is not a recipient → download 403 `forbidden`; user with a custom role name is not admin; unit tests for claim parsing and that `authorizeUrl` includes `roles` in `scope`.

### Done when
- [ ] `node ace test functional --files=tests/functional/transfers/destroy.spec.ts` passes
- [ ] `node ace test unit` passes (incl. new admin and claim cases)
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] Manual: signing in through IAM with an admin account stores `role='admin'` in `user` (IAM shows its consent card once more because `roles` is a new scope — expected)
- [ ] No changes outside the files listed above

---

## Phase 9 — Periodic IAM access re-check

**Status:** ☐ Not started
**Depends on:** Phase 8

### Goal
A signed-in user's Share access and role are re-validated against IAM every `IAM_RECHECK_SECONDS` (default 300), so revoking the Share entitlement, banning/deleting the user, or changing their role in IAM takes effect within ~5 minutes. Failures sign the user out (fail closed).

### Context
Facts from the IAM repo (`../iam/app/services/oauth_service.ts`):
- A refresh token is issued only when the `offline_access` scope is granted.
- `refresh()` itself rejects (`invalid_grant`) a deleted/banned user or one whose entitlement for the client's app is disabled, and revokes the grant.
- On success it returns a **new ID token** (fresh `app_access` and `role` via `userClaims`) and a **rotated refresh token**. The old token becomes invalid; **reusing an already-rotated token revokes the whole grant** (replay detection).
- Refresh tokens expire after 30 days unused (`REFRESH_SLIDING_DAYS`) and grants after 90 days absolute (`REFRESH_ABSOLUTE_DAYS`); after that the user simply signs in again (usually silent, since the IAM session and consent are reused).
- IAM revokes a user's grants itself when the Share entitlement is disabled (directory or account settings), the user is suspended/deleted, MFA is reset, or the app is deactivated/deleted (`revokeUserGrants` / `revokeAppGrants`). Share sees all of these as `invalid_grant` on the next refresh. Role changes do **not** revoke grants; the next refresh just carries the new `role`.
- `POST /oauth/revoke` (RFC 7009, client-authenticated like `/oauth/token`) ends the whole grant; it answers 200 even for unknown tokens.
- `/oauth/token` uses the same client authentication for `refresh_token` as for `authorization_code` — reuse the Basic-auth / public-client logic already in `IamClient.exchangeCode`.
- Introspection is not used: it doesn't return `app_access`.

Because of rotation + replay detection, two concurrent requests from one session must never both refresh with the same token. Therefore the refresh token is **not** kept in the cookie session; it lives in a new table and refreshes are serialised with a row lock:

**Table `iam_grant`** (new): `id uuid PK` (random, its id stored in the session as `iam_grant_id`), `user_id uuid FK user`, `refresh_token_encrypted text` (via Adonis `encryption`), `checked_at timestamptz`, `created_at`. One row per signed-in session.

**Middleware `iam_recheck`** (runs after `auth` on every authenticated route):
1. No `iam_grant_id` in session (sessions from before this phase) → sign out and redirect to `/login`.
2. Row's `checked_at` younger than `IAM_RECHECK_SECONDS` → continue.
3. Otherwise, in a transaction, `SELECT … FOR UPDATE SKIP LOCKED` the row. If it's locked, another request is refreshing → continue without refreshing.
4. Call IAM's token endpoint with `grant_type=refresh_token`. On success, verify the new ID token (signature/iss/aud/exp; no nonce on refresh), require `share` in `app_access`, update `user.role` (and name/email/picture), store the rotated token, set `checked_at = now()`, and update the session's `iam_id_token`.
5. On `invalid_grant`, a missing `share` entitlement, or an invalid ID token → delete the row, sign out, flash "Your access to Share has changed. Please sign in again.", and redirect to `/login` (Inertia: `inertia.location`; JSON requests: 401 `{ "error": "session_expired" }`).
6. On a network error or IAM 5xx → fail closed the same way as step 5, but log at `warn` with reason `iam_unreachable`.

### Scope
- **In:** `offline_access` scope, capturing the refresh token at sign-in, `iam_grant` table + model, `IamClient.refresh`, middleware, logout cleanup, tests.
- **Out:** IAM-side changes, back-channel logout, caching entitlement across users.

### Files
- `database/migrations/1762100007000_create_iam_grant_table.ts` (new)
- `database/schema.ts` — regenerated
- `app/models/iam_grant.ts` (new)
- `app/services/iam_client.ts` — add `'offline_access'` to `SCOPES`; `exchangeCode` returns `{ idToken, refreshToken }`; new `refresh(refreshToken): Promise<{ idToken: string; refreshToken: string }>` (throws `IamGrantRevoked` on `invalid_grant`, `IamError` otherwise); new `revoke(refreshToken): Promise<void>` (best-effort, never throws); `verifyIdToken` accepts `nonce: string | null` (skip the nonce check only when `null`)
- `app/controllers/iam_controller.ts` — on sign-in create the `iam_grant` row and put its id in the session; refuse sign-in if no refresh token was issued
- `app/controllers/session_controller.ts` — on logout call `IamClient.revoke(refreshToken)` then delete the `iam_grant` row, before the existing RP-initiated logout redirect
- `app/middleware/iam_recheck_middleware.ts` (new)
- `start/kernel.ts` — register `iamRecheck` named middleware
- `start/routes.ts` — apply it to the `auth` group
- `start/env.ts`, `.env.example`, `.env.test` — `IAM_RECHECK_SECONDS` (number, default 300)
- `tests/unit/iam_client.spec.ts` — `refresh` request shape, null-nonce verification
- `tests/functional/iam_recheck.spec.ts` (new) — stub IAM's token endpoint (e.g. swap `IamClient.refresh` via a container binding or a fake)
- `database/factories/iam_grant_factory.ts` (new) and `tests/helpers/sign_in.ts` (new) — `signIn(request, user)`: creates a fresh `iam_grant` row and applies `.loginAs(user).withSession({ iam_grant_id })`
- `tests/functional/**/*.spec.ts` — replace bare `.loginAs(user)` with the `signIn` helper (otherwise the new middleware signs every test user out). This is the one allowed edit to earlier phases' tests.

### Steps
1. Migration + model + regenerate schema.
2. Extend `IamClient` (scope, exchange return value, `refresh`, nullable nonce).
3. Update the callback to persist the grant; update logout to delete it.
4. Implement the middleware following steps 1–6 above; apply to the `auth` route group.
5. Tests:
   - fresh `checked_at` → no refresh call;
   - stale → refresh called once, token rotated in DB, `checked_at` updated, role change from `employee` to `admin` reflected in `user.role`;
   - IAM returns `invalid_grant` → signed out, redirect to `/login`, row deleted;
   - new ID token lacks `share` in `app_access` → signed out;
   - two concurrent requests with a stale row → refresh called exactly once;
   - session without `iam_grant_id` → signed out;
   - JSON route (`POST /transfers`) with a revoked grant → 401 `session_expired`;
   - logout calls `IamClient.revoke` with the stored token and deletes the row; a failing revoke still logs the user out.

### Done when
- [ ] `node ace test functional --files=tests/functional/iam_recheck.spec.ts` passes (all cases in step 5)
- [ ] `node ace test unit --files=tests/unit/iam_client.spec.ts` passes
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] All earlier functional suites still pass using the `signIn` helper
- [ ] Manual (with local IAM): sign in to Share (consent card lists "Sign you in automatically"), disable the Share entitlement in IAM's directory, wait `IAM_RECHECK_SECONDS` (set to 30 for the test), reload → signed out with the flash message
- [ ] Manual: after logging out of Share, IAM's `oauth_grant` row for that session has `revoked_reason = 'client_revoked'`
- [ ] No changes outside the files listed above

---

## Milestone D — Background work

## Phase 10 — Queue and transfer cleanup

**Status:** ☐ Not started
**Depends on:** Phase 2, Phase 3

### Goal
Expired transfers, abandoned (unconfirmed) uploads, and soft-deleted transfers' bytes are cleaned up automatically and idempotently by a scheduled job.

### Context
Spec: "Expired transfers cleaned by scheduled job (set deleted_at + delete objects)"; bucket lifecycle rules are the safety net. Queue package: see Open question 8 — **if no queue package compatible with `@adonisjs/core` 7 is available, stop and ask.** Cleanup logic lives in a service so it can be run by the job and by an ace command.

"Unconfirmed" = non-deleted transfer with no `transfer_file` rows (see *Transfer availability*). Its uploaded bytes (if any) have no DB rows, so they're removed by **prefix**: `StorageService.deletePrefix('transfers/<id>/')`.

Cleanup rules (in batches of 100):
1. Transfers with `expires_at < now()` and `deleted_at IS NULL` → set `deleted_at`.
2. Unconfirmed transfers with `created_at < now() - 24h` and `deleted_at IS NULL` → set `deleted_at`.
3. For every deleted transfer: `transfer_file` rows with `deleted_at IS NULL` → `StorageService.delete(object_key)` then set the file's `deleted_at`. Keep all DB rows (audit).
4. For every deleted transfer that has **no** `transfer_file` rows (was never confirmed) → `StorageService.deletePrefix('transfers/<id>/')`. Idempotent, so repeating it is harmless; limit to transfers deleted in the last 7 days to bound work.

### Scope
- **In:** queue install/config, `CleanupService`, job, schedule (every 15 min), `node ace transfers:cleanup`, tests.
- **Out:** email (Phase 11), metrics (Phase 12).

### Files
- `package.json`, `adonisrc.ts` — queue package + provider
- `config/queue.ts` (new) — driver per the chosen package (DB/Redis); env vars in `start/env.ts`, `.env.example`, `.env.test` (sync/in-memory in test)
- `app/services/cleanup_service.ts` (new) — `run(): Promise<{ expired: number; abandoned: number; filesDeleted: number; prefixesPurged: number }>`
- `app/jobs/cleanup_transfers_job.ts` (new)
- `start/scheduler.ts` (new) or equivalent per package — schedule the job
- `commands/transfers_cleanup.ts` (new)
- `tests/unit/cleanup_service.spec.ts` (new) — uses test DB + `drive.fake()`
- `package.json` `imports` — add `#jobs/*` if the package needs it

### Steps
1. Install and configure the queue package; document how to run the worker (add a `worker` script to `package.json`).
2. Implement `CleanupService` per the rules; safe to run concurrently (use `FOR UPDATE SKIP LOCKED` or equivalent per batch).
3. Wrap in a job and schedule it; add the ace command.
4. Tests: expired → soft-deleted and objects removed; unexpired confirmed untouched; unconfirmed older than 24 h → soft-deleted and every object under `transfers/<id>/` removed; unconfirmed younger than 24 h untouched; a transfer soft-deleted by a user (Phase 8) has its objects removed; a missing object doesn't fail the run; running twice is a no-op the second time; a `StorageService.delete` failure leaves that file's `deleted_at` NULL so the next run retries.

### Done when
- [ ] `node ace test unit --files=tests/unit/cleanup_service.spec.ts` passes
- [ ] `node ace transfers:cleanup` prints counts and exits 0 on the dev DB
- [ ] Worker starts with the documented command and logs the scheduled job firing
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] No changes outside the files listed above

---

## Phase 11 — Email notification on upload confirmation

**Status:** ☐ Not started
**Depends on:** Phase 10

### Goal
When the creator's upload is first confirmed, each recipient optionally gets an email with the title, sender, expiry and a link to the detail page (never a direct file link).

### Context
Hook point: `TransferService.complete` (Phase 3) returns `firstConfirmation: true` only for the call that actually inserted the `transfer_file` rows (`INSERT … ON CONFLICT (id) DO NOTHING RETURNING id` returned rows). Dispatch the notify job **only** in that case — repeated `complete` calls then never resend, with no queue-specific de-duplication needed. Dispatch after the insert's transaction commits. Email is optional (`MAIL_ENABLED`, Open question 8). Link = `${APP_URL}/transfers/<id>` (requires IAM login).

### Scope
- **In:** `@adonisjs/mail` setup, mail class + template, job, dispatch from `complete`, tests with `mail.fake()`.
- **Out:** user notification preferences, reminders before expiry, download receipts to the creator.

### Files
- `package.json`, `adonisrc.ts`, `config/mail.ts` (new), `start/env.ts`, `.env.example`, `.env.test`
- `app/mails/transfer_received_notification.ts` (new)
- `resources/views/emails/transfer_received.edge` (new)
- `app/jobs/notify_recipients_job.ts` (new)
- `app/services/transfer_service.ts` — dispatch from `complete` when `firstConfirmation` is true
- `tests/functional/transfers/notify.spec.ts` (new)

### Steps
1. Configure mail (SMTP transport, from-address env var).
2. Mail class + template (no password, no presigned URL in the email).
3. Job loads transfer + recipients and sends one mail per recipient.
4. Tests: completing a transfer with 2 recipients queues/sends 2 mails with correct link; a 409 `complete` sends none; completing twice sends exactly 2 mails total (not 4); `MAIL_ENABLED=false` sends none.

### Done when
- [ ] `node ace test functional --files=tests/functional/transfers/notify.spec.ts` passes
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] No changes outside the files listed above

---

## Milestone E — Hardening and delivery

## Phase 12 — Observability and hardening

**Status:** ☐ Not started
**Depends on:** Phase 6, Phase 10

### Goal
Key flows emit structured logs and counters, abuse is rate-limited, and operational requirements (bucket CORS/lifecycle) are documented.

### Context
Spec: structured logs, traces on transfer creation and download resolution, metrics for download success/failure and storage usage; presigned URLs short-lived; fail closed. Logger is pino (`config/logger.ts`). Full OTLP export is out of scope — emit structured log events with stable names so they can be turned into metrics.

### Scope
- **In:** structured log events, rate limits, security headers review, ops docs.
- **Out:** OTLP exporter/tracing SDK, dashboards, alerting.

### Files
- `app/services/transfer_service.ts`, `app/services/download_service.ts`, `app/services/cleanup_service.ts` — log events: `transfer.created`, `transfer.upload_confirmed`, `download.granted`, `download.denied` (with `reason`), `cleanup.run` (with counts), `iam.recheck` (with `outcome`: `ok` / `revoked` / `not_entitled` / `iam_unreachable`). Add the `iam.recheck` call site in `app/middleware/iam_recheck_middleware.ts`. Include ids, never passwords/URLs.
- `package.json`, `config/limiter.ts` (new), `start/limiter.ts` (new) — `@adonisjs/limiter`: download endpoint 30/min per user, create 10/min per user, wrong-password 5 per 15 min per user+transfer
- `start/routes.ts` — apply limiters
- `docs/operations.md` (new) — env vars, bucket CORS (PUT/GET from `APP_URL`), lifecycle rule deleting `transfers/` objects older than 31 days, worker process, migrations command
- `tests/functional/transfers/rate_limit.spec.ts` (new)

### Steps
1. Add log events at the listed points.
2. Install and configure the limiter (memory store in test, DB/Redis in prod per env); apply to routes; 429 JSON `{ "error": "rate_limited" }`.
3. Write `docs/operations.md`.
4. Tests: 6th wrong password within window → 429; log events emitted (spy on logger) for granted/denied downloads.

### Done when
- [ ] `node ace test functional --files=tests/functional/transfers/rate_limit.spec.ts` passes
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` pass
- [ ] `grep -ri "password" ` over new log calls finds no password values logged
- [ ] No changes outside the files listed above

---

## Phase 13 — Container image and CI

**Status:** ☐ Not started
**Depends on:** Phase 12

### Goal
The app builds into a container image that runs the web server or the queue worker, and CI runs lint, typecheck, tests and build on every push.

### Context
Spec: containerized stateless Adonis replicas; migrations run as a CI/CD step; dev/staging/prod with separate DBs and buckets (env-only). `pnpm build` outputs to `build/`; run with `node bin/server.js` from there. Node ≥ 24.

### Scope
- **In:** multi-stage `Dockerfile`, `.dockerignore`, CI workflow with a Postgres service for tests.
- **Out:** deploy pipelines, infrastructure-as-code, secrets provisioning.

### Files
- `Dockerfile` (new) — build stage (`pnpm install --frozen-lockfile`, `pnpm build`), runtime stage (prod deps only, non-root user); `CMD` web, worker via override
- `.dockerignore` (new)
- `.github/workflows/ci.yml` (new) — Postgres service, write `.env.test` from defaults, `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit + functional), `pnpm build`
- `docs/operations.md` — container usage and migration command (`node ace migration:run --connection=postgres_direct --force`)

### Steps
1. Write the Dockerfile and verify locally.
2. Write the CI workflow; browser suite excluded.
3. Document run commands.

### Done when
- [ ] `docker build -t covetdrop .` succeeds
- [ ] `docker run --env-file .env -p 3334:3334 covetdrop` serves `GET /` with 200
- [ ] CI workflow passes on a pushed branch
- [ ] No changes outside the files listed above
