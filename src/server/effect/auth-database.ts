import { Effect } from "effect";
import { prisma } from "@/db/auth";
import { DatabaseError } from "./errors";

export const useAuthDatabase = <A>(
  operation: string,
  run: (client: typeof prisma) => Promise<A>,
): Effect.Effect<A, DatabaseError> =>
  Effect.tryPromise({
    try: () => run(prisma),
    catch: (cause) => new DatabaseError({ operation, cause }),
  });
