const ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128-bit salt
const KEY_LENGTH = 32; // 256-bit derived key
const DIGEST: "SHA-256" = "SHA-256";

const TEXT_ENCODER = new TextEncoder();

/**
 * Derives PBKDF2 bits from (password, salt). Shared by hash & verify.
 * Salt is passed as Uint8Array directly (BufferSource-compatible) — no copy.
 */
async function derivePbkdf2Bits(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: DIGEST },
    keyMaterial,
    KEY_LENGTH * 8,
  );
}

/**
 * Chunked Base64 encoder. Building `binary` in 32 KB chunks avoids the
 * quadratic cost of immutable string concatenation per byte.
 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(
      null,
      Array.from(slice) as unknown as number[],
    );
  }
  return btoa(binary);
}

/** Decodes a Base64 string into a fresh Uint8Array. */
export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encodes a Uint8Array into Base64. */
export function toBase64FromBytes(bytes: Uint8Array): string {
  return toBase64(new Uint8Array(bytes).buffer as ArrayBuffer);
}

/**
 * Constant-time equality. WebCrypto does not expose a native timingSafeEqual
 * in browsers; this is the standard mitigation. Note: V8 may speculatively
 * optimize array element access, but the unconditional loop and OR-accumulator
 * defeat most common-short-circuit optimizations.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Serializes (salt, hash) as "saltB64:hashB64". */
function serialize(salt: Uint8Array, hash: ArrayBuffer): string {
  return `${toBase64(new Uint8Array(salt).buffer as ArrayBuffer)}:${toBase64(hash)}`;
}

/**
 * Hashes a password. Returns a self-describing "saltB64:hashB64" string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await derivePbkdf2Bits(password, salt);
  return serialize(salt, hash);
}

/**
 * Verifies a plaintext password against a stored "saltB64:hashB64" string.
 * Returns false on malformed stored strings (never throws).
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const sep = stored.indexOf(":");
  if (sep < 0) return false;
  const saltB64 = stored.slice(0, sep);
  const expectedHashB64 = stored.slice(sep + 1);
  if (!saltB64 || !expectedHashB64) return false;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(expectedHashB64);
  const computed = new Uint8Array(await derivePbkdf2Bits(password, salt));
  return timingSafeEqual(computed, expected);
}

export const PASSWORD_HASH_CONFIG = {
  ITERATIONS,
  SALT_LENGTH,
  KEY_LENGTH,
  DIGEST,
} as const;
