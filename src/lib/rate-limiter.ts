// ─────────────────────────────────────────────────────────────
// O.P.U.C — In-Memory Rate Limiter
// Sliding-window rate limiter for API route protection.
// Server-side only.
// ─────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  retryAfterMs: number
}

// ═══════════════════════════════════════════════════════════
// IN-MEMORY STORE
// ═══════════════════════════════════════════════════════════

const store = new Map<string, RateLimitEntry>()

// ═══════════════════════════════════════════════════════════
// CLEANUP — Remove expired entries every 60 seconds
// ═══════════════════════════════════════════════════════════

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key)
      }
    }
  }, 60_000)
}

// ═══════════════════════════════════════════════════════════
// CORE FUNCTION
// ═══════════════════════════════════════════════════════════

/**
 * Check rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., IP + endpoint)
 * @param options - maxRequests and windowMs configuration
 * @returns Whether the request is allowed and how long to wait if not
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const { maxRequests, windowMs } = options
  const now = Date.now()

  const existing = store.get(key)

  // No entry or window expired — create fresh entry
  if (!existing || now >= existing.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    return { success: true, retryAfterMs: 0 }
  }

  // Within window — check count
  if (existing.count >= maxRequests) {
    const retryAfterMs = existing.resetAt - now
    return { success: false, retryAfterMs }
  }

  // Increment and allow
  existing.count += 1
  return { success: true, retryAfterMs: 0 }
}

// ═══════════════════════════════════════════════════════════
// CONVENIENCE WRAPPER FOR API ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * Extract client IP from a NextRequest object.
 * Checks X-Forwarded-For, X-Real-IP headers, then falls back to remoteAddress.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Next.js doesn't expose remoteAddress on the request object directly
  // In a serverless environment, rely on headers above
  return 'unknown'
}

/**
 * Rate-limit a request by IP and endpoint.
 *
 * @param request - The NextRequest object
 * @param options - Rate limit configuration
 * @returns Rate limit result; caller should check `success` and return 429 if false
 */
export function rateLimitByRequest(
  request: NextRequest,
  endpoint: string,
  options: RateLimitOptions
): RateLimitResult {
  const ip = getClientIp(request)
  const key = `${ip}:${endpoint}`
  return rateLimit(key, options)
}
