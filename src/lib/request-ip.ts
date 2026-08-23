import { headers } from 'next/headers';
import { env } from '@/lib/env';

// Callers use this as a rate-limit bucket, so every request we can't attribute
// shares one counter. That's intentional: better a single noisy bucket than a
// per-request bypass.
export const UNKNOWN_IP = 'unknown';

/**
 * Client IP for rate limiting. Only callable from server actions and route
 * handlers — `headers()` needs a request scope, which `authorize()` doesn't have.
 *
 * `x-forwarded-for` is append-only: each proxy tacks on the address it saw. So
 * the entries on the right come from our own infrastructure and the ones on the
 * left came from the client and can be forged. Reading the leftmost value (the
 * usual shortcut) would let an attacker send a fresh `x-forwarded-for` on every
 * request and reduce any per-IP limit to decoration. We count from the right by
 * `TRUSTED_PROXY_HOPS` instead, and trust nothing when that's 0.
 */
export async function getClientIp(): Promise<string> {
  const hops = env.TRUSTED_PROXY_HOPS;
  if (hops === 0) return UNKNOWN_IP;

  const headerList = await headers();

  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const entries = forwarded.split(',');
    const ip = entries[entries.length - hops]?.trim();
    if (ip) return ip;
  }

  const realIp = headerList.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return UNKNOWN_IP;
}
