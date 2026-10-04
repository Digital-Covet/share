import { AlertOctagon, CheckCircle2 } from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Notice } from "@/lib/dashboard/use-file-dashboard";

const TONE = {
	success: { icon: CheckCircle2, class: "text-status-success" },
	error: { icon: AlertOctagon, class: "text-status-error" },
} as const;

interface NoticeBannerProps {
	notice: Notice | null;
}

export function NoticeBanner(props: NoticeBannerProps) {
	return (
		<div class="fixed right-4 bottom-4 z-50" role="status" aria-live="polite">
			<Show when={props.notice}>
				{(notice) => (
					<p
						class={`flex items-center gap-2 rounded-md border border-border-strong bg-surface px-4 py-3 text-sm shadow-[0_10px_25px_-5px_var(--dc-shadow)] ${TONE[notice().tone].class}`}
					>
						<Dynamic
							component={TONE[notice().tone].icon}
							class="size-[18px]"
							stroke-width={1.75}
							aria-hidden="true"
						/>
						<span class="text-text-main">{notice().message}</span>
					</p>
				)}
			</Show>
		</div>
	);
}
