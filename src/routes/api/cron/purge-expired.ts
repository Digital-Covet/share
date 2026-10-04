import { Effect, Option, Redacted } from "effect";
import { AppSettings } from "@/server/effect/config";
import { Unauthorized } from "@/server/effect/errors";
import { effectRoute } from "@/server/effect/route";
import { purgeExpiredFiles } from "@/server/purge-expired";

export const GET = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    const { cronSecret } = yield* AppSettings;
    const authorized =
      Option.isSome(cronSecret) &&
      request.headers.get("authorization") === `Bearer ${Redacted.value(cronSecret.value)}`;
    if (!authorized) return yield* new Unauthorized({ message: "Unauthorized" });

    const report = yield* purgeExpiredFiles;

    return Response.json({ ok: true, ...report });
  }),
);
