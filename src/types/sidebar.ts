export interface NavItemConfig {
	label: string;
	icon: string; // lucide icon name
	href?: string;
	onClick?: () => void;
}
