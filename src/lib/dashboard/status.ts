import {
	AlertOctagon,
	AlertTriangle,
	CheckCircle2,
	Clock,
	FileArchive,
	FileImage,
	FileSpreadsheet,
	FileText,
	ShieldAlert,
} from "lucide-solid";
import type { FileStatus, FileType } from "@/types/dashboard";

export type StatusFilter = "all" | "active" | "consumed" | "expired" | "revoked";

interface StatusPresentation {
	label: string;
	icon: typeof CheckCircle2;
	textClass: string;
	filter: Exclude<StatusFilter, "all">;
	live: boolean;
}

export const STATUS_PRESENTATION: Record<FileStatus, StatusPresentation> = {
	Active: {
		label: "ACTIVE",
		icon: CheckCircle2,
		textClass: "text-status-success",
		filter: "active",
		live: true,
	},
	"One-Time": {
		label: "ONE-TIME",
		icon: ShieldAlert,
		textClass: "text-status-info",
		filter: "active",
		live: true,
	},
	Pending: {
		label: "PENDING",
		icon: Clock,
		textClass: "text-status-info",
		filter: "active",
		live: true,
	},
	Consumed: {
		label: "CONSUMED",
		icon: AlertTriangle,
		textClass: "text-status-warning",
		filter: "consumed",
		live: false,
	},
	Expired: {
		label: "EXPIRED",
		icon: AlertTriangle,
		textClass: "text-status-warning",
		filter: "expired",
		live: false,
	},
	Revoked: {
		label: "REVOKED",
		icon: AlertOctagon,
		textClass: "text-status-error",
		filter: "revoked",
		live: false,
	},
	Deleted: {
		label: "REVOKED",
		icon: AlertOctagon,
		textClass: "text-status-error",
		filter: "revoked",
		live: false,
	},
};

export const FILE_TYPE_ICON: Record<FileType, typeof FileText> = {
	pdf: FileText,
	zip: FileArchive,
	document: FileText,
	image: FileImage,
	spreadsheet: FileSpreadsheet,
};
