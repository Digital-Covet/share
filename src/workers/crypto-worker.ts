import { encryptChunk } from "@/lib/crypto/encrypt";
import { deriveIV } from "@/lib/crypto/iv";
import { base64UrlToBuffer, importKeyFromBase64Url } from "@/lib/crypto/keys";

export interface WorkerInit {
	type: "init";
	keyBase64Url: string;
	ivBaseBase64Url: string;
	fileId: string;
	totalChunks: number;
}

export interface WorkerEncrypt {
	type: "encrypt";
	index: number;
	chunk: ArrayBuffer;
}

export type WorkerRequest = WorkerInit | WorkerEncrypt;

export type WorkerResponse =
	| { index: number; cipher: ArrayBuffer }
	| { index: number; error: string };

interface Session {
	key: CryptoKey;
	ivBase: Uint8Array;
	fileId: string;
	totalChunks: number;
}

let session: Session | null = null;

const encoder = new TextEncoder();

async function startSession(init: WorkerInit): Promise<void> {
	session = {
		key: await importKeyFromBase64Url(init.keyBase64Url),
		ivBase: new Uint8Array(base64UrlToBuffer(init.ivBaseBase64Url)),
		fileId: init.fileId,
		totalChunks: init.totalChunks,
	};
}

async function encryptAt(index: number, chunk: ArrayBuffer): Promise<ArrayBuffer> {
	if (!session) throw new Error("Crypto session not initialised");
	const aad = encoder.encode(
		JSON.stringify({
			fileId: session.fileId,
			chunkIndex: index,
			totalChunks: session.totalChunks,
		}),
	);
	const cipher = await encryptChunk(
		session.key,
		deriveIV(session.ivBase, index),
		aad,
		new Uint8Array(chunk),
	);
	return cipher.buffer;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;
	if (request.type === "init") {
		await startSession(request);
		return;
	}
	try {
		const cipher = await encryptAt(request.index, request.chunk);
		const response: WorkerResponse = { index: request.index, cipher };
		(self as unknown as Worker).postMessage(response, [cipher]);
	} catch (err) {
		const response: WorkerResponse = {
			index: request.index,
			error: err instanceof Error ? err.message : "Encryption failed",
		};
		(self as unknown as Worker).postMessage(response);
	}
};
