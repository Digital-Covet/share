export const APP_DOMAIN =
	import.meta.env.VITE_APP_URL ?? "http://localhost:3000";
export const WORK_EMAIL_DOMAIN = "@digitalcovet.com";
export const SUPPORT_EMAIL = "support@digitalcovet.com";
export const COMPANY_NAME = "Digital Covet";

// File expiration: default 7 days for anonymous uploads.
// NULL means "never expire" — only for authenticated internal uploads.
export const DEFAULT_FILE_EXPIRATION_DAYS = 7;

// Presigned URL TTL in seconds — applied to all S3 signed URLs (upload, resume, download).
export const PRESIGN_EXPIRES = 60;

// Upload session inactivity: cron aborts sessions idle longer than this.
export const UPLOAD_SESSION_INACTIVITY_HOURS = 24;

// Maximum file size: 9.9 GB in bytes
export const MAX_FILE_SIZE = Math.floor(9.9 * 1024 * 1024 * 1024);

export const ROUTES = {
	LOGIN: "/auth/login",
	DASHBOARD: "/dashboard",
	UPLOAD: "/upload",
	RECIEVE: "/recieve",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
