import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'
import { FSDriver } from '@adonisjs/drive/drivers/fs'
import type { SignedURLOptions } from '@adonisjs/drive/types'

/**
 * Stand-in URLs for the local `fs` disk and `drive.fake()`. Neither can sign
 * real URLs (flydrive's fs driver refuses uploads); tests only need stable
 * strings that expose the options they were signed with.
 */
const localUrl = (action: string, key: string, options: SignedURLOptions = {}) => {
  const qs = new URLSearchParams()
  for (const [name, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) qs.set(name, String(value))
  }
  return `/drive/local/${action}/${key}${qs.size ? `?${qs}` : ''}`
}

const localUrlBuilder = {
  async generateURL(key: string) {
    return localUrl('get', key)
  },
  async generateSignedURL(key: string, _: string, options: SignedURLOptions) {
    return localUrl('get', key, options)
  },
  async generateSignedUploadURL(key: string, _: string, options: SignedURLOptions) {
    return localUrl('put', key, options)
  },
}

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),

  fakes: {
    location: app.tmpPath('drive-fakes'),
    urlBuilder: localUrlBuilder,
  },

  services: {
    /**
     * Cloudflare R2 through its S3-compatible API. Objects stay private;
     * clients only ever get presigned URLs.
     */
    r2: services.s3({
      credentials: {
        accessKeyId: env.get('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: env.get('R2_SECRET_ACCESS_KEY')?.release() ?? '',
      },
      region: 'auto',
      endpoint: env.get('R2_ENDPOINT'),
      bucket: env.get('R2_BUCKET', ''),
      visibility: 'private',
      supportsACL: false,
    }),

    /** Local disk for tests; not reachable over HTTP. */
    fs: () =>
      new FSDriver({
        location: app.tmpPath('drive'),
        visibility: 'private',
        urlBuilder: localUrlBuilder,
      }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
