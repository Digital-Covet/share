import type { LucideIcon } from "lucide-solid";

export interface FileItem {
	name: string;
	icon: LucideIcon;
	iconClass: string;
	type: string;
	size: string;
	receivedDate: string;
}
