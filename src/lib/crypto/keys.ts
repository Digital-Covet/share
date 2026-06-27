const ALGORITHM: AesKeyGenParams = {
	name: "AES-GCM",
	length: 256,
};

const KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt"];

export async function generateMasterKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(ALGORITHM, true, KEY_USAGES);
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
	const padded = base64url.replaceAll("-", "+").replaceAll("_", "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const binary = padded + "=".repeat(padLen);
	const binaryString = atob(binary);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

export async function exportKeyToBase64Url(key: CryptoKey): Promise<string> {
	const raw = await crypto.subtle.exportKey("raw", key);
	return bufferToBase64Url(raw);
}

export async function importKeyFromBase64Url(
	base64url: string,
): Promise<CryptoKey> {
	const raw = base64UrlToBuffer(base64url);
	return crypto.subtle.importKey("raw", raw, ALGORITHM, true, KEY_USAGES);
}
