import type { FileItem } from "@/types/dashboard";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const EXPIRING_SOON_MS = HOUR_MS;
const LOW_TTL_RATIO = 0.1;

type TtlWindow = Pick<FileItem, "expiryTimestamp" | "createdTimestamp">;

function hasExpiry(file: TtlWindow): boolean {
	return file.expiryTimestamp > 0;
}

export function remainingMs(file: TtlWindow, now: number): number {
	return Math.max(0, file.expiryTimestamp - now);
}

export function formatRemaining(file: TtlWindow, now: number): string {
	if (!hasExpiry(file)) return "No expiry";

	const ms = remainingMs(file, now);
	if (ms === 0) return "0h 0m";

	const days = Math.floor(ms / DAY_MS);
	const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
	const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);

	return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}

export function remainingRatio(file: TtlWindow, now: number): number {
	if (!hasExpiry(file)) return 1;

	const total = file.expiryTimestamp - file.createdTimestamp;
	if (total <= 0) return 0;

	return Math.min(1, remainingMs(file, now) / total);
}

export function isExpiringSoon(file: TtlWindow, now: number): boolean {
	const ms = remainingMs(file, now);
	return hasExpiry(file) && ms > 0 && ms < EXPIRING_SOON_MS;
}

export function isTtlLow(file: TtlWindow, now: number): boolean {
	return hasExpiry(file) && remainingRatio(file, now) < LOW_TTL_RATIO;
}
