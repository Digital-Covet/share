import { Effect, Schema } from "effect";
import { AppSettings } from "@/server/effect/config";
import { useAuthDatabase } from "@/server/effect/auth-database";
import { BadRequest } from "@/server/effect/errors";
import { effectRoute } from "@/server/effect/route";

const LogoutTokenPayload = Schema.Struct({
  iss: Schema.optionalKey(Schema.String),
  sub: Schema.optionalKey(Schema.String),
  sid: Schema.optionalKey(Schema.String),
});

const invalidToken = () => new BadRequest({ message: "Invalid logout token" });

const decodeLogoutToken = (logoutToken: string) =>
  Effect.try({
    try: () => {
      const parts = logoutToken.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");
      return JSON.parse(Buffer.from(parts[1], "base64").toString()) as unknown;
    },
    catch: invalidToken,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(LogoutTokenPayload)),
    Effect.mapError(invalidToken),
  );

const processLogoutToken = Effect.fnUntraced(function* (logoutToken: string) {
  const { iamUrl } = yield* AppSettings;
  const payload = yield* decodeLogoutToken(logoutToken);

  if (payload.iss !== iamUrl && payload.iss !== `${iamUrl}/api/auth`) {
    yield* Effect.logWarning("[front-channel-logout] Invalid issuer", payload.iss);
    return yield* new BadRequest({ message: "Invalid issuer" });
  }

  if (payload.sub) {
    const { sub } = payload;
    yield* useAuthDatabase("session.deleteByUser", (prisma) =>
      prisma.session.deleteMany({ where: { userId: sub } }),
    );
  }
  if (payload.sid) {
    const { sid } = payload;
    yield* useAuthDatabase("session.deleteById", (prisma) =>
      prisma.session.deleteMany({ where: { id: sid } }),
    );
  }
});

const missingToken = () => new BadRequest({ message: "Missing logout_token" });

export const POST = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/x-www-form-urlencoded")) {
      return yield* new BadRequest({ message: "Invalid content type" });
    }

    const params = new URLSearchParams(yield* Effect.promise(() => request.text()));
    const logoutToken = params.get("logout_token");
    if (!logoutToken) return yield* missingToken();

    yield* processLogoutToken(logoutToken);
    return Response.json({ success: true });
  }),
);

export const GET = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const logoutToken = new URL(request.url).searchParams.get("logout_token");
    if (!logoutToken) return yield* missingToken();

    yield* processLogoutToken(logoutToken);
    return new Response("OK", { status: 200 });
  }).pipe(
    Effect.catchTag("BadRequest", (error) =>
      Effect.succeed(new Response(error.message, { status: 400 })),
    ),
  ),
);
