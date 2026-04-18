// ─────────────────────────────────────────────────────────────
// O.P.U.C — Password Utilities
// Provides hashing, verification, strength validation,
// secure generation, and account lockout helpers.
// Uses bcryptjs (pure JS, no native deps) and Node.js crypto.
// Server-side only.
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// ═══════════════════════════════════════════════════════════
// PASSWORD HASHING (bcrypt)
// ═══════════════════════════════════════════════════════════

const BCRYPT_ROUNDS = 12

/**
 * Hash a password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ═══════════════════════════════════════════════════════════
// PASSWORD STRENGTH VALIDATION
// ═══════════════════════════════════════════════════════════

/**
 * Validate password strength against security rules.
 *
 * Rules:
 *  - Minimum 8 characters
 *  - At least one uppercase letter
 *  - At least one lowercase letter
 *  - At least one digit
 *  - At least one special character
 *
 * @returns { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères.')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push(
      'Le mot de passe doit contenir au moins une lettre majuscule.'
    )
  }

  if (!/[a-z]/.test(password)) {
    errors.push(
      'Le mot de passe doit contenir au moins une lettre minuscule.'
    )
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre.')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push(
      'Le mot de passe doit contenir au moins un caractère spécial.'
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ═══════════════════════════════════════════════════════════
// SECURE PASSWORD GENERATION
// ═══════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure random password.
 * Ensures at least one character from each required class.
 *
 * @param length - Password length (default: 12)
 * @returns Generated password string
 */
export function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // removed I, O
  const lowercase = 'abcdefghjkmnpqrstuvwxyz' // removed i, l, o
  const digits = '23456789' // removed 0, 1
  const special = '!@#$%&*+-=?'

  const allChars = uppercase + lowercase + digits + special

  // Ensure at least one of each class
  let password = ''
  password += uppercase[randomBytes(1)[0] % uppercase.length]
  password += lowercase[randomBytes(1)[0] % lowercase.length]
  password += digits[randomBytes(1)[0] % digits.length]
  password += special[randomBytes(1)[0] % special.length]

  // Fill remaining length with random characters from all classes
  for (let i = password.length; i < length; i++) {
    password += allChars[randomBytes(1)[0] % allChars.length]
  }

  // Shuffle the password to randomize guaranteed character positions
  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr.join('')
}

// ═══════════════════════════════════════════════════════════
// RESET TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * Generate a secure random reset token (32-byte hex string).
 */
export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Check if a password reset token has expired.
 *
 * @param createdAt - When the token was created
 * @param hours - Validity period in hours (default: 1)
 */
export function isResetTokenExpired(
  createdAt: Date,
  hours: number = 1
): boolean {
  const expiryTime = new Date(createdAt).getTime() + hours * 60 * 60 * 1000
  return Date.now() > expiryTime
}

// ═══════════════════════════════════════════════════════════
// ACCOUNT LOCKOUT HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Check if an account is currently locked.
 *
 * @param lockedUntil - The lock expiry datetime, or null if not locked
 */
export function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil) > new Date()
}

/**
 * Calculate the lockout expiry date based on the number of failed attempts.
 * Implements progressive lockout:
 *  - 3 attempts: 5 minutes
 *  - 5 attempts: 15 minutes
 *  - 7+ attempts: 30 minutes
 *
 * @param maxAttempts - Number of failed attempts so far
 * @param lockoutMinutes - Base lockout duration in minutes (default: 5)
 */
export function getLockoutExpiryDate(
  maxAttempts: number,
  lockoutMinutes: number = 5
): Date {
  // Progressive lockout: increase duration based on attempts
  let minutes = lockoutMinutes
  if (maxAttempts >= 7) {
    minutes = 30
  } else if (maxAttempts >= 5) {
    minutes = 15
  }

  const expiry = new Date()
  expiry.setMinutes(expiry.getMinutes() + minutes)
  return expiry
}
