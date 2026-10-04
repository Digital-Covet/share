import { Copy, Trash2 } from "lucide-solid";
import { STATUS_PRESENTATION } from "@/lib/dashboard/status";
import type { FileItem } from "@/types/dashboard";
import { EditExpiryPopover } from "./EditExpiryPopover";

const ICON_BUTTON =
	"flex size-9 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

export interface FileActionHandlers {
	onCopy: (file: FileItem) => void;
	onSaveExpiry: (file: FileItem, expiresAt: number) => Promise<void>;
	onRevoke: (file: FileItem) => void;
}

interface FileActionsProps extends FileActionHandlers {
	file: FileItem;
}

export function FileActions(props: FileActionsProps) {
	const live = () => STATUS_PRESENTATION[props.file.status].live;
	const revoked = () => STATUS_PRESENTATION[props.file.status].filter === "revoked";

	return (
		<div class="flex items-center gap-1">
			<button
				type="button"
				aria-label={`Copy link for ${props.file.name}`}
				disabled={!live() || !props.file.shareLinkId}
				onClick={() => props.onCopy(props.file)}
				class={ICON_BUTTON}
			>
				<Copy class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
			</button>
			{!revoked() && (
				<EditExpiryPopover file={props.file} onSave={props.onSaveExpiry} />
			)}
			<button
				type="button"
				aria-label={`Revoke ${props.file.name}`}
				disabled={revoked()}
				onClick={() => props.onRevoke(props.file)}
				class={`${ICON_BUTTON} hover:text-status-error`}
			>
				<Trash2 class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
			</button>
		</div>
	);
}
