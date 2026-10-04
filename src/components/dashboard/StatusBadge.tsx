import { Dynamic } from "solid-js/web";
import { STATUS_PRESENTATION } from "@/lib/dashboard/status";
import type { FileStatus } from "@/types/dashboard";

interface StatusBadgeProps {
	status: FileStatus;
	label?: string;
}

export function StatusBadge(props: StatusBadgeProps) {
	const presentation = () => STATUS_PRESENTATION[props.status];

	return (
		<span
			class={`inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] ${presentation().textClass}`}
		>
			<Dynamic
				component={presentation().icon}
				class="size-3.5"
				stroke-width={1.75}
				aria-hidden="true"
			/>
			{props.label ?? presentation().label}
		</span>
	);
}
