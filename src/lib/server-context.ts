import { getRequestEvent } from "solid-js/web";

export interface ServerContext {
	user: null;
	ipHash: string;
}

const EMPTY: ServerContext = { user: null, ipHash: "" };

export function getServerContext(): ServerContext {
	const event = getRequestEvent();
	if (!event) return EMPTY;

	return {
		user: null,
		ipHash: (event.locals.ipHash as string) ?? "",
	};
}
