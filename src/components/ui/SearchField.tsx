import { Search } from "lucide-solid";

interface SearchFieldProps {
	value: string;
	label: string;
	placeholder: string;
	onInput: (next: string) => void;
}

export function SearchField(props: SearchFieldProps) {
	return (
		<label class="relative block w-full lg:max-w-md">
			<span class="sr-only">{props.label}</span>
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-text-muted"
				stroke-width={1.75}
				aria-hidden="true"
			/>
			<input
				type="search"
				value={props.value}
				onInput={(e) => props.onInput(e.currentTarget.value)}
				placeholder={props.placeholder}
				class="min-h-[44px] w-full rounded-md border border-border bg-surface py-2 pr-3 pl-10 text-sm text-text-main placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
			/>
		</label>
	);
}
