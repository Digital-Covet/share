import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Context, Effect, Layer, Redacted } from "effect";
import { PRESIGN_EXPIRES } from "@/lib/constants";
import { r2FileKey, r2PartKey } from "@/server/r2-keys";
import { AppSettings } from "./config";
import { StorageError } from "./errors";

const REQUEST_TIMEOUT = "30 seconds";
const DELETE_RETRIES = 2;
const DELETE_CONCURRENCY = 8;

export interface PresignedPart {
  readonly partNumber: number;
  readonly url: string;
  readonly expiresAt: string;
}

export interface MultipartTarget {
  readonly key: string;
  readonly uploadId: string;
}

export interface FileObjects {
  readonly userId: string;
  readonly fileId: string;
  readonly totalChunks: number;
}

const objectKeysOf = ({ userId, fileId, totalChunks }: FileObjects) =>
  totalChunks === 1
    ? [{ label: "file", key: r2FileKey(userId, fileId) }]
    : Array.from({ length: totalChunks }, (_, i) => ({
        label: `chunk ${i + 1}`,
        key: r2PartKey(userId, fileId, i + 1),
      }));

export class Storage extends Context.Service<
  Storage,
  {
    readonly createMultipartUpload: (options: {
      key: string;
      contentType: string;
    }) => Effect.Effect<string, StorageError>;
    readonly completeMultipartUpload: (
      target: MultipartTarget & {
        parts: ReadonlyArray<{ partNumber: number; etag: string }>;
      },
    ) => Effect.Effect<void, StorageError>;
    readonly abortMultipartUpload: (target: MultipartTarget) => Effect.Effect<void, StorageError>;
    readonly presignUploadParts: (
      target: MultipartTarget & { partNumbers: ReadonlyArray<number> },
    ) => Effect.Effect<ReadonlyArray<PresignedPart>, StorageError>;
    readonly presignRange: (options: {
      key: string;
      range: string;
    }) => Effect.Effect<string, StorageError>;
    /** Resolves to a description of every object that could not be deleted. */
    readonly deleteFileObjects: (file: FileObjects) => Effect.Effect<ReadonlyArray<string>>;
  }
>()("share/Storage") {
  static readonly layer = Layer.effect(
    Storage,
    Effect.gen(function* () {
      const settings = yield* AppSettings;
      const bucket = settings.bucket;

      const client = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new S3Client({
              region: "auto",
              endpoint: settings.r2Endpoint,
              credentials: {
                accessKeyId: Redacted.value(settings.r2AccessKeyId),
                secretAccessKey: Redacted.value(settings.r2SecretAccessKey),
              },
            }),
        ),
        (s3) => Effect.sync(() => s3.destroy()),
      );

      const call = <A>(operation: string, run: (signal: AbortSignal) => Promise<A>) =>
        Effect.tryPromise({
          try: run,
          catch: (cause) => new StorageError({ operation, cause }),
        }).pipe(
          Effect.timeoutOrElse({
            duration: REQUEST_TIMEOUT,
            orElse: () => Effect.fail(new StorageError({ operation, cause: "timed out" })),
          }),
        );

      const presign = (operation: string, run: () => Promise<string>) =>
        Effect.tryPromise({
          try: run,
          catch: (cause) => new StorageError({ operation, cause }),
        });

      const expiryOf = () => new Date(Date.now() + PRESIGN_EXPIRES * 1000).toISOString();

      const deleteObject = ({ label, key }: { label: string; key: string }) =>
        call(`deleteObject ${label}`, (signal) =>
          client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
            abortSignal: signal,
          }),
        ).pipe(
          Effect.retry({ times: DELETE_RETRIES }),
          Effect.match({
            onFailure: (error) => `${label}: ${String(error.cause)}`,
            onSuccess: () => undefined,
          }),
        );

      return Storage.of({
        createMultipartUpload: ({ key, contentType }) =>
          call("createMultipartUpload", (signal) =>
            client.send(
              new CreateMultipartUploadCommand({
                Bucket: bucket,
                Key: key,
                ContentType: contentType,
              }),
              { abortSignal: signal },
            ),
          ).pipe(
            Effect.flatMap(({ UploadId }) =>
              UploadId
                ? Effect.succeed(UploadId)
                : Effect.fail(
                    new StorageError({
                      operation: "createMultipartUpload",
                      cause: "missing UploadId",
                    }),
                  ),
            ),
          ),

        completeMultipartUpload: ({ key, uploadId, parts }) =>
          call("completeMultipartUpload", (signal) =>
            client.send(
              new CompleteMultipartUploadCommand({
                Bucket: bucket,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: {
                  Parts: parts.map(({ partNumber, etag }) => ({
                    PartNumber: partNumber,
                    ETag: etag,
                  })),
                },
              }),
              { abortSignal: signal },
            ),
          ).pipe(Effect.asVoid),

        abortMultipartUpload: ({ key, uploadId }) =>
          call("abortMultipartUpload", (signal) =>
            client.send(
              new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
              { abortSignal: signal },
            ),
          ).pipe(Effect.asVoid),

        presignUploadParts: ({ key, uploadId, partNumbers }) =>
          Effect.forEach(
            partNumbers,
            (partNumber) =>
              presign("presignUploadPart", () =>
                getSignedUrl(
                  client,
                  new UploadPartCommand({
                    Bucket: bucket,
                    Key: key,
                    UploadId: uploadId,
                    PartNumber: partNumber,
                  }),
                  { expiresIn: PRESIGN_EXPIRES },
                ),
              ).pipe(Effect.map((url) => ({ partNumber, url, expiresAt: expiryOf() }))),
            { concurrency: "unbounded" },
          ),

        presignRange: ({ key, range }) =>
          presign("presignRange", () =>
            getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }), {
              expiresIn: PRESIGN_EXPIRES,
            }),
          ),

        deleteFileObjects: (file) =>
          Effect.forEach(objectKeysOf(file), deleteObject, {
            concurrency: DELETE_CONCURRENCY,
          }).pipe(Effect.map((outcomes) => outcomes.filter((failure) => failure !== undefined))),
      });
    }),
  );
}
