import { Effect, Schema } from "effect";

export const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));

export const intBetween = (minimum: number, maximum: number) =>
  Schema.Int.check(Schema.isBetween({ minimum, maximum }));

export const FlagDefaultingToFalse = Schema.Boolean.pipe(
  Schema.withDecodingDefault(Effect.succeed(false)),
);

export const MaxDownloadsField = Schema.NullOr(intBetween(1, 100)).pipe(
  Schema.withDecodingDefault(Effect.succeed(null)),
);

export const PasswordField = Schema.NullOr(
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
).pipe(Schema.withDecodingDefault(Effect.succeed(null)));

export const isPasswordRequirementMet = (body: {
  readonly is_password_protected: boolean;
  readonly password: string | null;
}) => !body.is_password_protected || body.password !== null;
