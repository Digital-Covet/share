import { Plus } from "lucide-solid";
import { OUTLINE_BUTTON } from "@/components/ui/button-styles";

interface FilePickerButtonProps {
	label: string;
	disabled?: boolean;
	onFiles: (files: File[]) => void;
}

export function FilePickerButton(props: FilePickerButtonProps) {
	let input: HTMLInputElement | undefined;

	return (
		<>
			<input
				ref={input}
				type="file"
				multiple
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				onChange={(e) => {
					props.onFiles(Array.from(e.currentTarget.files ?? []));
					e.currentTarget.value = "";
				}}
			/>
			<button
				type="button"
				disabled={props.disabled}
				onClick={() => input?.click()}
				class={OUTLINE_BUTTON}
			>
				<Plus class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
				{props.label}
			</button>
		</>
	);
}
