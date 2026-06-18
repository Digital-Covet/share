import type { FileStatus } from "@/types/dashboard";

interface ShareLinkFields {
	status: "ACTIVE" | "REVOKED";
	expiresAt: Date | null;
	consumedAt: Date | null;
	downloadCount: number;
	maxDownloads: number | null;
	isOneTime: boolean;
}

export function deriveShareLinkStatus(
	link: ShareLinkFields,
	now = new Date(),
): FileStatus {
	if (link.status === "REVOKED") return "Revoked";

	if (link.expiresAt && link.expiresAt < now) return "Expired";

	if (link.consumedAt !== null) return "Consumed";
	if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads)
		return "Consumed";

	if (link.isOneTime) return "One-Time";

	if (link.downloadCount === 0) return "Pending";

	return "Active";
}
