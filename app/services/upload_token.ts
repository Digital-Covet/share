import encryption from '@adonisjs/core/services/encryption'

/** Files a creator declared for a transfer, with server-assigned ids and keys. */
export type UploadManifest = {
  transferId: string
  files: Array<{
    id: string
    filename: string
    sizeBytes: number
    mimeType: string | null
    objectKey: string
  }>
}

const TOKEN_TTL = '24h'
const purpose = (transferId: string) => `transfer-upload:${transferId}`

/**
 * Encrypt the manifest for the creator's browser. The client can neither
 * read nor alter it, and it only opens for the transfer it was made for.
 */
export function sealManifest(manifest: UploadManifest): string {
  return encryption.encrypt(manifest, TOKEN_TTL, purpose(manifest.transferId))
}

/** The manifest inside `token`, or `null` if it's tampered, expired or for another transfer. */
export function openManifest(token: string, transferId: string): UploadManifest | null {
  let manifest: UploadManifest | null
  try {
    manifest = encryption.decrypt<UploadManifest>(token, purpose(transferId))
  } catch {
    return null
  }
  if (!manifest || manifest.transferId !== transferId || !Array.isArray(manifest.files)) {
    return null
  }
  return manifest
}
