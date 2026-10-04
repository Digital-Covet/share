import { Effect, Layer, Redacted } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppSettingsShape, AppSettings } from "./config";
import { DownloadSessions } from "./download-sessions";

const settingsWithSecret = (secret: string) =>
  Layer.succeed(AppSettings)({ sessionSecret: Redacted.make(secret) } as AppSettingsShape);

const sessionsWith = (secret: string) =>
  Effect.runSync(
    Effect.gen(function* () {
      return yield* DownloadSessions;
    }).pipe(
      Effect.provide(DownloadSessions.layer.pipe(Layer.provide(settingsWithSecret(secret)))),
    ),
  );

describe("DownloadSessions", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts a token for the share link it was issued for", () => {
    const sessions = sessionsWith("secret");
    expect(sessions.verify(sessions.create("link-1"), "link-1")).toBe(true);
  });

  it("rejects a token for another share link", () => {
    const sessions = sessionsWith("secret");
    expect(sessions.verify(sessions.create("link-1"), "link-2")).toBe(false);
  });

  it("rejects tokens signed with a different secret", () => {
    const token = sessionsWith("secret").create("link-1");
    expect(sessionsWith("other").verify(token, "link-1")).toBe(false);
  });

  it("rejects tampered and malformed tokens", () => {
    const sessions = sessionsWith("secret");
    const [data] = sessions.create("link-1").split(".");
    expect(sessions.verify(`${data}.AAAA`, "link-1")).toBe(false);
    expect(sessions.verify("no-separator", "link-1")).toBe(false);
    expect(sessions.verify("", "link-1")).toBe(false);
  });

  it("rejects tokens older than an hour", () => {
    vi.useFakeTimers();
    const sessions = sessionsWith("secret");
    const token = sessions.create("link-1");
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(sessions.verify(token, "link-1")).toBe(false);
  });
});
