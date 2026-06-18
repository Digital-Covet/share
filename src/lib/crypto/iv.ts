const IV_BYTE_LENGTH = 12;
const COUNTER_BYTES = 4;

export function deriveIV(ivBase: Uint8Array, n: number): Uint8Array {
	if (ivBase.length !== IV_BYTE_LENGTH) {
		throw new Error(`ivBase must be exactly ${IV_BYTE_LENGTH} bytes`);
	}

	const iv = new Uint8Array(ivBase);
	const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
	const counter = view.getUint32(IV_BYTE_LENGTH - COUNTER_BYTES) + n;
	view.setUint32(IV_BYTE_LENGTH - COUNTER_BYTES, counter >>> 0);
	return iv;
}

export async function hashIVBase(ivBase: Uint8Array): Promise<string> {
	const buf = new ArrayBuffer(ivBase.byteLength);
	new Uint8Array(buf).set(ivBase);
	const hash = await crypto.subtle.digest("SHA-256", buf);
	const bytes = new Uint8Array(hash);
	let hex = "";
	for (const byte of bytes) {
		hex += byte.toString(16).padStart(2, "0");
	}
	return hex;
}
