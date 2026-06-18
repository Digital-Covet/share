export class InvalidLinkError extends Error {
	readonly name = "InvalidLinkError";
	constructor() {
		super("Invalid link");
	}
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(view.byteLength);
	new Uint8Array(buf).set(view);
	return buf;
}

export async function decryptChunk(
	key: CryptoKey,
	iv: Uint8Array,
	aad: Uint8Array,
	cipher: Uint8Array,
): Promise<Uint8Array> {
	try {
		const plain = await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: toArrayBuffer(iv),
				additionalData: toArrayBuffer(aad),
				tagLength: 128,
			},
			key,
			toArrayBuffer(cipher),
		);
		return new Uint8Array(plain);
	} catch {
		throw new InvalidLinkError();
	}
}
