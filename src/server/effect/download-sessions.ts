import { createHmac, timingSafeEqual } from "node:crypto";
import { Context, Effect, Layer, Redacted } from "effect";
import { AppSettings } from "./config";

const SESSION_TTL_MS = 60 * 60 * 1000;

interface SessionPayload {
  readonly sid: string;
  readonly ts: number;
}

export class DownloadSessions extends Context.Service<
  DownloadSessions,
  {
    readonly create: (shareLinkId: string) => string;
    readonly verify: (token: string, shareLinkId: string) => boolean;
  }
>()("share/DownloadSessions") {
  static readonly layer = Layer.effect(
    DownloadSessions,
    Effect.gen(function* () {
      const { sessionSecret } = yield* AppSettings;
      const secret = Redacted.value(sessionSecret);

      const sign = (data: string) => createHmac("sha256", secret).update(data).digest("base64url");

      const hasValidSignature = (data: string, signature: string) => {
        const received = Buffer.from(signature, "base64url");
        const expected = Buffer.from(sign(data), "base64url");
        return received.length === expected.length && timingSafeEqual(received, expected);
      };

      return DownloadSessions.of({
        create: (shareLinkId) => {
          const payload: SessionPayload = { sid: shareLinkId, ts: Date.now() };
          const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
          return `${data}.${sign(data)}`;
        },

        verify: (token, shareLinkId) => {
          const separator = token.indexOf(".");
          if (separator === -1) return false;
          const data = token.slice(0, separator);
          const signature = token.slice(separator + 1);
          if (!data || !signature || !hasValidSignature(data, signature)) return false;

          try {
            const payload = JSON.parse(
              Buffer.from(data, "base64url").toString("utf-8"),
            ) as SessionPayload;
            return payload.sid === shareLinkId && Date.now() - payload.ts <= SESSION_TTL_MS;
          } catch {
            return false;
          }
        },
      });
    }),
  );
}
