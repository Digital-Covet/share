import type { JSX, ParentProps } from "solid-js";

interface VaultNotchCardProps {
	notch?: number;
	class?: string;
	onDragOver?: JSX.EventHandler<HTMLDivElement, DragEvent>;
	onDragLeave?: JSX.EventHandler<HTMLDivElement, DragEvent>;
	onDrop?: JSX.EventHandler<HTMLDivElement, DragEvent>;
}

export function VaultNotchCard(props: ParentProps<VaultNotchCardProps>) {
	return (
		<div
			class={`vault-notch relative border border-border bg-surface ${props.class ?? ""}`}
			style={{ "--notch": `${props.notch ?? 12}px` }}
			onDragOver={props.onDragOver}
			onDragLeave={props.onDragLeave}
			onDrop={props.onDrop}
		>
			<span
				class="vault-notch-tick pointer-events-none absolute top-0 right-0"
				aria-hidden="true"
			/>
			{props.children}
		</div>
	);
}
