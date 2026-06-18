const MAX_MULTIPART_PARTS = 10_000;
const PART_PADDING = 5;

export function r2FileKey(userId: string, fileId: string): string {
	return `files/${userId}/${fileId}`;
}

export function r2PartKey(
	userId: string,
	fileId: string,
	partNumber: number,
): string {
	if (partNumber < 1 || partNumber > MAX_MULTIPART_PARTS) {
		throw new RangeError(
			`partNumber must be 1–${MAX_MULTIPART_PARTS}, got ${partNumber}`,
		);
	}
	const padded = String(partNumber).padStart(PART_PADDING, "0");
	return `files/${userId}/${fileId}/part-${padded}`;
}
