import { FileArchive, Files, HardDrive } from "lucide-solid";
import { IconSpan } from "./IconSpan";

export const FileInfoPanel = () => (
	<div class="mb-6 flex items-start gap-4 rounded-xl border border-border bg-background p-5 shadow-inner">
		<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
			<IconSpan icon={FileArchive} class="text-primary" />
		</div>

		<div class="min-w-0 flex-1">
			<h3
				class="mb-1 truncate font-heading text-lg font-semibold"
				title="Q3_Marketing_Assets.zip"
			>
				Q3_Marketing_Assets.zip
			</h3>

			<div class="flex items-center gap-3 text-xs text-muted-foreground">
				<span class="flex items-center gap-1">
					<IconSpan icon={Files} class="h-[14px] w-[14px]" />
					Contains 14 files
				</span>

				<span class="h-1 w-1 rounded-full bg-border" />

				<span class="flex items-center gap-1">
					<IconSpan icon={HardDrive} class="h-[14px] w-[14px]" />
					2.1 GB
				</span>
			</div>
		</div>
	</div>
);
