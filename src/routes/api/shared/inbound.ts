import { requireUser } from "@/lib/auth.server";

// The schema has no recipient field yet, so nothing can be addressed to a user.
export async function GET({ request }: { request: Request }) {
	await requireUser(request);
	return Response.json({ transfers: [] });
}
