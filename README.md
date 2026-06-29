# Digital Covet – Secure File Sharing Platform

Digital Covet is a production‑grade, end‑to‑end encrypted file‑sharing platform built for teams and individuals who need to transfer sensitive data securely. Files are encrypted client‑side before upload, compressed, and stored in Cloudflare R2 with zero‑knowledge architecture. The platform provides fine‑grained access control, expiring share links, download limits, and comprehensive audit logging.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [How It Works](#how-it-works)
- [Encryption Details](#encryption-details)
- [API Reference](#api-reference)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)
- [Browser Compatibility](#browser-compatibility)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Support](#support)
- [License](#license)

## Features

### Core Capabilities

- **End‑to‑End Encryption** – AES‑GCM encryption with per‑chunk IVs; encryption keys never leave the client.
- **Chunked Multipart Uploads** – Supports large files via resumable chunked uploads with presigned R2 URLs.
- **Client‑Side Compression** – Automatic ZIP compression for multi‑file uploads using `fflate`.
- **Secure Share Links** – Expiring links, one‑time downloads, password‑protected shares, and download‑count limits.
- **Dashboard & Management** – Real‑time stats, file table with search/filter/sort, expiry editing, and revocation.

### Authentication & Authorization

- **Email/Password Auth** – Secure email/password authentication with mandatory email verification.
- **Two‑Factor Authentication** – TOTP‑based 2FA with backup codes and device trust.
- **Role‑Based Access Control** – Three roles: superadmin, admin, employee with granular permissions.
- **Admin Plugin** – User management, invitation system, and permission‑based access control.
- **Email OTP & Verification** – Email‑based OTP for sign‑in, email verification, and password resets via Zeptomail.

### File Management

- **Chunked Download Pipeline** – Efficient server‑side decryption and streaming for large files.
- **Cron‑Based Expiry** – Automated cleanup of expired files and upload sessions.
- **Reporting System** – File abuse reporting with reason categories and admin review workflow.
- **User Preferences** – Configurable default expiration, download limits, and notification settings.

### User Interface

- **Responsive UI** – Modern, accessible interface built with SolidJS and Tailwind CSS v4.
- **Dark Mode Ready** – CSS custom properties for theme customization.
- **Real‑Time Updates** – Optimistic UI updates with server validation.
- **Type‑Safe Stack** – Full TypeScript coverage with Zod validation schemas.

## Tech Stack

| Category | Technology | Version | Purpose |
| --- | --- | --- | --- |
| **Framework** | SolidStart | 2.0.0‑alpha.2 | Full‑stack meta‑framework with SSR/CSR |
| **UI Library** | SolidJS | ^1.9.5 | Reactive UI components |
| **Styling** | Tailwind CSS | ^4.3.0 | Utility‑first CSS framework |
| **ORM** | Prisma | ^7.8.0 | Type‑safe database access |
| **Database** | PostgreSQL (Supabase) | – | Relational database |
| **Authentication** | Better Auth | ^1.6.18 | Auth framework with plugins |
| **Object Storage** | Cloudflare R2 | – | S3‑compatible object storage |
| **AWS SDK** | @aws-sdk/client‑s3 | ^3.1069.0 | R2 client integration |
| **Presigner** | @aws‑sdk/s3‑request‑presigner | ^3.1069.0 | Generate presigned URLs |
| **Compression** | fflate | ^0.8.3 | Fast ZIP compression/extraction |
| **Email Service** | Zeptomail | ^8.0.1 | Transactional email delivery |
| **Icons** | Lucide Solid | ^1.17.0 | Icon library |
| **UI Components** | Ark UI Solid | ^5.37.0 | Headless UI components |
| **Validation** | Zod | ^4.4.3 | Schema validation |
| **Build Tool** | Vite | ^7.0.0 | Build tooling |
| **Linting** | Biome | 2.4.16 | Fast formatter/linter |
| **Node.js** | – | ≥22 | Runtime |
| **Package Manager** | pnpm | – | Fast package manager |

## Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** (recommended package manager)
- **PostgreSQL database** (Supabase or local instance)
- **Cloudflare R2 bucket** (S3‑compatible storage)
- **Zeptomail account** (transactional email service)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/send-digital-covet-file-sharing.git
cd send-digital-covet-file-sharing

# Install dependencies
pnpm install

# Copy environment variables template
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with the following variables:

| Variable | Description | Required | Example |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth session encryption | ✅ | `your-super-secret-key-min-32-chars` |
| `DATABASE_AUTH_URL` | PostgreSQL connection URL for auth schema | ✅ | `postgresql://user:pass@host:6543/auth?pgbouncer=true` |
| `DATABASE_PROJECT_URL` | PostgreSQL connection URL for project schema | ✅ | `postgresql://user:pass@host:6543/project?pgbouncer=true` |
| `DIRECT_AUTH_URL` | Direct connection URL for migrations (auth) | ✅ | `postgresql://user:pass@host:5432/auth` |
| `DIRECT_PROJECT_URL` | Direct connection URL for migrations (project) | ✅ | `postgresql://user:pass@host:5432/project` |
| `VITE_APP_URL` | Application base URL | ✅ | `http://localhost:5173` |
| `CLOUDFLARE_ACCESS_KEY` | R2 access key ID | ✅ | `your-access-key` |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | R2 secret access key | ✅ | `your-secret-key` |
| `CLOUDFLARE_ENDPOINT_URL` | R2 endpoint URL | ✅ | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | R2 bucket name | ✅ | `your-bucket-name` |
| `ZEPTOMAIL_URL` | Zeptomail API endpoint | ✅ | `https://api.zeptomail.in/v1.1/email` |
| `ZEPTOMAIL_TOKEN` | Zeptomail API token | ✅ | `your-zeptomail-token` |
| `ZEPTOMAIL_SENDER_ADDRESS` | Verified sender email | ✅ | `noreply@yourdomain.com` |

### Database Setup

The project uses two separate Prisma schemas for authentication and project data:

```bash
# Generate both Prisma clients
pnpm run generate

# Run auth schema migrations (users, sessions, 2FA, invitations)
pnpm run migrate:auth

# Run project schema migrations (files, share links, upload sessions)
pnpm run migrate:project
```

**Schema Overview:**

- **auth.prisma** – User management, sessions, accounts, two‑factor authentication, invitations
- **project.prisma** – File metadata, upload sessions, share links, reports, user preferences

## Development

### Start Development Server

```bash
pnpm run dev
```

The application will be available at `http://localhost:5173`.

### Available Scripts

| Script | Description |
| --- | --- |
| `pnpm run dev` | Start Vite development server with HMR |
| `pnpm run build` | Generate Prisma clients and build for production |
| `pnpm run start` | Start production server |
| `pnpm run preview` | Preview production build locally |
| `pnpm run format` | Format code with Biome |
| `pnpm run lint` | Lint and auto‑fix code with Biome |
| `pnpm run generate` | Generate both Prisma clients |
| `pnpm run generate:auth` | Generate auth Prisma client only |
| `pnpm run generate:project` | Generate project Prisma client only |
| `pnpm run migrate:auth` | Run auth schema migrations |
| `pnpm run migrate:project` | Run project schema migrations |
| `pnpm run deploy:auth` | Deploy auth migrations to production |
| `pnpm run deploy:project` | Deploy project migrations to production |

## Project Structure

```
send-digital-covet-file-sharing/
├── prisma/
│   ├── auth.prisma              # Auth schema definition
│   ├── project.prisma           # Project schema definition
│   └── migrations/              # Database migration files
├── src/
│   ├── components/
│   │   ├── auth/                # Authentication components
│   │   │   ├── auth-guard.tsx   # Route protection component
│   │   │   └── ...
│   │   ├── dashboard/           # Dashboard UI components
│   │   │   ├── DashboardHeader.tsx
│   │   │   ├── FileTable.tsx
│   │   │   ├── StatOverview.tsx
│   │   │   ├── EditExpiryModal.tsx
│   │   │   ├── DeleteConfirmModal.tsx
│   │   │   └── Toast.tsx
│   │   ├── recieve/             # File receive UI components
│   │   │   ├── RecieveHeader.tsx
│   │   │   ├── RecieveToolbar.tsx
│   │   │   ├── ExtractedFiles.tsx
│   │   │   ├── FileInfoPanel.tsx
│   │   │   └── ActionButton.tsx
│   │   ├── sidebar/             # Navigation sidebar
│   │   │   └── Sidebar.tsx
│   │   └── upload/              # Secure upload UI
│   │       ├── SecureUpload.tsx # Main upload orchestrator
│   │       ├── DropZone.tsx     # File selection area
│   │       ├── SettingsPanel.tsx# Security settings
│   │       ├── UploadProgress.tsx
│   │       └── UploadSuccess.tsx
│   ├── db/
│   │   ├── auth.ts              # Auth Prisma client
│   │   └── project.ts           # Project Prisma client
│   ├── lib/
│   │   ├── api/                 # API utilities
│   │   │   ├── url.ts           # API URL helper
│   │   │   └── ...
│   │   ├── crypto/              # Client‑side encryption
│   │   │   ├── encrypt.ts       # AES‑GCM encryption
│   │   │   ├── decrypt.ts       # Decryption logic
│   │   │   ├── keys.ts          # Key generation/derivation
│   │   │   ├── iv.ts            # IV derivation
│   │   │   └── password.ts      # Password hashing
│   │   ├── download/            # Server‑side download pipeline
│   │   │   ├── pipeline.ts      # Download orchestration
│   │   │   ├── mse-controller.ts# Media Source Extensions
│   │   │   └── ...
│   │   ├── auth.ts              # Better Auth server config
│   │   ├── auth-client.ts       # Better Auth client config
│   │   ├── compression.ts       # ZIP compression/extraction
│   │   ├── constants.ts         # App constants
│   │   ├── permissions.ts       # RBAC definitions
│   │   ├── share-link.ts        # Share link status logic
│   │   └── rate-limit.ts        # Rate limiting
│   ├── routes/
│   │   ├── api/                 # Server API routes
│   │   │   ├── auth/            # Better Auth API routes
│   │   │   ├── files/           # File management endpoints
│   │   │   ├── share-links.ts   # Share link management
│   │   │   ├── shared/          # Shared files listing
│   │   │   └── cron/            # Scheduled tasks
│   │   ├── auth/                # Auth pages
│   │   │   ├── login.tsx
│   │   │   ├── forgot-password.tsx
│   │   │   ├── reset-password.tsx
│   │   │   └── verify-2fa.tsx
│   │   ├── s/[fileId]/          # Public share link pages
│   │   ├── dashboard.tsx        # Dashboard page
│   │   ├── upload.tsx           # Upload page
│   │   ├── recieve.tsx          # Receive files page
│   │   └── index.tsx            # Root redirect
│   ├── server/                  # Server‑only utilities
│   ├── services/                # External services
│   │   ├── email.ts             # Email sending service
│   │   └── email-templates.ts   # Email templates
│   ├── types/                   # TypeScript definitions
│   │   ├── dashboard.ts
│   │   ├── recieve.ts
│   │   └── upload.ts
│   └── utils/                   # Shared utilities
├── public/                      # Static assets
├── .env.local                   # Environment variables (git‑ignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture Overview

The application follows a client‑server architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  SolidJS UI  │  │  Encryption  │  │  Compression     │ │
│  │  Components  │  │  Module      │  │  (fflate)        │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SolidStart Server                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  API Routes  │  │  Auth        │  │  File Management │ │
│  │  (SSR/CSR)   │  │  (Better Auth)│  │  (Prisma)       │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare R2                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Encrypted   │  │  Multipart   │  │  Presigned URLs  │ │
│  │  Files       │  │  Uploads     │  │  (Temporary)     │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Supabase)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Auth Schema │  │  Project     │  │  User            │ │
│  │  (Users,     │  │  Schema      │  │  Preferences     │ │
│  │  Sessions)   │  │  (Files,     │  │                  │ │
│  │              │  │  Links)      │  │                  │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Upload Flow

1. **File Selection** – User selects files via drag‑and‑drop or file picker.
2. **Compression** – Multiple files are automatically zipped using `fflate`.
3. **Key Generation** – Client generates a master AES‑GCM key and random IV base.
4. **Encryption** – File is split into 5MB chunks; each chunk is encrypted with a derived IV.
5. **Upload Initiation** – Client calls `/api/files/initiate-upload` with metadata and encryption key.
6. **Presigned URLs** – Server creates R2 multipart upload and returns presigned URLs.
7. **Chunk Upload** – Encrypted chunks are uploaded directly to R2 via presigned URLs.
8. **Finalization** – Client calls complete endpoint; server finalizes upload and creates share link.
9. **Share Link** – Server returns share link ID; client can copy/share the link.

### Download Flow

1. **Share Link Access** – Recipient visits `/s/{shareLinkId}`.
2. **Link Validation** – Server checks link status, expiry, download limits, and password.
3. **Presigned Download** – Server generates presigned GET URL for the encrypted file.
4. **Client‑Side Decryption** – Browser downloads encrypted chunks and decrypts using stored key.
5. **File Reconstruction** – Decrypted chunks are assembled and streamed to the user.

### Share Link Lifecycle

Share links can be in one of the following statuses:

| Status | Description |
| --- | --- |
| **Pending** | Created but never downloaded |
| **Active** | Available for download |
| **One‑Time** | Will be consumed after first download |
| **Consumed** | Download limit reached or one‑time link used |
| **Expired** | Past expiration date |
| **Revoked** | Manually revoked by owner |
| **Deleted** | File permanently deleted |

## Encryption Details

### Algorithm Specifications

- **Algorithm**: AES‑256‑GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 96 bits (12 bytes) per chunk
- **Chunk Size**: 5MB (5,242,880 bytes)
- **AAD**: JSON‑encoded `{ fileId, chunkIndex, totalChunks }`

### Key Derivation

1. **Master Key Generation**:
   ```typescript
   const masterKey = await crypto.subtle.generateKey(
     { name: "AES-GCM", length: 256 },
     true,
     ["encrypt", "decrypt"]
   );
   ```

2. **IV Derivation** (per chunk):
   ```typescript
   function deriveIV(ivBase: Uint8Array, chunkIndex: number): Uint8Array {
     const iv = new Uint8Array(12);
     iv.set(ivBase);
     const view = new DataView(iv.buffer);
     view.setUint32(8, chunkIndex, true); // Little‑endian chunk index
     return iv;
   }
   ```

3. **Key Export** (for storage):
   ```typescript
   const rawKey = await crypto.subtle.exportKey("raw", masterKey);
   const keyBase64Url = bufferToBase64Url(rawKey);
   ```

### Security Properties

- **Confidentiality** – Files are encrypted with AES‑256‑GCM.
- **Integrity** – GCM mode provides authentication tags to detect tampering.
- **Non‑Replay** – Unique IVs prevent replay attacks across chunks.
- **Forward Secrecy** – Each file uses a unique master key.
- **Zero‑Knowledge** – Server never sees plaintext files or encryption keys.

## API Reference

### Authentication Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/sign‑in/email` | Sign in with email/password |
| POST | `/api/auth/sign‑up/email` | Register new account |
| POST | `/api/auth/sign‑out` | Sign out current session |
| POST | `/api/auth/send‑verification‑otp` | Send OTP for verification |
| POST | `/api/auth/verify‑email` | Verify email address |
| POST | `/api/auth/forgot‑password` | Request password reset |
| POST | `/api/auth/reset‑password` | Reset password with token |
| POST | `/api/auth/two‑factor/enable` | Enable 2FA |
| POST | `/api/auth/two‑factor/verify‑otp` | Verify 2FA OTP |
| POST | `/api/auth/two‑factor/verify‑totp` | Verify 2FA TOTP |
| POST | `/api/auth/admin/invite` | Invite new user (admin) |

### File Management Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/files` | List user’s files with stats |
| POST | `/api/files/initiate-upload` | Initialize upload and get presigned URLs |
| GET | `/api/files/resume-upload?fileId=&parts=` | Refresh expired presigned URLs |
| POST | `/api/files/complete-upload` | Complete multipart upload |
| POST | `/api/files/finalize` | Finalize single‑part upload |
| POST | `/api/files/:id/update-expiry` | Update expiration settings |
| POST | `/api/files/:id/delete` | Revoke and delete file |
| GET | `/api/files/:id/download` | Get download URL |

### Share Link Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/shared` | List files shared with current user |
| GET | `/api/share-links` | List share links for user’s files |
| POST | `/api/share-links` | Create new share link |
| PATCH | `/api/share-links/:id` | Update share link settings |
| DELETE | `/api/share-links/:id` | Revoke share link |

### Cron Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/cron/cleanup` | Clean up expired files and sessions |
| GET | `/api/cron/abort-stale-uploads` | Abort inactive upload sessions |

## Security Model

### Encryption Architecture

- **Zero‑Knowledge** – Encryption keys are generated client‑side and never transmitted to the server.
- **AES‑256‑GCM** – Authenticated encryption with associated data (AEAD).
- **Per‑Chunk IVs** – Each chunk uses a unique IV derived from a base IV and chunk index.
- **Key Derivation** – Master key is generated using `crypto.subtle.generateKey()`.
- **AAD Binding** – Additional authenticated data includes file ID, chunk index, and total chunks.

### Authentication Security

- **Password Hashing** – Bcrypt with configurable rounds via Better Auth.
- **Session Management** – Token‑based sessions with IP and user‑agent tracking.
- **2FA** – TOTP‑based two‑factor authentication with encrypted backup codes.
- **Email Verification** – Mandatory for all new accounts.
- **Rate Limiting** – Applied to authentication endpoints to prevent brute‑force attacks.
- **CSRF Protection** – Built‑in CSRF protection via Better Auth.

### Data Protection

- **Encrypted Storage** – All files stored in R2 are encrypted at rest.
- **Secure Transmission** – HTTPS enforced in production.
- **Audit Logging** – File access, downloads, and modifications are logged.
- **Data Isolation** – Separate databases for auth and project data.

## Performance Considerations

### Upload Optimization

- **Chunked Uploads** – 5MB chunks balance memory usage and request overhead.
- **Parallel Uploads** – Multiple chunks can be uploaded concurrently.
- **Presigned URL Refresh** – Automatic refresh of expiring presigned URLs during long uploads.
- **Client‑Side Compression** – Reduces upload size by 30‑70% for text‑heavy files.

### Download Optimization

- **Streaming Decryption** – Files are decrypted in chunks to avoid loading entire file into memory.
- **Range Requests** – Support for partial content downloads.
- **CDN Caching** – Cloudflare R2 provides global edge caching.
- **Browser Caching** – Proper cache headers for static assets.

### Database Optimization

- **Connection Pooling** – Supabase provides connection pooling for PostgreSQL.
- **Indexed Queries** – Strategic indexes on frequently queried columns.
- **Separate Schemas** – Auth and project data are isolated for better performance.
- **Prepared Statements** – Prisma generates optimized queries.

## Browser Compatibility

### Requirements

- **Web Crypto API** – Required for client‑side encryption.
- **Service Workers** – Optional for offline support.
- **Fetch API** – Required for API communication.
- **ES2022+** – Modern JavaScript features.

### Supported Browsers

| Browser | Minimum Version | Notes |
| --- | --- | --- |
| Chrome | 100+ | Full support |
| Firefox | 100+ | Full support |
| Safari | 16+ | Full support |
| Edge | 100+ | Full support |
| Mobile Chrome | 100+ | Full support |
| Mobile Safari | 16+ | Full support |

### Known Limitations

- **IE11** – Not supported (no Web Crypto API).
- **Older Mobile Browsers** – May have limited Web Crypto support.
- **Private Browsing** – Some features may be limited in private/incognito mode.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel.
2. Set all environment variables in the Vercel dashboard.
3. Vercel auto‑detects SolidStart and deploys with appropriate build settings.

**Build Command:**
```bash
prisma generate --schema=prisma/auth.prisma && prisma generate --schema=prisma/project.prisma && vite build
```

**Output Directory:** `.output/public`

**Install Command:**
```bash
pnpm install
```

### Cloudflare Workers

Add the Cloudflare adapter to `app.config.ts`:

```typescript
import { defineConfig } from "@solidjs/start/config";
import nitro from "@solidjs/vite-plugin-nitro-2";

export default defineConfig({
  plugins: [nitro({ preset: "cloudflare" })],
});
```

### Production Checklist

- [ ] Set all environment variables
- [ ] Run database migrations (`pnpm run deploy:auth && pnpm run deploy:project`)
- [ ] Configure CORS for your domain
- [ ] Set up monitoring and alerting
- [ ] Enable Cloudflare R2 bucket versioning
- [ ] Configure email templates in Zeptomail
- [ ] Set up automated backups
- [ ] Configure SSL certificates
- [ ] Set up domain and DNS
- [ ] Enable rate limiting in production

## Contributing

### Development Workflow

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my‑feature`.
3. Make your changes and ensure they follow the project’s code style.
4. Run linting and formatting: `pnpm run lint && pnpm run format`.
5. Test your changes thoroughly.
6. Commit your changes: `git commit -m 'Add my feature'`.
7. Push to the branch: `git push origin feature/my‑feature`.
8. Open a Pull Request with a clear description of your changes.

### Code Style

- Follow the existing code conventions.
- Use TypeScript for all new code.
- Write self‑documenting code with clear variable names.
- Add comments only for complex business logic.
- Ensure all functions have proper type annotations.

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix.
- Include screenshots for UI changes.
- Update documentation if needed.
- Ensure all checks pass before requesting review.

## Acknowledgements

- **SolidJS** – Reactive JavaScript framework for building user interfaces.
- **Prisma** – Next‑generation ORM for TypeScript and Node.js.
- **Better Auth** – Modern authentication framework for TypeScript.
- **Cloudflare R2** – S3‑compatible object storage with zero egress fees.
- **Tailwind CSS** – Utility‑first CSS framework.
- **fflate** – Fast and small JavaScript zlib/DEFLATE/gzip/inflate/deflate implementation.
- **Zeptomail** – Transactional email service for developers.

## Support

- **Documentation** – Check this README and inline code comments.
- **Issues** – Report bugs or request features via GitHub Issues.
- **Discussions** – Join community discussions on GitHub Discussions.
- **Security** – Report security vulnerabilities responsibly via email.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Built with SolidJS, Prisma, Better Auth, Tailwind CSS, and Cloudflare R2.