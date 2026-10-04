import type { FileStatus, FileType } from "@/types/dashboard";

export interface TransferSender {
	email: string;
	verified: boolean;
}

export interface InboundTransfer {
	id: string;
	shareLinkId: string;
	name: string;
	type: FileType;
	sizeFormatted: string;
	status: FileStatus;
	expiryTimestamp: number;
	createdTimestamp: number;
	downloads: number;
	sender?: TransferSender;
	fingerprint?: string;
}

export type InboundTab = "unopened" | "all" | "saved";

export interface InboundView {
	query: string;
	tab: InboundTab;
}
