import { Layer, ManagedRuntime } from "effect";
import { Auth } from "./auth";
import { AppSettings } from "./config";
import { Database } from "./database";
import { DownloadSessions } from "./download-sessions";
import { Storage } from "./storage";

export const AppLayer = Layer.mergeAll(
  Database.layer,
  Storage.layer,
  Auth.layer,
  DownloadSessions.layer,
).pipe(Layer.provideMerge(AppSettings.layer));

export type AppServices = Layer.Success<typeof AppLayer>;

type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, Layer.Error<typeof AppLayer>>;

// Kept on globalThis so dev HMR and warm serverless invocations reuse one S3 client.
const globalForRuntime = globalThis as unknown as { effectRuntime?: AppRuntime };

globalForRuntime.effectRuntime ??= ManagedRuntime.make(AppLayer);

export const runtime: AppRuntime = globalForRuntime.effectRuntime;
