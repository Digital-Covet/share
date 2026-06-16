import type { Component } from "solid-js";
import { IconSpan } from "./IconSpan";
import { Download } from "lucide-solid";

interface RecieveHeaderProps {
	fileCount: number;
}

export const RecieveHeader: Component<RecieveHeaderProps> = (props) => {
	return (
		<div class="mb-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
					<IconSpan icon={Download} class="h-5 w-5 text-primary" />
				</div>
				<div>
					<h1 class="font-heading text-2xl font-bold tracking-tight">
						Received Files
					</h1>
					<p class="text-sm text-muted-foreground">
						{props.fileCount} files from encrypted transfer
					</p>
				</div>
			</div>
		</div>
	);
};
