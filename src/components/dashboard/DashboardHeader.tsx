import { Collapsible } from "@ark-ui/solid/collapsible";
import { ArrowUpDown, Filter, RotateCcw, Search } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Button } from "../ui/button";

interface DashboardHeaderProps {
	searchTerm: string;
	setSearchTerm: (val: string) => void;
	statusFilter: string;
	setStatusFilter: (val: string) => void;
	sortField: string;
	setSortField: (val: string) => void;
	sortDirection: "asc" | "desc";
	setSortDirection: (val: "asc" | "desc") => void;
	onResetFilters: () => void;
}

export function DashboardHeader(props: DashboardHeaderProps) {
	const [showFilters, setShowFilters] = createSignal(false);
	const [showSort, setShowSort] = createSignal(false);

	const statuses = ["All", "Active", "One-Time", "Pending", "Expired"];
	const sortOptions = [
		{ label: "File Name", value: "name" },
		{ label: "Size", value: "size" },
		{ label: "Downloads", value: "downloads" },
		{ label: "Expiry Date", value: "expiry" },
	];

	return (
		<div class="flex flex-col gap-6 mb-8">
			{/* Title & Actions Section */}
			<div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h2 class="text-3xl font-bold font-heading text-on-surface mb-2 tracking-tight">
						My Files
					</h2>
					<p class="text-sm text-on-surface-variant font-sans">
						Manage and monitor your secure transfers.
					</p>
				</div>

				<div class="flex gap-3">
					<Button
						variant={showFilters() ? "primary" : "outline"}
						class="flex items-center gap-2"
						onClick={() => setShowFilters(!showFilters())}
						aria-label="Toggle Filters"
					>
						<Filter size={16} />
						Filter
						{props.searchTerm || props.statusFilter !== "All" ? (
							<span class="w-2 h-2 rounded-full bg-foreground inline-block"></span>
						) : null}
					</Button>

					<Button
						variant={showSort() ? "primary" : "outline"}
						class="flex items-center gap-2"
						onClick={() => setShowSort(!showSort())}
						aria-label="Toggle Sorting"
					>
						<ArrowUpDown size={16} />
						Sort
					</Button>

					<Show
						when={
							props.searchTerm ||
							props.statusFilter !== "All" ||
							props.sortField !== "name" ||
							props.sortDirection !== "asc"
						}
					>
						<Button
							variant="ghost"
							class="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"
							onClick={() => props.onResetFilters()}
							aria-label="Reset Filters"
						>
							<RotateCcw size={14} />
							Reset
						</Button>
					</Show>
				</div>
			</div>

			{/* Filter Options Panel */}
			<Collapsible.Root open={showFilters()}>
				<Collapsible.Content>
					<div class="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-md">
						<div class="w-full md:w-auto flex-1 max-w-md">
							<label class="block text-label text-on-surface-variant mb-2">
								Search files
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
									<Search size={16} />
								</span>
								<input
									type="text"
									placeholder="Search by file name..."
									value={props.searchTerm}
									onInput={(e) => props.setSearchTerm(e.currentTarget.value)}
									class="w-full bg-background border border-outline-variant focus:border-outline rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
								/>
							</div>
						</div>

						<div class="w-full md:w-auto">
							<label class="block text-label text-on-surface-variant mb-2">
								Filter by Status
							</label>
							<div class="flex flex-wrap gap-1.5 bg-background p-1 rounded-lg border border-outline-variant">
								{statuses.map((status) => (
									<button
										onClick={() => props.setStatusFilter(status)}
										class={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
											props.statusFilter === status
												? "bg-primary text-primary-foreground"
												: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
										}`}
									>
										{status}
									</button>
								))}
							</div>
						</div>
					</div>
				</Collapsible.Content>
			</Collapsible.Root>

			{/* Sort Options Panel */}
			<Collapsible.Root open={showSort()}>
				<Collapsible.Content>
					<div class="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-md">
						<div class="w-full md:w-auto flex flex-col md:flex-row gap-4 items-start md:items-center">
							<div>
								<label class="block text-label text-on-surface-variant mb-2">
									Sort by Field
								</label>
								<div class="flex flex-wrap gap-1.5 bg-background p-1 rounded-lg border border-outline-variant">
									{sortOptions.map((opt) => (
										<button
											onClick={() => props.setSortField(opt.value)}
											class={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
												props.sortField === opt.value
													? "bg-primary text-primary-foreground"
													: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
											}`}
										>
											{opt.label}
										</button>
									))}
								</div>
							</div>

							<div>
								<label class="block text-label text-on-surface-variant mb-2">
									Direction
								</label>
								<div class="flex bg-background p-1 rounded-lg border border-outline-variant">
									<button
										onClick={() => props.setSortDirection("asc")}
										class={`px-3 py-1 text-xs font-medium rounded-l-md transition-colors ${
											props.sortDirection === "asc"
												? "bg-primary text-primary-foreground"
												: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
										}`}
									>
										Ascending
									</button>
									<button
										onClick={() => props.setSortDirection("desc")}
										class={`px-3 py-1 text-xs font-medium rounded-r-md transition-colors ${
											props.sortDirection === "desc"
												? "bg-primary text-primary-foreground"
												: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
										}`}
									>
										Descending
									</button>
								</div>
							</div>
						</div>
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	);
}
