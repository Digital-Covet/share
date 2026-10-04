import { Data } from "effect";

interface ClientErrorFields {
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, string>>;
}

export class BadRequest extends Data.TaggedError("BadRequest")<ClientErrorFields> {}
export class Unauthorized extends Data.TaggedError("Unauthorized")<ClientErrorFields> {}
export class Forbidden extends Data.TaggedError("Forbidden")<ClientErrorFields> {}
export class NotFound extends Data.TaggedError("NotFound")<ClientErrorFields> {}
export class Conflict extends Data.TaggedError("Conflict")<ClientErrorFields> {}
export class Gone extends Data.TaggedError("Gone")<ClientErrorFields> {}
export class ValidationFailed extends Data.TaggedError("ValidationFailed")<ClientErrorFields> {}
export class RateLimited extends Data.TaggedError("RateLimited")<ClientErrorFields> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export type ClientError =
  | BadRequest
  | Unauthorized
  | Forbidden
  | NotFound
  | Conflict
  | Gone
  | ValidationFailed
  | RateLimited;

export type InfrastructureError = DatabaseError | StorageError;

export type ApiError = ClientError | InfrastructureError;

export const CLIENT_ERROR_STATUS: Record<ClientError["_tag"], number> = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Gone: 410,
  ValidationFailed: 422,
  RateLimited: 429,
};
