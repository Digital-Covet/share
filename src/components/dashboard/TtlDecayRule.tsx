interface TtlDecayRuleProps {
	ratio: number;
	low: boolean;
}

export function TtlDecayRule(props: TtlDecayRuleProps) {
	return (
		<div class="ttl-rule-track relative mt-1 h-0.5 w-full" aria-hidden="true">
			<div
				class="absolute inset-y-0 left-0 transition-[width] duration-(--duration-normal) ease-(--ease-sharp)"
				classList={{
					"bg-primary": !props.low,
					"bg-status-warning": props.low,
				}}
				style={{ width: `${Math.round(props.ratio * 100)}%` }}
			/>
		</div>
	);
}
