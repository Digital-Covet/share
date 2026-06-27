import { getRequestEvent } from "solid-js/web";
import type { AuthUser } from "@/types/auth";

export interface ServerContext {
	user: AuthUser | null;
	ipHash: string;
}

const EMPTY: ServerContext = { user: null, ipHash: "" };

export function getServerContext(): ServerContext {
	const event = getRequestEvent();
	if (!event) return EMPTY;

	return {
		user: (event.locals.user as AuthUser | null) ?? null,
		ipHash: (event.locals.ipHash as string) ?? "",
	};
}
