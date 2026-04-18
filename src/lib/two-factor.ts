// ─────────────────────────────────────────────────────────────
// O.P.U.C — TOTP Two-Factor Authentication
// Pure TypeScript TOTP implementation using Node.js crypto.
// Compatible with Google Authenticator, Authy, etc.
// Inspired by CATS custom TOTP implementation.
// Server-side only (uses Node.js crypto module).
// ─────────────────────────────────────────────────────────────

import { createHmac, createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = 'SHA-1'

// Encryption key derived from env or fixed dev value
const ENCRYPTION_KEY =
  process.env.TOTP_ENCRYPTION_KEY ?? 'opuc-totp-dev-key-change-me!'

// ═══════════════════════════════════════════════════════════
// BASE32 ENCODING / DECODING
// RFC 4648 standard — used by TOTP / Google Authenticator
// ═══════════════════════════════════════════════════════════

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Uint8Array): string {
  let bits = ''
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, '0')
  }

  let result = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += BASE32_CHARS[parseInt(bits.substring(i, i + 5), 2)]
  }

  // Pad with '=' to multiple of 8
  while (result.length % 8 !== 0) {
    result += '='
  }

  return result
}

function base32Decode(str: string): Uint8Array {
  // Remove padding and whitespace
  const cleaned = str.replace(/[=\s]/g, '').toUpperCase()

  let bits = ''
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_CHARS.indexOf(cleaned[i])
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${cleaned[i]}`)
    }
    bits += val.toString(2).padStart(5, '0')
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2)
  }

  return bytes
}

// ═══════════════════════════════════════════════════════════
// TOTP CORE
// ═══════════════════════════════════════════════════════════

/**
 * Generate a TOTP code for a given secret and time counter.
 */
function generateTOTP(secret: string, counter: number): string {
  const key = base32Decode(secret)

  // Counter as 8-byte big-endian buffer
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeUInt32BE(0, 0) // high 4 bytes
  counterBuffer.writeUInt32BE(counter, 4) // low 4 bytes

  // HMAC-SHA1
  const hmac = createHmac(TOTP_ALGORITHM, Buffer.from(key))
  hmac.update(counterBuffer)
  const hmacResult = hmac.digest()

  // Dynamic truncation (RFC 4226)
  const offset = hmacResult[hmacResult.length - 1] & 0x0f
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)

  const otp = binary % Math.pow(10, TOTP_DIGITS)
  return otp.toString().padStart(TOTP_DIGITS, '0')
}

/**
 * Get the current TOTP time counter.
 */
function getCurrentCounter(): number {
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD)
}

// ═══════════════════════════════════════════════════════════
// AES-256-GCM ENCRYPTION
// For storing TOTP secrets in the database.
// Uses authenticated encryption with associated data (AEAD).
// ═══════════════════════════════════════════════════════════

/**
 * Derive a 32-byte key from the configured encryption key using SHA-256.
 */
function deriveEncryptionKey(key: string): Buffer {
  return createHash('sha256').update(key).digest() // 32 bytes
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64-encoded string (IV + ciphertext + authTag).
 *
 * - Generates a random 16-byte IV per encryption
 * - Uses AES-256-GCM for authenticated encryption
 * - Appends the 16-byte authTag to the output
 */
export function encryptSecret(secret: string): string {
  const key = deriveEncryptionKey(ENCRYPTION_KEY)
  const iv = randomBytes(16)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf-8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag() // 16 bytes

  // Combine IV + ciphertext + authTag and encode as base64
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64')
}

/**
 * Decrypt a string that was encrypted with encryptSecret.
 * Expects base64-encoded input in format: IV (16 bytes) + ciphertext + authTag (16 bytes).
 */
export function decryptSecret(encrypted: string): string {
  const key = deriveEncryptionKey(ENCRYPTION_KEY)
  const data = Buffer.from(encrypted, 'base64')

  // Extract IV (first 16 bytes), authTag (last 16 bytes), and ciphertext (middle)
  const iv = data.subarray(0, 16)
  const authTag = data.subarray(data.length - 16)
  const ciphertext = data.subarray(16, data.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(ciphertext) + decipher.final('utf-8')
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

/**
 * Generate a new TOTP secret (20-character base32 string).
 * Compatible with Google Authenticator, Authy, etc.
 */
export function generateTOTPSecret(): string {
  // 20 bytes of randomness → ~32 base32 chars, but we trim to 20
  // Actually, 16 bytes → 26 base32 chars (32-bit aligned = 26 chars with padding)
  // Let's use 16 bytes which gives a 26-char base32 string
  const bytes = randomBytes(16)
  return base32Encode(bytes).replace(/=/g, '')
}

/**
 * Generate backup codes for 2FA recovery.
 * Each code is 8 alphanumeric characters.
 * @param count - Number of codes to generate (default: 10)
 */
export function generateTOTPBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // removed I, O, 0, 1 to avoid confusion

  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8)
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length]
    }
    codes.push(code)
  }

  return codes
}

/**
 * Generate the otpauth:// URI for QR code generation.
 * @param secret - The TOTP secret (base32)
 * @param email - The user's email (used as account identifier)
 * @param issuer - Optional issuer name (default: "O.P.U.C")
 */
export function getTOTPAuthURI(
  secret: string,
  email: string,
  issuer: string = 'O.P.U.C'
): string {
  const params = new URLSearchParams({
    secret: secret,
    issuer: issuer,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS.toString(),
    period: TOTP_PERIOD.toString(),
  })

  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?${params.toString()}`
}

/**
 * Verify a 6-digit TOTP code against the given secret.
 * Accepts the current time period AND the previous period
 * to provide clock drift tolerance (±30 seconds).
 *
 * @param secret - The TOTP secret (base32)
 * @param code - The 6-digit code entered by the user
 * @returns true if the code is valid
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  if (!code || code.length !== TOTP_DIGITS || !/^\d+$/.test(code)) {
    return false
  }

  const currentCounter = getCurrentCounter()

  // Check current period
  if (generateTOTP(secret, currentCounter) === code) {
    return true
  }

  // Check previous period (clock drift tolerance)
  if (generateTOTP(secret, currentCounter - 1) === code) {
    return true
  }

  return false
}
