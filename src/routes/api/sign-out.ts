import { Effect, Redacted } from "effect";
import { auth } from "@/lib/auth";
import { AppSettings, type AppSettingsShape } from "@/server/effect/config";
import { useAuthDatabase } from "@/server/effect/auth-database";
import { Unauthorized } from "@/server/effect/errors";
import { effectRoute } from "@/server/effect/route";

const CLIENT_ID = "share";

interface IamAccount {
  readonly refreshToken: string | null;
  readonly idToken: string | null;
}

const revokeRefreshToken = (options: { settings: AppSettingsShape; refreshToken: string }) =>
  Effect.tryPromise(() =>
    fetch(`${options.settings.iamUrl}/api/auth/oauth2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: options.refreshToken,
        token_type_hint: "refresh_token",
        client_id: CLIENT_ID,
        client_secret: options.settings.oauthClientSecret
          ? Redacted.value(options.settings.oauthClientSecret)
          : "",
      }),
    }),
  ).pipe(
    Effect.catch((cause) => Effect.logError("[sign-out] Failed to revoke IAM tokens", cause)),
  );

// RP-Initiated Logout: ends the session at the IAM as well.
const endIamSession = (options: { settings: AppSettingsShape; idToken: string }) => {
  const url = new URL(`${options.settings.iamUrl}/api/auth/oauth2/end-session`);
  url.searchParams.set("id_token_hint", options.idToken);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("post_logout_redirect_uri", `${options.settings.appUrl}/auth/login`);

  return Effect.tryPromise(() => fetch(url)).pipe(
    Effect.flatMap((response) =>
      Effect.logInfo("[sign-out] IAM end-session response", response.status),
    ),
    Effect.catch((cause) => Effect.logError("[sign-out] Failed to call IAM end-session", cause)),
  );
};

const terminateIamSession = (options: { settings: AppSettingsShape; account: IamAccount | null }) =>
  Effect.gen(function* () {
    const { settings, account } = options;
    if (account?.refreshToken) {
      yield* revokeRefreshToken({ settings, refreshToken: account.refreshToken });
    }
    if (account?.idToken) {
      yield* endIamSession({ settings, idToken: account.idToken });
    }
  });

const setCookiesOf = (response: Response): string[] =>
  [...response.headers.entries()]
    .filter(([name]) => name.toLowerCase() === "set-cookie")
    .map(([, value]) => value);

export const POST = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const settings = yield* AppSettings;
    const headers = new Headers(request.headers);

    const sessionResult = yield* Effect.promise(() => auth.api.getSession({ headers }));
    if (!sessionResult?.session) {
      return yield* new Unauthorized({ message: "Not authenticated" });
    }

    const account = yield* useAuthDatabase("account.findIamAccount", (prisma) =>
      prisma.account.findFirst({
        where: { userId: sessionResult.session.userId, providerId: CLIENT_ID },
      }),
    );
    yield* terminateIamSession({ settings, account });

    const signOutResponse = yield* Effect.promise(() =>
      auth.api.signOut({ headers, asResponse: true }),
    );

    const response = new Response(null, { status: 200 });
    for (const cookie of setCookiesOf(signOutResponse)) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  }),
);
