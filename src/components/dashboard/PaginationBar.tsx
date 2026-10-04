import { ChevronLeft, ChevronRight } from "lucide-solid";

export interface PageWindow {
	page: number;
	pageSize: number;
	total: number;
}

interface PaginationBarProps {
	window: PageWindow;
	onPageChange: (page: number) => void;
}

const PAGE_BUTTON =
	"flex size-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-text-main hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

export function PaginationBar(props: PaginationBarProps) {
	const first = () =>
		props.window.total === 0 ? 0 : (props.window.page - 1) * props.window.pageSize + 1;
	const last = () =>
		Math.min(props.window.page * props.window.pageSize, props.window.total);
	const pageCount = () => Math.max(1, Math.ceil(props.window.total / props.window.pageSize));

	return (
		<div class="flex items-center justify-between py-3">
			<p class="font-mono text-xs text-text-muted">
				Showing {first()}–{last()} of {props.window.total} files
			</p>
			<div class="flex items-center gap-2">
				<button
					type="button"
					aria-label="Previous page"
					disabled={props.window.page <= 1}
					onClick={() => props.onPageChange(props.window.page - 1)}
					class={PAGE_BUTTON}
				>
					<ChevronLeft class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
				</button>
				<span class="font-mono text-xs text-text-main">
					{props.window.page} / {pageCount()}
				</span>
				<button
					type="button"
					aria-label="Next page"
					disabled={props.window.page >= pageCount()}
					onClick={() => props.onPageChange(props.window.page + 1)}
					class={PAGE_BUTTON}
				>
					<ChevronRight class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}
