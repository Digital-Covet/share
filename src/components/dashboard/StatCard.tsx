import { splitProps } from "solid-js";

interface StatCardProps {
	title: string;
	value: string | number;
	icon: any; // Type as any to accommodate Lucide component types without SVG property errors
	gradientFrom: string;
	iconColorClass: string;
}

export function StatCard(props: StatCardProps) {
	const [local] = splitProps(props, [
		"title",
		"value",
		"icon",
		"gradientFrom",
		"iconColorClass",
	]);

	return (
		<div class="bg-surface-container-low border border-outline-variant rounded-xl p-6 flex flex-col justify-between h-32 relative overflow-hidden group transition-all duration-300 hover:border-outline shadow-sm">
			{/* Dynamic gradient overlay */}
			<div
				class={`absolute inset-0 bg-gradient-to-br ${local.gradientFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
			/>

			<div class="flex justify-between items-start relative z-10">
				<span class="text-xs uppercase tracking-wider font-medium text-on-surface-variant font-sans">
					{local.title}
				</span>
				<div class={local.iconColorClass}>
					{/* Instantiate Lucide component with standard sizes */}
					<local.icon size={20} strokeWidth={2} />
				</div>
			</div>

			<div class="flex items-baseline gap-1 relative z-10">
				<span class="text-3xl font-bold tracking-tight text-on-surface font-heading">
					{local.value}
				</span>
			</div>
		</div>
	);
}
