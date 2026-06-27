function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(view.byteLength);
	new Uint8Array(buf).set(view);
	return buf;
}

export async function encryptChunk(
	key: CryptoKey,
	iv: Uint8Array,
	aad: Uint8Array,
	plain: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
	const cipher = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: toArrayBuffer(iv),
			additionalData: toArrayBuffer(aad),
			tagLength: 128,
		},
		key,
		toArrayBuffer(plain),
	);
	return new Uint8Array(cipher);
}
