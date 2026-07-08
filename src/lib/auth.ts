import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/db/auth";

const IAM_URL = (process.env.IAM_URL ?? "https://iam.digitalcovet.com").replace(
	/\/+$/,
	"",
);

const iamJwks = createRemoteJWKSet(new URL(`${IAM_URL}/api/auth/jwks`));

const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
if (!oauthClientSecret) {
	throw new Error(
		"[auth] OAUTH_CLIENT_SECRET is not set — required for the 'share' genericOAuth client",
	);
}

const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
	throw new Error("[auth] BETTER_AUTH_SECRET is not set");
}

const appUrl = (
	process.env.BETTER_AUTH_URL ??
	process.env.VITE_APP_URL ??
	"http://localhost:5173"
).replace(/\/+$/, "");

export const auth = betterAuth({
	secret: authSecret,
	baseURL: appUrl,
	trustedOrigins: [
		"https://iam.digitalcovet.com",
		"https://share.digitalcovet.com",
		"http://localhost:5173",
	],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		cookiePrefix:
			process.env.NODE_ENV === "production"
				? "__Secure-better-auth"
				: "better-auth",
	},
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: "share",
					discoveryUrl: `${IAM_URL}/api/auth/.well-known/openid-configuration`,
					clientId: "share",
					clientSecret: oauthClientSecret,
					scopes: ["openid", "profile", "email"],
					pkce: true,
					redirectURI: `${appUrl}/api/auth/oauth2/callback/share`,
					getUserInfo: async (tokens) => {
						const idToken = tokens.raw?.id_token as string | undefined;

						let userId = "";
						let claimedEmail: string | undefined;
						let claimedName: string | undefined;
						let claimedPicture: string | undefined;

						if (idToken) {
							try {
								const { payload } = await jwtVerify(idToken, iamJwks, {
									issuer: [IAM_URL, `${IAM_URL}/api/auth`],
									audience: ["share", appUrl, `${appUrl}/`],
									clockTolerance: 60,
								});
								userId = (payload.sub as string) ?? (payload.userId as string) ?? "";
								claimedEmail = payload.email as string | undefined;
								claimedName = payload.name as string | undefined;
								claimedPicture = payload.picture as string | undefined;
							} catch (err) {
								console.error("[auth] jwtVerify failed:", err);
							}
						}

						const accessToken = tokens.accessToken ?? (tokens as any).access_token;
						const resp = await fetch(`${IAM_URL}/api/auth/oauth2/userinfo`, {
							headers: { Authorization: `Bearer ${accessToken}` },
						});
						const data = await resp.json();

						if (!userId) {
							userId = data.sub ?? data.userId;
						}

						return {
							id: userId,
							email: claimedEmail ?? (data.email as string),
							name: claimedName ?? (data.name as string),
							image:
								claimedPicture ??
								(data.picture as string | undefined) ??
								undefined,
							emailVerified: true,
						};
					},
				},
			],
		}),
	],
});
