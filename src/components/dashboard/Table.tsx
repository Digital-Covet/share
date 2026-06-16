import { type JSX, type ParentProps, splitProps } from "solid-js";

export function TableContainer(
	props: ParentProps<JSX.HTMLAttributes<HTMLDivElement>>,
) {
	const [local, other] = splitProps(props, ["children", "class"]);
	return (
		<div
			class={`w-full overflow-hidden bg-surface-container-low border border-outline-variant rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${local.class || ""}`}
			{...other}
		>
			{local.children}
		</div>
	);
}

export function TableHeader(
	props: ParentProps<JSX.HTMLAttributes<HTMLDivElement>>,
) {
	const [local, other] = splitProps(props, ["children", "class"]);
	return (
		<div
			class={`hidden md:grid grid-cols-12 gap-4 py-4 px-6 border-b border-outline-variant bg-surface-container-low text-xs font-semibold uppercase tracking-wider text-on-surface-variant ${local.class || ""}`}
			role="rowgroup"
			{...other}
		>
			{local.children}
		</div>
	);
}

export function TableRow(
	props: ParentProps<
		JSX.HTMLAttributes<HTMLDivElement> & { isExpired?: boolean }
	>,
) {
	const [local, other] = splitProps(props, ["children", "class", "isExpired"]);
	return (
		<div
			class={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 py-4 px-6 border-b border-outline-variant/50 hover:bg-secondary transition-colors items-center group ${local.isExpired ? "opacity-60" : ""} ${local.class || ""}`}
			role="row"
			{...other}
		>
			{local.children}
		</div>
	);
}

export function TableCell(
	props: ParentProps<
		JSX.HTMLAttributes<HTMLDivElement> & {
			colSpan?: number;
			align?: "left" | "right" | "center";
		}
	>,
) {
	const [local, other] = splitProps(props, [
		"children",
		"class",
		"colSpan",
		"align",
	]);

	// Custom flex alignments
	const alignment = () => {
		if (local.align === "right") return "justify-end text-right";
		if (local.align === "center") return "justify-center text-center";
		return "justify-start text-left";
	};

	// Map colSpan to Tailwind grid column spans for desktop
	const spanClass = () => {
		switch (local.colSpan) {
			case 1:
				return "md:col-span-1";
			case 2:
				return "md:col-span-2";
			case 3:
				return "md:col-span-3";
			case 4:
				return "md:col-span-4";
			case 5:
				return "md:col-span-5";
			case 6:
				return "md:col-span-6";
			case 12:
				return "md:col-span-12";
			default:
				return "md:col-span-2"; // default span
		}
	};

	return (
		<div
			class={`flex items-center w-full ${alignment()} ${spanClass()} text-sm font-sans text-on-surface-variant ${local.class || ""}`}
			role="cell"
			{...other}
		>
			{local.children}
		</div>
	);
}
