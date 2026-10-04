import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("./runtime", () => ({ runtime: ManagedRuntime.make(Layer.empty) }));

const { effectRoute } = await import("./route");
const { Conflict, DatabaseError, RateLimited, Unauthorized } = await import("./errors");

const call = (program: Effect.Effect<Response, any, never>, headers?: Record<string, string>) =>
  effectRoute(() => program as never, { headers })({});

describe("effectRoute", () => {
  it("passes successful responses through", async () => {
    const response = await call(Effect.succeed(Response.json({ ok: true })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it.each([
    [new Unauthorized({ message: "Unauthorized" }), 401],
    [new Conflict({ message: "File is not in pending state" }), 409],
  ])("maps %s to its HTTP status", async (error, status) => {
    const response = await call(Effect.fail(error));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: error.message });
  });

  it("includes error details and headers", async () => {
    const response = await call(
      Effect.fail(
        new RateLimited({
          message: "Too many requests",
          details: { reason: "burst" },
          headers: { "Retry-After": "5" },
        }),
      ),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.json()).toEqual({ error: "Too many requests", reason: "burst" });
  });

  it("hides infrastructure failures behind a 500", async () => {
    const response = await call(
      Effect.fail(new DatabaseError({ operation: "file.find", cause: "secret detail" })),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });

  it("turns defects into a 500", async () => {
    const response = await call(Effect.die(new Error("boom")));
    expect(response.status).toBe(500);
  });

  it("applies default headers to success and failure responses", async () => {
    const headers = { "Cache-Control": "no-store" };
    const ok = await call(Effect.succeed(Response.json({})), headers);
    const failed = await call(Effect.fail(new Unauthorized({ message: "no" })), headers);
    expect(ok.headers.get("Cache-Control")).toBe("no-store");
    expect(failed.headers.get("Cache-Control")).toBe("no-store");
  });
});
