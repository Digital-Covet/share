import { Effect } from "effect";
import { NotFound } from "./errors";

/** Treats files owned by someone else exactly like missing ones, so ids cannot be probed. */
export const requireOwnedFile = <F extends { readonly userId: string | null }>(
  file: F | null,
  ownerId: string,
): Effect.Effect<F, NotFound> =>
  file && file.userId === ownerId
    ? Effect.succeed(file)
    : Effect.fail(new NotFound({ message: "File not found" }));
