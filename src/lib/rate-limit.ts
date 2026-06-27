interface RateLimitState {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitState>();

export interface RateLimitOptions {
  key: string;
  limit: number;
  /** Window size in seconds. */
  window: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Unix epoch seconds when the window resets. */
  reset: number;
}

/**
 * Fixed-window rate limiter.
 * Time complexity: O(1) per request.
 * Space complexity: O(U) where U is the number of unique keys in the window.
 */
export async function rateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = opts.key;

  // Basic memory leak prevention: if the map grows too large (e.g., under an
  // IP spoofing attack), proactively clean up expired entries.
  if (rateLimitStore.size > 10_000) {
    for (const [k, state] of rateLimitStore) {
      if (state.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  let state = rateLimitStore.get(key);

  // If no state exists, or the previous window has expired, start a new window.
  if (!state || state.resetAt < now) {
    state = {
      count: 0,
      resetAt: now + opts.window * 1000,
    };
  }

  state.count++;
  rateLimitStore.set(key, state);

  const success = state.count <= opts.limit;
  const remaining = Math.max(0, opts.limit - state.count);

  return {
    success,
    remaining,
    reset: Math.ceil(state.resetAt / 1000),
  };
}
