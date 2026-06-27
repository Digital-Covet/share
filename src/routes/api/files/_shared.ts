import { z } from "zod";

export const SecuritySettingsSchema = z.object({
  expiration: z.enum(["24h", "7d", "30d", "custom"]),
  customExpirationDate: z.string().datetime().optional(),
  oneTimeDownload: z.boolean().default(false),
  maxDownloads: z.number().int().min(1).max(100).nullable().default(null),
});

export type SecuritySettings = z.infer<typeof SecuritySettingsSchema>;

export function calculateExpiry(settings: SecuritySettings): Date {
  if (settings.expiration === "custom" && settings.customExpirationDate) {
    return new Date(settings.customExpirationDate);
  }
  const hours =
    settings.expiration === "24h"
      ? 24
      : settings.expiration === "7d"
        ? 168
        : 720;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
