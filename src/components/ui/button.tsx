import { type JSX, splitProps } from "solid-js";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
	size?: "sm" | "md" | "lg" | "icon";
}

export function Button(props: ButtonProps) {
	const [local, other] = splitProps(props, [
		"class",
		"variant",
		"size",
		"children",
	]);

	const baseStyles =
		"inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none select-none";

	const variants = {
		primary:
			"bg-primary text-primary-foreground hover:bg-opacity-90 active:scale-[0.98]",
		secondary:
			"bg-secondary text-secondary-foreground hover:bg-opacity-90 active:scale-[0.98]",
		outline:
			"border border-outline-variant hover:border-outline text-on-surface hover:bg-surface-container-high",
		ghost:
			"text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high",
		danger:
			"bg-destructive text-destructive-foreground hover:bg-opacity-90 active:scale-[0.98]",
	};

	const sizes = {
		sm: "px-3 py-1.5 text-xs",
		md: "px-4 py-2 text-sm",
		lg: "px-5 py-2.5 text-base",
		icon: "p-1.5 text-sm rounded-md",
	};

	const variantClass = variants[local.variant || "outline"];
	const sizeClass = sizes[local.size || "md"];

	return (
		<button
			class={`${baseStyles} ${variantClass} ${sizeClass} ${local.class || ""}`}
			{...other}
		>
			{local.children}
		</button>
	);
}
