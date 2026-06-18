import {
	Download,
	FileText,
	Folder,
	LayoutDashboard,
	Upload,
} from "lucide-solid";

export const iconMap = {
	Download,
	FileText,
	Folder,
	LayoutDashboard,
	Upload,
} as const;

export type IconName = keyof typeof iconMap;

export function getIcon(name: string) {
	return iconMap[name as IconName] ?? FileText;
}
