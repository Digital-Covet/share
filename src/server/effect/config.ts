import { Config, Context, Effect, Layer, type Option, type Redacted } from "effect";

const PRODUCTION_APP_URL = "https://share.digitalcovet.com";
const DEVELOPMENT_APP_URL = "http://localhost:5173";
const DEFAULT_IAM_URL = "https://iam.digitalcovet.com";

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, "");

const appUrl = Config.String("BETTER_AUTH_URL").pipe(
  Config.orElse(() => Config.String("VITE_APP_URL")),
  Config.orElse(() =>
    Config.String("NODE_ENV").pipe(
      Config.map((env) => (env === "production" ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL)),
    ),
  ),
  Config.map(stripTrailingSlashes),
);

const iamUrl = Config.String("IAM_URL").pipe(
  Config.withDefault(DEFAULT_IAM_URL),
  Config.map(stripTrailingSlashes),
);

const sessionSecret = Config.Redacted("SESSION_SECRET").pipe(
  Config.orElse(() => Config.Redacted("ENCRYPTION_KEY")),
);

const settings = Config.all({
  bucket: Config.NonEmptyString("R2_BUCKET"),
  r2Endpoint: Config.NonEmptyString("CLOUDFLARE_ENDPOINT_URL"),
  r2AccessKeyId: Config.Redacted("CLOUDFLARE_ACCESS_KEY"),
  r2SecretAccessKey: Config.Redacted("CLOUDFLARE_SECRET_ACCESS_KEY"),
  sessionSecret,
  cronSecret: Config.option(Config.Redacted("CRON_SECRET")),
  oauthClientSecret: Config.Redacted("OAUTH_CLIENT_SECRET").pipe(
    Config.withDefault(undefined),
  ),
  iamUrl,
  appUrl,
});

export interface AppSettingsShape {
  readonly bucket: string;
  readonly r2Endpoint: string;
  readonly r2AccessKeyId: Redacted.Redacted;
  readonly r2SecretAccessKey: Redacted.Redacted;
  readonly sessionSecret: Redacted.Redacted;
  readonly cronSecret: Option.Option<Redacted.Redacted>;
  readonly oauthClientSecret: Redacted.Redacted | undefined;
  readonly iamUrl: string;
  readonly appUrl: string;
}

export class AppSettings extends Context.Service<AppSettings, AppSettingsShape>()(
  "share/AppSettings",
) {
  static readonly layer = Layer.effect(
    AppSettings,
    Effect.gen(function* () {
      return AppSettings.of(yield* settings);
    }),
  );
}
