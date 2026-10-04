import { Context, Effect, Layer } from "effect";
import { prisma } from "@/db/project";
import { DatabaseError } from "./errors";

export type ProjectClient = typeof prisma;

export class Database extends Context.Service<
  Database,
  {
    readonly use: <A>(
      operation: string,
      run: (client: ProjectClient) => Promise<A>,
    ) => Effect.Effect<A, DatabaseError>;
  }
>()("share/Database") {
  static readonly layer = Layer.succeed(this)({
    use: (operation, run) =>
      Effect.tryPromise({
        try: () => run(prisma),
        catch: (cause) => new DatabaseError({ operation, cause }),
      }),
  });
}
