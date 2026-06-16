import { Database, Download, Link } from "lucide-solid";
import { StatCard } from "./StatCard";

interface StatsOverviewProps {
	activeLinks: number;
	totalDownloads: number;
	storageUsedGB: number;
}

export function StatsOverview(props: StatsOverviewProps) {
	return (
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
			<StatCard
				title="Active Links"
				value={props.activeLinks}
				icon={Link}
				gradientFrom="from-primary/5"
				iconColorClass="text-primary"
			/>

			<StatCard
				title="Total Downloads"
				value={props.totalDownloads.toLocaleString()}
				icon={Download}
				gradientFrom="from-secondary/5"
				iconColorClass="text-blue-600"
			/>

			<StatCard
				title="Storage Used"
				value={`${props.storageUsedGB.toFixed(1)} GB`}
				icon={Database}
				gradientFrom="from-error/5"
				iconColorClass="text-error"
			/>
		</div>
	);
}
