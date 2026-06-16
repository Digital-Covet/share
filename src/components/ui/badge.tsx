import { type JSX, splitProps } from "solid-js";
import type { FileStatus } from "@/types/dashboard";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
	status: FileStatus | string;
}

export function Badge(props: BadgeProps) {
	const [local, other] = splitProps(props, ["status", "class", "children"]);

	const getStatusStyles = (status: string) => {
		switch (status) {
			case "Active":
				return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
			case "One-Time":
				return "bg-tertiary/10 text-tertiary border border-tertiary/20";
			case "Pending":
				return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
			case "Expired":
				return "bg-error/10 text-error border border-error/20";
			default:
				return "bg-muted text-muted-foreground border border-border";
		}
	};

	return (
		<span
			class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${getStatusStyles(local.status)} ${local.class || ""}`}
			{...other}
		>
			{local.children || local.status}
		</span>
	);
}
