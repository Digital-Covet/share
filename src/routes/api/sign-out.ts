import { prisma } from "@/db/auth";
import { auth } from "@/lib/auth";

const IAM_URL = (process.env.IAM_URL ?? "https://iam.digitalcovet.com").replace(
	/\/+$/,
	"",
);

const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "";

export async function POST({ request }: { request: Request }) {
	const headers = new Headers(request.headers);

	const sessionResult = await auth.api.getSession({ headers });
	if (!sessionResult?.session) {
		return new Response(JSON.stringify({ error: "Not authenticated" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const account = await prisma.account.findFirst({
		where: {
			userId: sessionResult.session.userId,
			providerId: "share",
		},
	});

	if (account?.refreshToken) {
		try {
			await fetch(`${IAM_URL}/api/auth/oauth2/revoke`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					token: account.refreshToken,
					token_type_hint: "refresh_token",
					client_id: "share",
					client_secret: OAUTH_CLIENT_SECRET,
				}),
			});
		} catch (err) {
			console.error("[sign-out] Failed to revoke IAM tokens:", err);
		}
	}

	const { response } = await auth.api.signOut({
		headers,
		returnHeaders: true,
	});

	return response;
}
