import { Context, Effect, Layer } from "effect";
import { type AuthUser, getCurrentUser } from "@/lib/auth.server";
import { Unauthorized } from "./errors";

export class Auth extends Context.Service<
  Auth,
  {
    readonly requireUser: (request: Request) => Effect.Effect<AuthUser, Unauthorized>;
  }
>()("share/Auth") {
  static readonly layer = Layer.succeed(this)({
    requireUser: (request) =>
      Effect.tryPromise(() => getCurrentUser(request)).pipe(
        Effect.orDie,
        Effect.flatMap((user) =>
          user ? Effect.succeed(user) : Effect.fail(new Unauthorized({ message: "Unauthorized" })),
        ),
      ),
  });
}
