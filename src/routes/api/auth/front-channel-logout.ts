import { prisma } from "@/db/auth";

const IAM_URL = (process.env.IAM_URL ?? "https://iam.digitalcovet.com").replace(
	/\/+$/,
	"",
);

async function processLogoutToken(logoutToken: string): Promise<{ success: boolean; error?: string }> {
	try {
		const parts = logoutToken.split(".");
		if (parts.length !== 3) {
			throw new Error("Invalid JWT format");
		}

		const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

		console.log("[front-channel-logout] Received logout notification:", {
			iss: payload.iss,
			sub: payload.sub,
			sid: payload.sid,
			events: payload.events,
		});

		if (payload.iss !== IAM_URL && payload.iss !== `${IAM_URL}/api/auth`) {
			console.log("[front-channel-logout] Invalid issuer:", payload.iss);
			return { success: false, error: "Invalid issuer" };
		}

		if (payload.sub) {
			const sessions = await prisma.session.findMany({
				where: { userId: payload.sub },
			});

			for (const session of sessions) {
				await prisma.session.delete({
					where: { id: session.id },
				});
				console.log("[front-channel-logout] Deleted session:", session.id);
			}
		}

		if (payload.sid) {
			const session = await prisma.session.findUnique({
				where: { id: payload.sid },
			});
			if (session) {
				await prisma.session.delete({
					where: { id: session.id },
				});
				console.log("[front-channel-logout] Deleted session by sid:", payload.sid);
			}
		}

		return { success: true };
	} catch (error) {
		console.error("[front-channel-logout] Error processing logout:", error);
		return { success: false, error: "Invalid logout token" };
	}
}

export async function POST({ request }: { request: Request }) {
	const contentType = request.headers.get("content-type");
	if (!contentType?.includes("application/x-www-form-urlencoded")) {
		return new Response(JSON.stringify({ error: "Invalid content type" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const body = await request.text();
	const params = new URLSearchParams(body);
	const logoutToken = params.get("logout_token");

	if (!logoutToken) {
		console.log("[front-channel-logout] No logout_token provided");
		return new Response(JSON.stringify({ error: "Missing logout_token" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const result = await processLogoutToken(logoutToken);

	if (!result.success) {
		return new Response(JSON.stringify({ error: result.error }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const logoutToken = url.searchParams.get("logout_token");

	if (!logoutToken) {
		return new Response("Missing logout_token", { status: 400 });
	}

	const result = await processLogoutToken(logoutToken);

	if (!result.success) {
		return new Response(result.error, { status: 400 });
	}

	return new Response("OK", { status: 200 });
}
