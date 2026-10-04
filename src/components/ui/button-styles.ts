const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const PRIMARY_BUTTON = `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const OUTLINE_BUTTON = `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-main hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const TEXT_INPUT =
	"min-h-[44px] w-full rounded-md border border-border bg-surface px-3 text-sm text-text-main placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";
