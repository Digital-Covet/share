export const APP_DOMAIN =
	import.meta.env.VITE_APP_URL ?? "http://localhost:3000";
export const WORK_EMAIL_DOMAIN = "@digitalcovet.com";
export const SUPPORT_EMAIL = "support@digitalcovet.com";
export const COMPANY_NAME = "Digital Covet";
export const INVITATION_EXPIRY_DAYS = 7;

export const ROUTES = {
	LOGIN: "/auth/login",
	FORGOT_PASSWORD: "/auth/forgot-password",
	RESET_PASSWORD: "/auth/reset-password",
	SETUP_PASSWORD: "/auth/setup-password",
	SETUP_2FA: "/auth/setup-2fa",
	VERIFY_2FA: "/auth/verify-2fa",
	DASHBOARD: "/dashboard",
	UPLOAD: "/upload",
	RECIEVE: "/recieve",
} as const;

export function buildInviteUrl(token: string): string {
	return `${APP_DOMAIN}${ROUTES.SETUP_PASSWORD}?token=${token}`;
}

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
