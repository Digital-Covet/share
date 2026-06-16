import { CircleCheck, X } from "lucide-solid";
import { Show } from "solid-js";

interface ToastProps {
	message: string;
	isOpen: boolean;
	onClose: () => void;
}

export function Toast(props: ToastProps) {
	return (
		<Show when={props.isOpen}>
			<div
				class="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-secondary text-secondary-foreground px-4 py-3 rounded-xl shadow-lg border border-secondary/20 max-w-sm animate-slideInRight"
				role="alert"
			>
				<div class="shrink-0 text-secondary-foreground">
					<CircleCheck size={18} />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium leading-normal">{props.message}</p>
				</div>
				<button
					onClick={() => props.onClose()}
					class="text-secondary-foreground/80 hover:text-secondary-foreground p-1 rounded transition-colors shrink-0"
					aria-label="Close notification"
				>
					<X size={14} />
				</button>
			</div>
		</Show>
	);
}
