import { Search } from "lucide-solid";
import type { Component } from "solid-js";

interface SearchBoxProps {
	value: string;
	onInput: (value: string) => void;
}

export const SearchBox: Component<SearchBoxProps> = (props) => (
	<div class="p-3 lg:p-4">
		<label class="relative block">
			<span class="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
				<Search class="size-4" aria-hidden="true" />
			</span>
			<input
				type="text"
				value={props.value}
				onInput={(e) => props.onInput(e.currentTarget.value)}
				placeholder="Find anything…"
				class="w-full pl-9 pr-3 block h-10 px-4 py-2 text-xs bg-background border border-transparent rounded-lg appearance-none text-muted-foreground duration-300 ring-1 ring-border placeholder:text-muted-foreground focus:border-border focus:bg-transparent focus:outline-none focus:ring-border focus:ring-offset-2 focus:ring-2 sm:text-sm"
			/>
		</label>
	</div>
);
