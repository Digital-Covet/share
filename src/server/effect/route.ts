import { Effect, Schema } from "effect";
import {
  type ApiError,
  BadRequest,
  CLIENT_ERROR_STATUS,
  type ClientError,
  ValidationFailed,
} from "./errors";
import { type AppServices, runtime } from "./runtime";

interface RouteOptions {
  /** Headers added to every response, success or failure. */
  readonly headers?: Readonly<Record<string, string>>;
}

const isClientError = (error: ApiError): error is ClientError => error._tag in CLIENT_ERROR_STATUS;

const clientErrorResponse = (error: ClientError, headers: RouteOptions["headers"]) =>
  Response.json(
    { error: error.message, ...error.details },
    {
      status: CLIENT_ERROR_STATUS[error._tag],
      headers: { ...headers, ...error.headers },
    },
  );

const internalErrorResponse = (headers: RouteOptions["headers"]) =>
  Response.json({ error: "Internal server error" }, { status: 500, headers });

const withHeaders = (response: Response, headers: RouteOptions["headers"]) => {
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
};

/** The single place where Effect programs meet SolidStart's promise-based handlers. */
export const effectRoute =
  <Event extends object>(
    handler: (event: Event) => Effect.Effect<Response, ApiError, AppServices>,
    options: RouteOptions = {},
  ) =>
  (event: Event): Promise<Response> =>
    runtime.runPromise(
      handler(event).pipe(
        Effect.map((response) => withHeaders(response, options.headers)),
        Effect.catch((error: ApiError) =>
          isClientError(error)
            ? Effect.succeed(clientErrorResponse(error, options.headers))
            : Effect.logError("Infrastructure failure", error).pipe(
                Effect.as(internalErrorResponse(options.headers)),
              ),
        ),
        Effect.catchCause((cause) =>
          Effect.logError("Unhandled route failure", cause).pipe(
            Effect.as(internalErrorResponse(options.headers)),
          ),
        ),
      ),
    );

export const decodeInput = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
): Effect.Effect<S["Type"], ValidationFailed, S["DecodingServices"]> =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      (error) => new ValidationFailed({ message: "Invalid payload", details: { issues: error.message } }),
    ),
  );

export const readJson = (request: Request): Effect.Effect<unknown, BadRequest> =>
  Effect.tryPromise({
    try: () => request.json() as Promise<unknown>,
    catch: () => new BadRequest({ message: "Invalid JSON body" }),
  });

export const decodeJsonBody = <S extends Schema.ConstraintDecoder<unknown>>(
  request: Request,
  schema: S,
) => readJson(request).pipe(Effect.flatMap((body) => decodeInput(schema, body)));
