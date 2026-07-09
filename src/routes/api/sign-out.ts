import { prisma } from "@/db/auth";
import { auth } from "@/lib/auth";

const IAM_URL = (process.env.IAM_URL ?? "https://iam.digitalcovet.com").replace(
	/\/+$/,
	"",
);

const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "";

const appUrl = (
	process.env.BETTER_AUTH_URL ??
	process.env.VITE_APP_URL ??
	(process.env.NODE_ENV === "production" ? "https://share.digitalcovet.com" : "http://localhost:5173")
).replace(/\/+$/, "");

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

	// Call IAM end-session to log out from the IAM as well (RP-Initiated Logout)
	if (account?.idToken) {
		try {
			const endSessionUrl = new URL(`${IAM_URL}/api/auth/oauth2/end-session`);
			endSessionUrl.searchParams.set("id_token_hint", account.idToken);
			endSessionUrl.searchParams.set("client_id", "share");
			endSessionUrl.searchParams.set("post_logout_redirect_uri", `${appUrl}/auth/login`);

			await fetch(endSessionUrl.toString());
		} catch (err) {
			console.error("[sign-out] Failed to call IAM end-session:", err);
		}
	}

	const signOutResponse = await auth.api.signOut({
		headers,
		asResponse: true,
	});

	const setCookieHeaders: string[] = [];
	for (const [key, value] of signOutResponse.headers.entries()) {
		if (key.toLowerCase() === "set-cookie") {
			setCookieHeaders.push(value);
		}
	}

	const response = new Response(null, { status: 200 });
	for (const header of setCookieHeaders) {
		response.headers.append("Set-Cookie", header);
	}

	return response;
}
