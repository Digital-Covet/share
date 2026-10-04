import { Effect } from "effect";
import { hashPassword, verifyPassword } from "@/lib/crypto/password";

export const hashPasswordEffect = (password: string) => Effect.promise(() => hashPassword(password));

export const verifyPasswordEffect = (options: { password: string; stored: string }) =>
  Effect.promise(() => verifyPassword(options.password, options.stored));
