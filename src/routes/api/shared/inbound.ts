import { Effect } from "effect";
import { Auth } from "@/server/effect/auth";
import { effectRoute } from "@/server/effect/route";

// The schema has no recipient field yet, so nothing can be addressed to a user.
export const GET = effectRoute(({ request }: { request: Request }) =>
  Effect.gen(function* () {
    yield* (yield* Auth).requireUser(request);
    return Response.json({ transfers: [] });
  }),
);
