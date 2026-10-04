import type { FileItem } from "@/types/dashboard";
import { STATUS_PRESENTATION, type StatusFilter } from "./status";

export type SortKey = "expiry" | "created" | "size";

export interface FileViewOptions {
	query: string;
	status: StatusFilter;
	sort: SortKey;
}

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
	{ value: "expiry", label: "Expiry Date" },
	{ value: "created", label: "Created Date" },
	{ value: "size", label: "Size" },
];

const SORT_COMPARATORS: Record<SortKey, (a: FileItem, b: FileItem) => number> = {
	expiry: (a, b) => a.expiryTimestamp - b.expiryTimestamp,
	created: (a, b) => b.createdTimestamp - a.createdTimestamp,
	size: (a, b) => b.sizeBytes - a.sizeBytes,
};

function matchesQuery(file: FileItem, query: string): boolean {
	if (!query) return true;
	const needle = query.toLowerCase();
	return (
		file.name.toLowerCase().includes(needle) ||
		file.id.toLowerCase().includes(needle) ||
		(file.shareLinkId?.toLowerCase().includes(needle) ?? false)
	);
}

function matchesStatus(file: FileItem, status: StatusFilter): boolean {
	return status === "all" || STATUS_PRESENTATION[file.status].filter === status;
}

export function applyFileView(
	files: FileItem[],
	{ query, status, sort }: FileViewOptions,
): FileItem[] {
	return files
		.filter((f) => matchesStatus(f, status) && matchesQuery(f, query.trim()))
		.sort(SORT_COMPARATORS[sort]);
}
