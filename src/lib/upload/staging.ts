import { MAX_FILE_SIZE } from "@/lib/constants";
import { createZip } from "@/lib/compression";
import type { StagedFile } from "@/types/upload";

export const ZIP_CAP_BYTES = Math.floor(1.5 * 1024 * 1024 * 1024);
export const BUNDLE_NAME = "files.zip";

const ZIP_MIME = "application/zip";
const FALLBACK_MIME = "application/octet-stream";

export interface StagingTotals {
	count: number;
	bytes: number;
	outputName: string;
}

export interface UploadPayload {
	blob: Blob;
	fileName: string;
	mimeType: string;
}

export function stageFiles(incoming: File[]): StagedFile[] {
	return incoming.map((file) => ({ id: crypto.randomUUID(), file }));
}

export function stagingTotals(staged: StagedFile[]): StagingTotals {
	const bytes = staged.reduce((sum, { file }) => sum + file.size, 0);
	const outputName = staged.length > 1 ? BUNDLE_NAME : (staged[0]?.file.name ?? "");
	return { count: staged.length, bytes, outputName };
}

export function stagingError(staged: StagedFile[]): string | null {
	const { count, bytes } = stagingTotals(staged);
	if (staged.some(({ file }) => file.size === 0)) return "Empty files cannot be encrypted.";
	if (count > 1 && bytes > ZIP_CAP_BYTES) {
		return "Bundles over 1.5 GB cannot be zipped in the browser. Zip them locally or send fewer files.";
	}
	if (bytes > MAX_FILE_SIZE) return "Transfers are limited to 9.9 GB.";
	return null;
}

function uniqueEntryName(name: string, taken: Set<string>): string {
	if (!taken.has(name)) return name;
	const dot = name.lastIndexOf(".");
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : "";
	let n = 2;
	while (taken.has(`${stem} (${n})${ext}`)) n++;
	return `${stem} (${n})${ext}`;
}

async function bundleFiles(staged: StagedFile[]): Promise<UploadPayload> {
	const taken = new Set<string>();
	const entries = await Promise.all(
		staged.map(async ({ file }) => ({
			name: file.name,
			data: new Uint8Array(await file.arrayBuffer()),
		})),
	);
	const unique = entries.map((entry) => {
		const name = uniqueEntryName(entry.name, taken);
		taken.add(name);
		return { ...entry, name };
	});
	const archive = await createZip(unique);
	return {
		blob: new Blob([archive as BlobPart], { type: ZIP_MIME }),
		fileName: BUNDLE_NAME,
		mimeType: ZIP_MIME,
	};
}

export async function buildPayload(staged: StagedFile[]): Promise<UploadPayload> {
	if (staged.length > 1) return bundleFiles(staged);
	const [{ file }] = staged;
	return {
		blob: file,
		fileName: file.name,
		mimeType: file.type || FALLBACK_MIME,
	};
}
