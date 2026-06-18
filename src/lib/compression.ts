import { AsyncDeflate, AsyncInflate } from "fflate";

export const COMPRESS_CHUNK_SIZE = 5 * 1024 * 1024;

function collectStream(
	stream: AsyncDeflate | AsyncInflate,
): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		const parts: Uint8Array[] = [];
		let totalLen = 0;

		stream.ondata = (err, data, fin) => {
			if (err) {
				reject(err);
				return;
			}
			parts.push(data);
			totalLen += data.length;
			if (fin) {
				const out = new Uint8Array(totalLen);
				let offset = 0;
				for (const part of parts) {
					out.set(part, offset);
					offset += part.length;
				}
				resolve(out);
			}
		};
	});
}

export async function compressChunk(chunk: Uint8Array): Promise<Uint8Array> {
	const stream = new AsyncDeflate({ level: 6, mem: 8 });
	const result = collectStream(stream);
	stream.push(chunk, true);
	return result;
}

export async function decompressChunk(chunk: Uint8Array): Promise<Uint8Array> {
	const stream = new AsyncInflate();
	const result = collectStream(stream);
	stream.push(chunk, true);
	return result;
}
