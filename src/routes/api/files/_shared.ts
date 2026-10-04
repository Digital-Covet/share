import { Schema } from "effect";
import { FlagDefaultingToFalse, MaxDownloadsField } from "@/server/effect/schemas";

const IsoDateString = Schema.String.check(
  Schema.makeFilter((value) => !Number.isNaN(Date.parse(value)) || "Expected an ISO date string"),
);

export const SecuritySettingsSchema = Schema.Struct({
  expiration: Schema.Literals(["24h", "7d", "30d", "custom"]),
  customExpirationDate: Schema.optionalKey(IsoDateString),
  oneTimeDownload: FlagDefaultingToFalse,
  maxDownloads: MaxDownloadsField,
});

export type SecuritySettings = typeof SecuritySettingsSchema.Type;

const HOURS_BY_PRESET = { "24h": 24, "7d": 168, "30d": 720 } as const;

export function calculateExpiry(settings: SecuritySettings): Date {
  if (settings.expiration === "custom" && settings.customExpirationDate) {
    return new Date(settings.customExpirationDate);
  }
  const hours = settings.expiration === "custom" ? HOURS_BY_PRESET["30d"] : HOURS_BY_PRESET[settings.expiration];
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
