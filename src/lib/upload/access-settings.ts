import type { AccessSettings, SecuritySettings } from "@/types/upload";

export const DOWNLOAD_LIMIT_MIN = 1;
export const DOWNLOAD_LIMIT_MAX = 100;

export const DEFAULT_ACCESS_SETTINGS: AccessSettings = {
	expiration: "24h",
	customExpiration: "",
	downloadLimit: 1,
	password: { enabled: false, value: "" },
};

export function accessError(settings: AccessSettings): string | null {
	if (settings.expiration === "custom") {
		const at = Date.parse(settings.customExpiration);
		if (Number.isNaN(at) || at <= Date.now()) return "Choose a custom expiry in the future.";
	}
	if (settings.password.enabled && settings.password.value.length === 0) {
		return "Enter a passphrase or turn passphrase protection off.";
	}
	return null;
}

export function toSecuritySettings(settings: AccessSettings): SecuritySettings {
	return {
		expiration: settings.expiration,
		customExpirationDate:
			settings.expiration === "custom"
				? new Date(settings.customExpiration).toISOString()
				: undefined,
		oneTimeDownload: settings.downloadLimit === 1,
		maxDownloads: settings.downloadLimit,
	};
}

export function passphraseOf(settings: AccessSettings): string | null {
	return settings.password.enabled ? settings.password.value : null;
}
