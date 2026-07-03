import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  baseURL: {
    allowedHosts: ["share.digitalcovet.com", "localhost:5173"],
    protocol: process.env.NODE_ENV === "production" ? "https" : "http",
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "share",
          discoveryUrl:
            "https://iam.digitalcovet.com/.well-known/openid-configuration",
          clientId: "share",
          clientSecret: process.env.OAUTH_CLIENT_SECRET ?? "",
          scopes: ["openid", "profile", "email"],
          getUserInfo: async (tokens) => {
            const resp = await fetch("https://iam.digitalcovet.com/userinfo", {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            const data = await resp.json();

            const idToken = tokens.raw?.id_token as string | undefined;
            let userId: string;

            if (idToken) {
              const payload = JSON.parse(
                Buffer.from(idToken.split(".")[1], "base64url").toString(),
              );
              userId = payload.sub ?? payload.userId;
            } else {
              userId = data.sub ?? data.userId;
            }

            return {
              id: userId,
              email: data.email as string,
              name: data.name as string,
              image: (data.picture as string | undefined) ?? null,
            };
          },
        },
      ],
    }),
  ],
});
